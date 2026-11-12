import { cellAhead, cellTouchesMachine } from '../logistics/CellConveyor';
import { resolveAutoConveyors, type AutoConveyorShape } from '../logistics/AutoConveyor';
import { BELT_HEIGHT, machinePort, pathForBuilding } from '../logistics/ConveyorDefinitions';
import { matchesPort } from '../logistics/Ports';
import { connectedHeight, connectionStatus } from '../logistics/ConveyorPlacement';
import type { ResourceDeposit } from '../resources/ResourceDeposit';
import type { Inventory } from '../items/Inventory';
import type { ObstacleDefinition } from '../world/ObstacleField';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';
import type { BuildingDefinition, BuildingRegistry } from './BuildingRegistry';
import { snapFootprint, type BuildingTransform, type Footprint } from './Transform';
import { terrainSupport } from './TerrainSupport';

export interface BuildingInstance {
  readonly id: string;
  readonly typeId: string;
  readonly transform: BuildingTransform;
  readonly autoConveyor?: AutoConveyorShape;
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
  /** Existing belts whose shape would change if this valid placement is confirmed. */
  readonly conveyorPreviewChanges?: readonly BuildingInstance[];
  readonly snappedToConveyor?: boolean;
}
export interface PlayerFootprint { readonly x: number; readonly z: number; readonly radius: number }

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
  private readonly topologyGuards = new Set<(before: readonly BuildingInstance[], after: readonly BuildingInstance[]) => boolean>();
  addTopologyGuard(guard: (before: readonly BuildingInstance[], after: readonly BuildingInstance[]) => boolean): void { this.topologyGuards.add(guard); }
  private plan(buildings: readonly BuildingInstance[]): BuildingInstance[] | null {
    const plan = resolveAutoConveyors(buildings, this.cellSize);
    return plan ? buildings.map((b) => b.typeId === 'conveyor-auto' ? Object.freeze({ ...b, autoConveyor: plan.get(b.id)! }) : b) : null;
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

  validate(typeId: string, x: number, z: number, rotation: number, player: PlayerFootprint): PlacementResult {
    if (![player.x, player.z, player.radius].every(Number.isFinite) || player.radius < 0) {
      throw new RangeError('Invalid player footprint.');
    }
    const definition = this.registry.get(typeId);
    const snapped = snapFootprint(definition, x, z, rotation, this.cellSize);
    const base = typeId === 'conveyor-auto' ? this.alignConveyor(snapped, definition) : snapped;
    const f = base.footprint;
    const fail = (reason: PlacementReason, transform = base): PlacementResult => ({ reason, transform });
    if (!this.terrain.contains(f.minX, f.minZ) || !this.terrain.contains(f.maxX, f.maxZ) ||
        [[f.minX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.minZ], [f.maxX, f.maxZ]]
          .some(([px, pz]) => Math.hypot(px!, pz!) > this.playAreaRadius)) return fail('outside bounds');

    const support = terrainSupport(this.terrain, f);
    if (!support) return fail('invalid terrain support');
    // Sink a limited amount into terrain rather than floating above its lowest edge.
    let transform = { ...base, y: support.low };
    const intersecting = this.all().filter((building) => intersects(f, building.transform.footprint));
    let supportingFoundation: BuildingInstance | undefined;
    if (definition.placement === 'logistics') {
      supportingFoundation = intersecting.find((building) => {
        const b = building.transform.footprint;
        return building.typeId === 'foundation' && b.minX <= f.minX && b.maxX >= f.maxX && b.minZ <= f.minZ && b.maxZ >= f.maxZ;
      });
      let anchored = typeId === 'conveyor-auto' || typeId === 'conveyor-cell' ? null : connectedHeight(typeId, transform, this.all().filter((b) => b.typeId !== 'conveyor-auto' && b.typeId !== 'conveyor-cell'), this.cellSize);
      if (typeId === 'conveyor-cell') {
        const candidate = { id: '__preview__', typeId, transform };
        const source = this.all().find((b) => b.typeId === 'miner-mk1' && cellTouchesMachine(candidate, b, this.cellSize, 'source', true));
        if (source) anchored = source.transform.y;
      } else if (typeId === 'conveyor-auto') {
        const source = this.all().find((b) => {
          if (b.typeId !== 'miner-mk1') return false;
          const port = machinePort(b, this.cellSize, 'source');
          return Math.hypot(transform.x - (b.transform.x + 2 * this.cellSize * port.direction.x), transform.z - (b.transform.z + 2 * this.cellSize * port.direction.z)) < 1e-7;
        });
        if (source) anchored = source.transform.y;
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
    if (support.slope > definition.maxSlope || support.high - support.low > definition.maxGroundVariation) return fail('terrain too steep', transform);
    let deposit: ResourceDeposit | undefined;
    if (definition.placement === 'deposit') {
      const candidates = this.deposits.filter((d) => d.x >= f.minX && d.x <= f.maxX && d.z >= f.minZ && d.z <= f.maxZ);
      if (candidates.length > 1) return fail('multiple deposits', transform);
      deposit = candidates[0];
      if (!deposit?.extractionCompatible || !deposit.id.trim() || !Number.isFinite(deposit.productionMultiplier) || deposit.productionMultiplier <= 0) return fail('no compatible deposit', transform);
      try { this.inventory.registry.get(deposit.itemId); } catch { return fail('no compatible deposit', transform); }
      if (this.all().some((building) => building.depositId === deposit?.id)) return fail('occupied space', transform);
    }
    if (intersecting.some((building) => building.id !== supportingFoundation?.id) ||
        [...this.obstacles, ...this.dynamicObstacles()].some((obstacle) => (!deposit || obstacle.id !== `${deposit.id}-collider`) && circleIntersects(f, obstacle.x, obstacle.z, obstacle.radius))) return fail('occupied space', transform);
    let connection: 'connected' | 'disconnected' | undefined;
    if (definition.placement === 'logistics' || typeId === 'miner-mk1') {
      const result = typeId === 'conveyor-auto' || typeId === 'conveyor-cell' ? 'disconnected' : connectionStatus(typeId, transform, this.all().filter((b) => b.typeId !== 'conveyor-auto' && b.typeId !== 'conveyor-cell'), this.cellSize);
      if (result === 'incompatible') return fail('incompatible connection', transform);
      connection = result;
    }
    const existing = this.all();
    const proposed: BuildingInstance = { id: `building-${this.nextId}`, typeId, transform };
    const planned = this.plan([...existing, proposed]);
    if (!planned) return fail('incompatible connection', transform);
    // Old conveyor variants remain loadable, but mixing them with automatic tiles
    // is rejected rather than silently producing an incorrectly linked network.
    const legacy = (b: BuildingInstance) => ['conveyor-straight', 'conveyor-curve', 'conveyor-incline'].includes(b.typeId);
    if ((typeId === 'conveyor-auto' || legacy(proposed)) && existing.some((b) =>
      ((typeId === 'conveyor-auto' && legacy(b)) || (legacy(proposed) && b.typeId === 'conveyor-auto')) &&
      ((Math.abs(Math.abs(b.transform.x - transform.x) - 2 * this.cellSize) < 1e-7 && Math.abs(b.transform.z - transform.z) < 1e-7) ||
       (Math.abs(Math.abs(b.transform.z - transform.z) - 2 * this.cellSize) < 1e-7 && Math.abs(b.transform.x - transform.x) < 1e-7)))) return fail('incompatible connection', transform);
    if (!this.safePlan(existing, planned)) return fail('conveyor occupied', transform);
    const autoConveyor = planned.find((b) => b.id === proposed.id)?.autoConveyor;
    if (typeId === 'conveyor-cell') {
      connection = planned.some((b) => b.id !== proposed.id && (
        b.typeId === 'conveyor-cell' ? cellAhead(proposed, b, this.cellSize) || cellAhead(b, proposed, this.cellSize) :
        b.typeId === 'miner-mk1' ? cellTouchesMachine(proposed, b, this.cellSize, 'source') :
        b.typeId === 'receiving-terminal' ? cellTouchesMachine(proposed, b, this.cellSize, 'receiver') : false)) ? 'connected' : 'disconnected';
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
    if ((typeId === 'miner-mk1' || typeId === 'receiving-terminal') && connection === 'disconnected') {
      const port = machinePort(proposed, this.cellSize, typeId === 'miner-mk1' ? 'source' : 'receiver');
      if (planned.some((b) => {
        if (b.typeId !== 'conveyor-auto') return false;
        const path = pathForBuilding(b, this.cellSize)!;
        return typeId === 'miner-mk1' ? matchesPort(port, path.point(0), path.direction('input')) :
          matchesPort(port, path.point(path.length), path.direction('output'));
      })) connection = 'connected';
    }
    if (player.x > f.minX - player.radius && player.x < f.maxX + player.radius &&
        player.z > f.minZ - player.radius && player.z < f.maxZ + player.radius) return fail('player overlap', transform);
    if (definition.cost.some((entry) => !this.inventory.hasItem(entry.itemId, entry.quantity))) return fail('insufficient materials', transform);
    const byId = new Map(existing.map((b) => [b.id, b]));
    const conveyorPreviewChanges = planned.filter((b) => b.typeId === 'conveyor-auto' && byId.has(b.id) &&
      JSON.stringify(byId.get(b.id)!.autoConveyor) !== JSON.stringify(b.autoConveyor));
    return { reason: 'valid', transform, ...(autoConveyor ? { autoConveyor } : {}), ...(connection ? { connection } : {}),
      ...(conveyorPreviewChanges.length ? { conveyorPreviewChanges } : {}),
      ...(base !== snapped ? { snappedToConveyor: true } : {}),
      ...(deposit ? { depositId: deposit.id, depositItemId: deposit.itemId } : {}) };
  }

  place(typeId: string, x: number, z: number, rotation: number, player: PlayerFootprint): PlacementResult & { readonly building?: BuildingInstance } {
    const result = this.validate(typeId, x, z, rotation, player);
    if (result.reason !== 'valid') return result;
    const definition = this.registry.get(typeId);
    const building: BuildingInstance = Object.freeze({ id: `building-${this.nextId}`, typeId, ...(result.depositId && result.depositItemId ? { depositId: result.depositId, depositItemId: result.depositItemId } : {}),
      transform: Object.freeze({ ...result.transform, footprint: Object.freeze({ ...result.transform.footprint }) }), ...(result.autoConveyor ? { autoConveyor: result.autoConveyor } : {}) });
    if (!this.inventory.exchange(definition.cost, [])) return { ...result, reason: 'insufficient materials' };
    // Commit exactly the plan validated above, without resolving it a second
    // time with a different preview identity or a different set of shapes.
    for (const entry of result.conveyorPreviewChanges ?? []) this.buildings.set(entry.id, entry);
    this.buildings.set(building.id, building);
    this.nextId++; this.revisionValue++;
    return { ...result, building };
  }
  /** Full original refund or no demolition: never discard an overflow remainder. */
  demolish(id: string): 'removed' | 'unknown building' | 'inventory full' | 'output not empty' | 'building supports another' | 'conveyor occupied' {
    const building = this.buildings.get(id);
    if (!building) return 'unknown building';
    if (building.typeId === 'foundation' && this.all().some((other) => other.id !== id && this.registry.get(other.typeId).placement === 'logistics' && intersects(building.transform.footprint, other.transform.footprint) && other.transform.y >= building.transform.y + this.registry.get(building.typeId).height - 1e-7)) return 'building supports another';
    if ((this.demolitionGuard && !this.demolitionGuard(building)) || [...this.demolitionGuards].some((guard) => !guard(building))) return 'output not empty';
    const planned = this.plan(this.all().filter((entry) => entry.id !== id));
    if (!planned || !this.safePlan(this.all(), planned)) return 'conveyor occupied';
    const definition: BuildingDefinition = this.registry.get(building.typeId);
    if (!this.inventory.exchange([], definition.cost)) return 'inventory full';
    this.buildings.delete(id); for (const entry of planned) this.buildings.set(entry.id, entry); this.revisionValue++;
    return 'removed';
  }
}
