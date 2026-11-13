import { cellAhead, cellTouchesMachine, cellTouchesSource, cellTouchesReceiver, mergerInputTouches, splitterOutputTouches, resolveCellConveyors, type CellConveyorShape } from '../logistics/CellConveyor';
import { resolveAutoConveyors, type AutoConveyorShape } from '../logistics/AutoConveyor';
import { BELT_HEIGHT, machinePort, pathForBuilding, isDirectionalMachine, isLiftBuilding, liftInputOffset, liftOutputOffset } from '../logistics/ConveyorDefinitions';
import { matchesPort } from '../logistics/Ports';
import { connectedHeight, connectionStatus } from '../logistics/ConveyorPlacement';
import type { ResourceDeposit } from '../resources/ResourceDeposit';
import type { Inventory } from '../items/Inventory';
import type { ObstacleDefinition } from '../world/ObstacleField';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';
import type { BuildingDefinition, BuildingRegistry } from './BuildingRegistry';
import { snapFootprint, type BuildingTransform, type Footprint } from './Transform';
import { terrainSupport } from './TerrainSupport';
import { VoxelTerrain } from '../world/terrain/VoxelTerrain';
import { expandRoute, type RoutePoint } from '../logistics/ConveyorRoute';

export interface BuildingInstance {
  readonly id: string;
  readonly typeId: string;
  /** Free builds never refund construction materials, even after switching modes. */
  readonly freePlacement?: true;
  readonly transform: BuildingTransform;
  readonly autoConveyor?: AutoConveyorShape;
  readonly cellConveyor?: CellConveyorShape;
  readonly depositId?: string;
  readonly depositItemId?: string;
}
export type PlacementReason = 'valid' | 'outside bounds' | 'invalid terrain support' | 'terrain too steep' | 'occupied space' | 'player overlap' | 'insufficient materials' | 'no compatible deposit' | 'multiple deposits' | 'incompatible connection' | 'unsupported height' | 'conveyor occupied';
export interface PlacementResult {
  readonly reason: PlacementReason;
  readonly transform: BuildingTransform;
  readonly depositId?: string;
  readonly depositItemId?: string;
  readonly connection?: 'connected' | 'disconnected';
  readonly autoConveyor?: AutoConveyorShape;
  readonly cellConveyor?: CellConveyorShape;
  /** Existing belts whose shape would change if this valid placement is confirmed. */
  readonly conveyorPreviewChanges?: readonly BuildingInstance[];
  readonly snappedToConveyor?: boolean;
  readonly snappedToFoundation?: boolean;
}
export type RouteReason = PlacementReason | 'invalid route' | 'missing source' | 'output blocked';
export type RouteEndConnection = 'connected' | 'open' | 'blocked';
export interface RouteResult { readonly reason: RouteReason; readonly cells: readonly BuildingInstance[]; readonly changed: readonly BuildingInstance[]; readonly cost: readonly { readonly itemId: string; readonly quantity: number }[]; readonly endConnection: RouteEndConnection | null }
export interface PlayerFootprint { readonly x: number; readonly z: number; readonly radius: number;
  /** Optional body interval. Without it, retain conservative horizontal collision. */
  readonly feetY?: number; readonly headY?: number }


const intersects = (a: Footprint, b: Footprint): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
function circleIntersects(box: Footprint, x: number, z: number, radius: number): boolean {
  const dx = x - Math.max(box.minX, Math.min(x, box.maxX));
  const dz = z - Math.max(box.minZ, Math.min(z, box.maxZ));
  return dx * dx + dz * dz < radius * radius;
}

/** Authoritative, renderer-independent construction state and validation. */
export class BuildingSystem {
  private readonly buildings = new Map<string, BuildingInstance>();
  private nextId = 1;
  private creativeValue = false;
  get creativeMode(): boolean { return this.creativeValue; }
  setCreativeMode(enabled: boolean): void { this.creativeValue = enabled; }
  private readonly topologyGuards = new Set<(before: readonly BuildingInstance[], after: readonly BuildingInstance[]) => boolean>();
  addTopologyGuard(guard: (before: readonly BuildingInstance[], after: readonly BuildingInstance[]) => boolean): void { this.topologyGuards.add(guard); }
  private plan(buildings: readonly BuildingInstance[]): BuildingInstance[] | null {
    const plan = resolveAutoConveyors(buildings, this.cellSize), cells = resolveCellConveyors(buildings, this.cellSize);
    return plan && cells ? buildings.map((b) => b.typeId === 'conveyor-auto' ? Object.freeze({ ...b, autoConveyor: plan.get(b.id)! }) :
      b.typeId === 'conveyor-cell' ? Object.freeze({ ...b, cellConveyor: cells.get(b.id)! }) : b) : null;
  }
  private safePlan(before: readonly BuildingInstance[], after: readonly BuildingInstance[]): boolean {
    return [...this.topologyGuards].every((guard) => guard(before, after));
  }
  private revisionValue = 0;
  private readonly demolitionGuards = new Set<(building: BuildingInstance) => boolean>();
  get revision(): number { return this.revisionValue; }
  addDemolitionGuard(guard: (building: BuildingInstance) => boolean): () => void {
    this.demolitionGuards.add(guard); return () => { this.demolitionGuards.delete(guard); };
  }
  private demolitionGuard: ((building: BuildingInstance) => boolean) | null = null;
  setDemolitionGuard(guard: (building: BuildingInstance) => boolean): void { this.demolitionGuard = guard; }
  constructor(readonly registry: BuildingRegistry, private readonly inventory: Inventory,
    private readonly terrain: TerrainQuery, private readonly obstacles: readonly ObstacleDefinition[],
    readonly cellSize: number, private readonly playAreaRadius: number,
    private readonly deposits: readonly ResourceDeposit[] = [],
    private readonly dynamicObstacles: () => readonly ObstacleDefinition[] = () => []) {
    if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(playAreaRadius) || playAreaRadius <= 0) {
      throw new RangeError('Invalid construction grid or world bounds.');
    }
  }
  all(): readonly BuildingInstance[] { return [...this.buildings.values()]; }
  get(id: string): BuildingInstance | undefined { return this.buildings.get(id); }

  /** Align a partially touching 2-cell belt with an unambiguous neighbouring belt.
   * Exact grid positions and ambiguous contacts are left untouched. */
  private alignConveyor(base: BuildingTransform, definition: BuildingDefinition): BuildingTransform {
    const existing = this.all();
    // Never move a preview that is already occupying a building footprint.
    if (existing.some((b) => b.typeId !== 'foundation' && intersects(base.footprint, b.transform.footprint))) return base;
    const belts = existing.filter((b) => b.typeId === 'conveyor-auto');
    const span = 2 * this.cellSize, epsilon = 1e-7;
    const candidates: BuildingTransform[] = [];
    for (const belt of belts) {
      const dx = base.x - belt.transform.x, dz = base.z - belt.transform.z;
      const vertical = Math.abs(Math.abs(dz) - span) < epsilon && Math.abs(dx) < span - epsilon;
      const horizontal = Math.abs(Math.abs(dx) - span) < epsilon && Math.abs(dz) < span - epsilon;
      if (!vertical && !horizontal) continue;
      if ((vertical && Math.abs(dx) < epsilon) || (horizontal && Math.abs(dz) < epsilon)) return base;
      const candidate = snapFootprint(definition, vertical ? belt.transform.x : base.x,
        horizontal ? belt.transform.z : base.z, base.rotation, this.cellSize);
      if (existing.some((b) => b.typeId !== 'foundation' && intersects(candidate.footprint, b.transform.footprint))) continue;
      if (!candidates.some((c) => Math.abs(c.x - candidate.x) < epsilon && Math.abs(c.z - candidate.z) < epsilon)) candidates.push(candidate);
    }
    return candidates.length === 1 ? candidates[0]! : base;
  }

  /** Align a neighbouring tile edge to edge without shifting an occupied preview. */
  private alignFoundation(base: BuildingTransform, definition: BuildingDefinition, x: number, z: number): { transform: BuildingTransform; neighbour?: BuildingInstance } {
    const foundations = this.all().filter((b) => b.typeId === 'foundation');
    const overlapping = foundations.filter((b) => intersects(base.footprint, b.transform.footprint));
    if (overlapping.length) {
      overlapping.sort((a, b) => Math.hypot(x - a.transform.x, z - a.transform.z) - Math.hypot(x - b.transform.x, z - b.transform.z) || a.id.localeCompare(b.id));
      return { transform: base, neighbour: overlapping[0] };
    }
    const span = 2 * this.cellSize, epsilon = 1e-7;
    const candidates: { transform: BuildingTransform; neighbour: BuildingInstance; distance: number }[] = [];
    for (const neighbour of foundations) {
      const dx = base.x - neighbour.transform.x, dz = base.z - neighbour.transform.z;
      const vertical = Math.abs(Math.abs(dz) - span) < epsilon && Math.abs(dx) < span - epsilon;
      const horizontal = Math.abs(Math.abs(dx) - span) < epsilon && Math.abs(dz) < span - epsilon;
      if (!vertical && !horizontal) continue;
      const transform = snapFootprint(definition, vertical ? neighbour.transform.x : base.x,
        horizontal ? neighbour.transform.z : base.z, base.rotation, this.cellSize);
      if (foundations.some((b) => intersects(transform.footprint, b.transform.footprint))) continue;
      candidates.push({ transform, neighbour, distance: Math.hypot(x - transform.x, z - transform.z) });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.neighbour.id.localeCompare(b.neighbour.id));
    return candidates[0] ?? { transform: base };
  }

  validate(typeId: string, x: number, z: number, rotation: number, player: PlayerFootprint, foundationOffset?: number): PlacementResult {
    if (![player.x, player.z, player.radius].every(Number.isFinite) || player.radius < 0 ||
        (player.feetY !== undefined && !Number.isFinite(player.feetY)) || (player.headY !== undefined && !Number.isFinite(player.headY)) ||
        (player.feetY !== undefined && player.headY !== undefined && player.feetY > player.headY)) {
      throw new RangeError('Invalid player footprint.');
    }
    const definition = this.registry.get(typeId);
    const snapped = snapFootprint(definition, x, z, rotation, this.cellSize);
    if (foundationOffset !== undefined && (!Number.isFinite(foundationOffset) || typeId !== 'foundation')) throw new RangeError('Invalid foundation height offset.');
    const foundationSnap = typeId === 'foundation' && foundationOffset !== undefined ? this.alignFoundation(snapped, definition, x, z) : undefined;
    const base = foundationSnap?.transform ?? (typeId === 'conveyor-auto' ? this.alignConveyor(snapped, definition) : snapped);
    const f = base.footprint;
    const fail = (reason: PlacementReason, transform = base): PlacementResult => ({ reason, transform });
    if (!this.terrain.contains(f.minX, f.minZ) || !this.terrain.contains(f.maxX, f.maxZ) ||
        [[f.minX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.minZ], [f.maxX, f.maxZ]]
          .some(([px, pz]) => Math.hypot(px!, pz!) > this.playAreaRadius)) return fail('outside bounds');

    const support = terrainSupport(this.terrain, f);
    if (!support) return fail('invalid terrain support');
    // Voxel foundations default to the highest supporting column so one raised
    // block does not bury the entire slab. Existing neighbours remain the height reference.
    const foundationGround = this.terrain instanceof VoxelTerrain ? support.high : support.low;
    let transform = { ...base, y: typeId === 'foundation'
      ? (foundationSnap?.neighbour?.transform.y ?? foundationGround) + (foundationOffset ?? 0) : support.low };
    if (typeId === 'foundation' && support.high - transform.y > definition.height * .75 + 1e-7) return fail('unsupported height', transform);
    const intersecting = this.all().filter((building) => intersects(f, building.transform.footprint));
    let supportingFoundation: BuildingInstance | undefined;
    if (definition.placement === 'logistics') {
      supportingFoundation = intersecting.find((building) => {
        const b = building.transform.footprint;
        return building.typeId === 'foundation' && b.minX <= f.minX && b.maxX >= f.maxX && b.minZ <= f.minZ && b.maxZ >= f.maxZ;
      });
      let anchored = typeId === 'conveyor-auto' || typeId === 'conveyor-cell' ? null : connectedHeight(typeId, transform, this.all().filter((b) => b.typeId !== 'conveyor-auto' && b.typeId !== 'conveyor-cell' && !isLiftBuilding(b.typeId)), this.cellSize);
      if (typeId === 'conveyor-cell') {
        const candidate = { id: '__preview__', typeId, transform };
        const source = this.all().find((b) => (b.typeId === 'miner-mk1' || isDirectionalMachine(b.typeId)) && cellTouchesSource(candidate, b, this.cellSize, true));
        const sink = this.all().find((b) => (b.typeId === 'receiving-terminal' || isDirectionalMachine(b.typeId)) && cellTouchesReceiver(candidate, b, this.cellSize, true));
        const sourceHeight = source ? source.transform.y + liftOutputOffset(source.typeId, this.cellSize) : null;
        const sinkHeight = sink ? sink.transform.y + liftInputOffset(sink.typeId, this.cellSize) : null;
        if (sourceHeight !== null && sinkHeight !== null && Math.abs(sourceHeight - sinkHeight) > 1e-7) anchored = 'conflict';
        else anchored = sourceHeight ?? sinkHeight;
      } else if (typeId === 'conveyor-auto') {
        const source = this.all().find((b) => {
          if (b.typeId !== 'miner-mk1') return false;
          const port = machinePort(b, this.cellSize, 'source');
          return Math.hypot(transform.x - (b.transform.x + 2 * this.cellSize * port.direction.x), transform.z - (b.transform.z + 2 * this.cellSize * port.direction.z)) < 1e-7;
        });
        if (source) anchored = source.transform.y;
      } else if (isDirectionalMachine(typeId)) {
        if (isLiftBuilding(typeId)) anchored = null;
        const candidate = { id: '__preview__', typeId, transform };
        const neighbours = this.all().filter((b) => b.typeId === 'conveyor-cell' &&
          (cellTouchesReceiver(b, candidate, this.cellSize, true) || cellTouchesSource(b, candidate, this.cellSize, true)));
        const heights = neighbours.map((b) => {
          const path = pathForBuilding(b, this.cellSize)!;
          return cellTouchesReceiver(b, candidate, this.cellSize, true) ?
            path.point(path.length).y - BELT_HEIGHT - liftInputOffset(typeId, this.cellSize) :
            path.point(0).y - BELT_HEIGHT - liftOutputOffset(typeId, this.cellSize);
        });
        if (anchored !== null && anchored !== 'conflict') heights.push(anchored);
        if (anchored !== 'conflict') anchored = heights.some((y) => Math.abs(y - heights[0]!) > 1e-7) ? 'conflict' : heights[0] ?? anchored;
      } else if (typeId === 'receiving-terminal' && anchored === null && this.all().some((b) => b.typeId === 'conveyor-cell' && cellTouchesMachine(b, { id: '__preview__', typeId, transform }, this.cellSize, 'receiver', true))) {
        anchored = this.all().find((b) => b.typeId === 'conveyor-cell' && cellTouchesMachine(b, { id: '__preview__', typeId, transform }, this.cellSize, 'receiver', true))!.transform.y;
      } else if (typeId === 'receiving-terminal' && anchored === null) {
        const port = machinePort({ id: '__preview__', typeId, transform }, this.cellSize, 'receiver');
        const upstream = this.all().find((b) => b.typeId === 'conveyor-auto' &&
          Math.hypot(b.transform.x - (transform.x - 2 * this.cellSize * port.direction.x),
            b.transform.z - (transform.z - 2 * this.cellSize * port.direction.z)) < 1e-7);
        if (upstream) {
          const path = pathForBuilding(upstream, this.cellSize)!;
          const output = path.point(path.length);
          anchored = Math.hypot(output.x - port.position.x, output.z - port.position.z) < 1e-7 ? output.y - BELT_HEIGHT : upstream.transform.y;
        }
      }
      if (anchored === 'conflict') return fail('incompatible connection', transform);
      const surface = supportingFoundation ? supportingFoundation.transform.y + this.registry.get(supportingFoundation.typeId).height : null;
      if (surface !== null && anchored !== null && Math.abs(surface - anchored) > 1e-7) return fail('incompatible connection', transform);
      const y = surface ?? anchored ?? support.low;
      if (surface === null && (y < support.high - .12 || y > support.high + 2 * this.cellSize)) return fail('unsupported height', { ...base, y });
      transform = { ...base, y };
    }
    const foundationAboveTerrain = typeId === 'foundation' &&
      (this.terrain instanceof VoxelTerrain || transform.y > support.high + 1e-7);
    if (!foundationAboveTerrain && (support.slope > definition.maxSlope || support.high - support.low > definition.maxGroundVariation)) return fail('terrain too steep', transform);
    let deposit: ResourceDeposit | undefined;
    if (definition.placement === 'deposit') {
      const candidates = this.deposits.filter((d) => d.x >= f.minX && d.x <= f.maxX && d.z >= f.minZ && d.z <= f.maxZ);
      if (candidates.length > 1) return fail('multiple deposits', transform);
      deposit = candidates[0];
      if (!deposit?.extractionCompatible || !deposit.id.trim() || !Number.isFinite(deposit.productionMultiplier) || deposit.productionMultiplier <= 0) return fail('no compatible deposit', transform);
      try { this.inventory.registry.get(deposit.itemId); } catch { return fail('no compatible deposit', transform); }
      if (this.all().some((building) => building.depositId === deposit?.id)) return fail('occupied space', transform);
    }
    const foundations = intersecting.filter((building) => building.typeId === 'foundation');
    if (typeId === 'foundation' && foundations.length) {
      // Coplanar foundations may overlap only if at least one of the four grid
      // cells is new. Do not stack layers at the same XZ until support selection
      // is able to distinguish multiple floors.
      if (foundations.some((b) => Math.abs(b.transform.y - transform.y) > 1e-7)) return fail('occupied space', transform);
      let uncovered = false;
      for (let x = f.minX + this.cellSize / 2; x < f.maxX; x += this.cellSize) {
        for (let z = f.minZ + this.cellSize / 2; z < f.maxZ; z += this.cellSize) {
          if (!foundations.some((b) => x > b.transform.footprint.minX && x < b.transform.footprint.maxX &&
            z > b.transform.footprint.minZ && z < b.transform.footprint.maxZ)) uncovered = true;
        }
      }
      if (!uncovered) return fail('occupied space', transform);
    }
    const intersectsHeight = (bottom: number, top: number) => transform.y < top - 1e-7 && transform.y + definition.height > bottom + 1e-7;
    if (intersecting.some((building) => {
      if (typeId === 'foundation') return building.typeId !== 'foundation' && intersectsHeight(building.transform.y, building.transform.y + this.registry.get(building.typeId).height);
      // A machine or belt on a shared platform must not collide with other
      // coplanar foundations that support the same surface.
      if (supportingFoundation && building.typeId === 'foundation' && Math.abs(building.transform.y - supportingFoundation.transform.y) < 1e-7) return false;
      return building.id !== supportingFoundation?.id;
    }) || [...this.obstacles, ...this.dynamicObstacles()].some((obstacle) =>
      (!deposit || obstacle.id !== `${deposit.id}-collider`) && circleIntersects(f, obstacle.x, obstacle.z, obstacle.radius) &&
      (typeId !== 'foundation' || intersectsHeight(obstacle.y, obstacle.y + obstacle.height)))) return fail('occupied space', transform);
    let connection: 'connected' | 'disconnected' | undefined;
    if (definition.placement === 'logistics' || typeId === 'miner-mk1') {
      const result = typeId === 'conveyor-auto' || typeId === 'conveyor-cell' || isLiftBuilding(typeId) ? 'disconnected' : connectionStatus(typeId, transform, this.all().filter((b) => b.typeId !== 'conveyor-auto' && b.typeId !== 'conveyor-cell' && !isLiftBuilding(b.typeId)), this.cellSize);
      if (result === 'incompatible') return fail('incompatible connection', transform);
      connection = result;
    }
    const existing = this.all();
    const proposed: BuildingInstance = { id: `building-${this.nextId}`, typeId, transform };
    const planned = this.plan([...existing, proposed]);
    if (!planned) return fail('incompatible connection', transform);
    // Each physical splitter port accepts one lane, not two competing belts.
    const cells = planned.filter((b) => b.typeId === 'conveyor-cell');
    for (const junction of planned.filter((b) => b.typeId === 'splitter')) {
      if (cells.filter((b) => cellTouchesMachine(b, junction, this.cellSize, 'receiver')).length > 1 ||
          [0, 1, 2].some((i) => cells.filter((b) => splitterOutputTouches(b, junction, this.cellSize, i)).length > 1))
        return fail('incompatible connection', transform);
    }

    for (const junction of planned.filter((b) => b.typeId === 'merger')) {
      if ([0, 1, 2].some((i) => cells.filter((b) => mergerInputTouches(b, junction, this.cellSize, i)).length > 1) ||
          cells.filter((b) => cellTouchesSource(b, junction, this.cellSize)).length > 1)
        return fail('incompatible connection', transform);
    }

    for (const lift of planned.filter((b) => isLiftBuilding(b.typeId))) {
      if (cells.filter((b) => cellTouchesReceiver(b, lift, this.cellSize)).length > 1 ||
          cells.filter((b) => cellTouchesSource(b, lift, this.cellSize)).length > 1)
        return fail('incompatible connection', transform);
    }

    // Old conveyor variants remain loadable, but mixing them with automatic tiles
    // is rejected rather than silently producing an incorrectly linked network.
    const legacy = (b: BuildingInstance) => ['conveyor-straight', 'conveyor-curve', 'conveyor-incline'].includes(b.typeId);
    if ((typeId === 'conveyor-auto' || legacy(proposed)) && existing.some((b) =>
      ((typeId === 'conveyor-auto' && legacy(b)) || (legacy(proposed) && b.typeId === 'conveyor-auto')) &&
      ((Math.abs(Math.abs(b.transform.x - transform.x) - 2 * this.cellSize) < 1e-7 && Math.abs(b.transform.z - transform.z) < 1e-7) ||
       (Math.abs(Math.abs(b.transform.z - transform.z) - 2 * this.cellSize) < 1e-7 && Math.abs(b.transform.x - transform.x) < 1e-7)))) return fail('incompatible connection', transform);
    if (!this.safePlan(existing, planned)) return fail('conveyor occupied', transform);
    const plannedCandidate = planned.find((b) => b.id === proposed.id)!;
    const autoConveyor = plannedCandidate.autoConveyor, cellConveyor = plannedCandidate.cellConveyor;
    if (typeId === 'conveyor-cell') {
      connection = planned.some((b) => b.id !== proposed.id && (
        b.typeId === 'conveyor-cell' ? cellAhead(proposed, b, this.cellSize) || cellAhead(b, proposed, this.cellSize) :
        b.typeId === 'miner-mk1' ? cellTouchesSource(proposed, b, this.cellSize) :
        isDirectionalMachine(b.typeId) ? cellTouchesSource(proposed, b, this.cellSize) || cellTouchesReceiver(proposed, b, this.cellSize) :
        b.typeId === 'receiving-terminal' ? cellTouchesReceiver(proposed, b, this.cellSize) : false)) ? 'connected' : 'disconnected';
    }
    if (typeId === 'conveyor-auto' && autoConveyor) {
      const path = pathForBuilding({ ...proposed, autoConveyor }, this.cellSize)!;
      connection = planned.some((b) => {
        if (b.id === proposed.id) return false;
        const other = pathForBuilding(b, this.cellSize);
        return other ? other.compatible(path) || path.compatible(other) :
          b.typeId === 'miner-mk1' ? matchesPort(machinePort(b, this.cellSize, 'source'), path.point(0), path.direction('input')) :
          b.typeId === 'receiving-terminal' ? matchesPort(machinePort(b, this.cellSize, 'receiver'), path.point(path.length), path.direction('output')) : false;
      }) ? 'connected' : 'disconnected';
    }
    if (isDirectionalMachine(typeId) && connection === 'disconnected' && planned.some((b) => b.typeId === 'conveyor-cell' && (cellTouchesSource(b, proposed, this.cellSize) || cellTouchesReceiver(b, proposed, this.cellSize)))) connection = 'connected';
    if ((typeId === 'miner-mk1' || typeId === 'receiving-terminal') && connection === 'disconnected') {
      const port = machinePort(proposed, this.cellSize, typeId === 'miner-mk1' ? 'source' : 'receiver');
      if (planned.some((b) => {
        if (b.typeId === 'conveyor-cell') return cellTouchesMachine(b, proposed, this.cellSize, typeId === 'miner-mk1' ? 'source' : 'receiver');
        if (b.typeId !== 'conveyor-auto') return false;
        const path = pathForBuilding(b, this.cellSize)!;
        return typeId === 'miner-mk1' ? matchesPort(port, path.point(0), path.direction('input')) :
          matchesPort(port, path.point(path.length), path.direction('output'));
      })) connection = 'connected';
    }
    if (player.x > f.minX - player.radius && player.x < f.maxX + player.radius &&
        player.z > f.minZ - player.radius && player.z < f.maxZ + player.radius &&
        (typeId !== 'foundation' || player.feetY === undefined || player.headY === undefined || intersectsHeight(player.feetY, player.headY))) return fail('player overlap', transform);
    if (!this.creativeMode && definition.cost.some((entry) => !this.inventory.hasItem(entry.itemId, entry.quantity))) return fail('insufficient materials', transform);
    const byId = new Map(existing.map((b) => [b.id, b]));
    const conveyorPreviewChanges = planned.filter((b) => (b.typeId === 'conveyor-auto' || b.typeId === 'conveyor-cell') && byId.has(b.id) &&
      (JSON.stringify(byId.get(b.id)!.autoConveyor) !== JSON.stringify(b.autoConveyor) || JSON.stringify(byId.get(b.id)!.cellConveyor) !== JSON.stringify(b.cellConveyor)));
    return { reason: 'valid', transform, ...(autoConveyor ? { autoConveyor } : {}), ...(cellConveyor ? { cellConveyor } : {}), ...(connection ? { connection } : {}),
      ...(conveyorPreviewChanges.length ? { conveyorPreviewChanges } : {}),
      ...(typeId === 'conveyor-auto' && base !== snapped ? { snappedToConveyor: true } : {}),
      ...(foundationSnap?.neighbour ? { snappedToFoundation: true } : {}),
      ...(deposit ? { depositId: deposit.id, depositItemId: deposit.itemId } : {}) };
  }

  place(typeId: string, x: number, z: number, rotation: number, player: PlayerFootprint, foundationOffset?: number): PlacementResult & { readonly building?: BuildingInstance } {
    const result = this.validate(typeId, x, z, rotation, player, foundationOffset);
    if (result.reason !== 'valid') return result;
    const definition = this.registry.get(typeId);
    const building: BuildingInstance = Object.freeze({ id: `building-${this.nextId}`, typeId, ...(this.creativeMode ? { freePlacement: true as const } : {}), ...(result.depositId && result.depositItemId ? { depositId: result.depositId, depositItemId: result.depositItemId } : {}),
      transform: Object.freeze({ ...result.transform, footprint: Object.freeze({ ...result.transform.footprint }) }), ...(result.autoConveyor ? { autoConveyor: result.autoConveyor } : {}), ...(result.cellConveyor ? { cellConveyor: result.cellConveyor } : {}) });
    if (!this.creativeMode && !this.inventory.exchange(definition.cost, [])) return { ...result, reason: 'insufficient materials' };
    // Commit exactly the plan validated above, without resolving it a second
    // time with a different preview identity or a different set of shapes.
    for (const entry of result.conveyorPreviewChanges ?? []) this.buildings.set(entry.id, entry);
    this.buildings.set(building.id, building);
    this.nextId++; this.revisionValue++;
    return { ...result, building };
  }
  /** Revalidate an entire route on an isolated copy, then check the final topology
   * against the live network. Nothing is paid or committed by preview. */
  previewConveyorRoute(points: readonly RoutePoint[], player: PlayerFootprint, xFirst = false, defaultRotation = 0): RouteResult {
    const definition = this.registry.get('conveyor-cell');
    const expanded = expandRoute(points, definition, this.cellSize, xFirst, defaultRotation);
    const empty = (reason: RouteReason): RouteResult => ({ reason, cells: [], changed: [], cost: [], endConnection: null });
    if (!expanded) return empty('invalid route');
    const shadow = new BuildingSystem(this.registry, this.inventory, this.terrain, this.obstacles, this.cellSize,
      this.playAreaRadius, this.deposits, this.dynamicObstacles);
    for (const b of this.all()) shadow.buildings.set(b.id, b);
    shadow.nextId = this.nextId; shadow.creativeValue = true;
    const ids: string[] = [];
    for (const cell of expanded) {
      const result = shadow.place('conveyor-cell', cell.x, cell.z, cell.rotation, player);
      if (result.reason !== 'valid' || !result.building) return empty(result.reason);
      ids.push(result.building.id);
    }
    const before = this.all(), after = shadow.all().map((b) => {
      if (!ids.includes(b.id) || this.creativeMode) return b;
      const { freePlacement: _free, ...paid } = b; return Object.freeze(paid);
    });
    const route = ids.map((id) => after.find((b) => b.id === id)!);
    const first = route[0]!, last = route.at(-1)!;
    // Match the network's first-lane arbitration for machine ports. A port
    // that already selects another lane is not a usable endpoint.
    const cells = after.filter((b) => b.typeId === 'conveyor-cell');
    const selected = (predicate: (cell: BuildingInstance) => boolean, target: BuildingInstance) => cells.find(predicate)?.id === target.id;
    const hasSource = before.some((b) => {
      if (b.typeId === 'conveyor-cell') return cellAhead(b, first, this.cellSize);
      if (b.typeId !== 'miner-mk1' && !isDirectionalMachine(b.typeId)) return false;
      if (b.typeId === 'splitter') return [0, 1, 2].some((i) => selected((cell) => splitterOutputTouches(cell, b, this.cellSize, i), first));
      return selected((cell) => cellTouchesSource(cell, b, this.cellSize), first);
    });
    const hasDestination = before.some((b) => {
      if (b.typeId === 'conveyor-cell') return cellAhead(last, b, this.cellSize);
      if (b.typeId !== 'receiving-terminal' && !isDirectionalMachine(b.typeId)) return false;
      if (b.typeId === 'merger') return [0, 1, 2].some((i) => selected((cell) => mergerInputTouches(cell, b, this.cellSize, i), last));
      if (b.typeId === 'splitter' || isLiftBuilding(b.typeId)) return selected((cell) => cellTouchesReceiver(cell, b, this.cellSize), last);
      return cellTouchesReceiver(last, b, this.cellSize);
    });
    // Match the network's obstruction rule: a non-accepting building directly
    // ahead blocks the output. An empty cell ahead is a valid open route end.
    const direction = pathForBuilding(last, this.cellSize)!.direction('output');
    const x = last.transform.x + direction.x * this.cellSize, z = last.transform.z + direction.z * this.cellSize;
    const blocked = !hasDestination && before.some((b) => b.typeId !== 'foundation' &&
      x > b.transform.footprint.minX && x < b.transform.footprint.maxX &&
      z > b.transform.footprint.minZ && z < b.transform.footprint.maxZ);
    const endConnection: RouteEndConnection = hasDestination ? 'connected' : blocked ? 'blocked' : 'open';
    const cost = definition.cost.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity * route.length }));
    const changed = after.filter((b) => !ids.includes(b.id) && (b.typeId === 'conveyor-cell' || b.typeId === 'conveyor-auto') &&
      JSON.stringify([before.find((old) => old.id === b.id)?.cellConveyor, before.find((old) => old.id === b.id)?.autoConveyor]) !== JSON.stringify([b.cellConveyor, b.autoConveyor]));
    const result = (reason: RouteReason): RouteResult => ({ reason, cells: route, changed, cost, endConnection });
    if (!hasSource) return result('missing source');
    if (blocked) return result('output blocked');
    if (!this.creativeMode && cost.some((entry) => !this.inventory.hasItem(entry.itemId, entry.quantity))) return result('insufficient materials');
    if (!this.safePlan(before, after)) return result('conveyor occupied');
    return result('valid');
  }
  /** Revalidate immediately before a single all-or-nothing payment and commit. */
  placeConveyorRoute(points: readonly RoutePoint[], player: PlayerFootprint, xFirst = false, defaultRotation = 0): RouteResult {
    const result = this.previewConveyorRoute(points, player, xFirst, defaultRotation);
    if (result.reason !== 'valid') return result;
    if (!this.creativeMode && !this.inventory.exchange(result.cost, [])) return { ...result, reason: 'insufficient materials' };
    for (const b of result.changed) this.buildings.set(b.id, b);
    for (const b of result.cells) this.buildings.set(b.id, b);
    this.nextId += result.cells.length; this.revisionValue++;
    return result;
  }

  /** Paid buildings refund in full; free buildings return nothing regardless of current mode. */
  demolish(id: string): 'removed' | 'unknown building' | 'inventory full' | 'output not empty' | 'building supports another' | 'conveyor occupied' {
    const building = this.buildings.get(id);
    if (!building) return 'unknown building';
    if (building.typeId === 'foundation' && this.all().some((other) => other.id !== id && this.registry.get(other.typeId).placement === 'logistics' && intersects(building.transform.footprint, other.transform.footprint) && other.transform.y >= building.transform.y + this.registry.get(building.typeId).height - 1e-7)) return 'building supports another';
    if ((this.demolitionGuard && !this.demolitionGuard(building)) || [...this.demolitionGuards].some((guard) => !guard(building))) return 'output not empty';
    const planned = this.plan(this.all().filter((entry) => entry.id !== id));
    if (!planned || !this.safePlan(this.all(), planned)) return 'conveyor occupied';
    const definition: BuildingDefinition = this.registry.get(building.typeId);
    if (!building.freePlacement && !this.inventory.exchange([], definition.cost)) return 'inventory full';
    this.buildings.delete(id); for (const entry of planned) this.buildings.set(entry.id, entry); this.revisionValue++;
    return 'removed';
  }
}
