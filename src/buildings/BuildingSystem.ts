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
  readonly depositId?: string;
  readonly depositItemId?: string;
}
export type PlacementReason = 'valid' | 'outside bounds' | 'invalid terrain support' | 'terrain too steep' | 'occupied space' | 'player overlap' | 'insufficient materials' | 'no compatible deposit' | 'multiple deposits' | 'incompatible connection' | 'unsupported height';
export interface PlacementResult { readonly reason: PlacementReason; readonly transform: BuildingTransform; readonly depositId?: string; readonly depositItemId?: string; readonly connection?: 'connected' | 'disconnected' }
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
    private readonly deposits: readonly ResourceDeposit[] = []) {
    if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(playAreaRadius) || playAreaRadius <= 0) {
      throw new RangeError('Invalid construction grid or world bounds.');
    }
  }
  all(): readonly BuildingInstance[] { return [...this.buildings.values()]; }
  get(id: string): BuildingInstance | undefined { return this.buildings.get(id); }

  validate(typeId: string, x: number, z: number, rotation: number, player: PlayerFootprint): PlacementResult {
    if (![player.x, player.z, player.radius].every(Number.isFinite) || player.radius < 0) {
      throw new RangeError('Invalid player footprint.');
    }
    const definition = this.registry.get(typeId);
    const base = snapFootprint(definition, x, z, rotation, this.cellSize);
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
      const anchored = connectedHeight(typeId, transform, this.all(), this.cellSize);
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
        this.obstacles.some((obstacle) => (!deposit || obstacle.id !== `${deposit.id}-collider`) && circleIntersects(f, obstacle.x, obstacle.z, obstacle.radius))) return fail('occupied space', transform);
    let connection: 'connected' | 'disconnected' | undefined;
    if (definition.placement === 'logistics') {
      const result = connectionStatus(typeId, transform, this.all(), this.cellSize);
      if (result === 'incompatible') return fail('incompatible connection', transform);
      connection = result;
    }
    if (player.x > f.minX - player.radius && player.x < f.maxX + player.radius &&
        player.z > f.minZ - player.radius && player.z < f.maxZ + player.radius) return fail('player overlap', transform);
    if (definition.cost.some((entry) => !this.inventory.hasItem(entry.itemId, entry.quantity))) return fail('insufficient materials', transform);
    return { reason: 'valid', transform, ...(connection ? { connection } : {}), ...(deposit ? { depositId: deposit.id, depositItemId: deposit.itemId } : {}) };
  }

  place(typeId: string, x: number, z: number, rotation: number, player: PlayerFootprint): PlacementResult & { readonly building?: BuildingInstance } {
    const result = this.validate(typeId, x, z, rotation, player);
    if (result.reason !== 'valid') return result;
    const definition = this.registry.get(typeId);
    const building: BuildingInstance = Object.freeze({ id: `building-${this.nextId}`, typeId, ...(result.depositId && result.depositItemId ? { depositId: result.depositId, depositItemId: result.depositItemId } : {}),
      transform: Object.freeze({ ...result.transform, footprint: Object.freeze({ ...result.transform.footprint }) }) });
    if (!this.inventory.exchange(definition.cost, [])) return { ...result, reason: 'insufficient materials' };
    this.buildings.set(building.id, building); this.nextId++; this.revisionValue++;
    return { ...result, building };
  }
  /** Full original refund or no demolition: never discard an overflow remainder. */
  demolish(id: string): 'removed' | 'unknown building' | 'inventory full' | 'output not empty' | 'building supports another' {
    const building = this.buildings.get(id);
    if (!building) return 'unknown building';
    if (building.typeId === 'foundation' && this.all().some((other) => other.id !== id && this.registry.get(other.typeId).placement === 'logistics' && intersects(building.transform.footprint, other.transform.footprint) && other.transform.y >= building.transform.y + this.registry.get(building.typeId).height - 1e-7)) return 'building supports another';
    if ((this.demolitionGuard && !this.demolitionGuard(building)) || [...this.demolitionGuards].some((guard) => !guard(building))) return 'output not empty';
    const definition: BuildingDefinition = this.registry.get(building.typeId);
    if (!this.inventory.exchange([], definition.cost)) return 'inventory full';
    this.buildings.delete(id); this.revisionValue++;
    return 'removed';
  }
}
