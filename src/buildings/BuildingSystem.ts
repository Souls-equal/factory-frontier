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
}
export type PlacementReason = 'valid' | 'outside bounds' | 'invalid terrain support' | 'terrain too steep' | 'occupied space' | 'player overlap' | 'insufficient materials';
export interface PlacementResult { readonly reason: PlacementReason; readonly transform: BuildingTransform }
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
  constructor(readonly registry: BuildingRegistry, private readonly inventory: Inventory,
    private readonly terrain: TerrainQuery, private readonly obstacles: readonly ObstacleDefinition[],
    readonly cellSize: number, private readonly playAreaRadius: number) {
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
    const transform = { ...base, y: support.low };
    if (support.slope > definition.maxSlope || support.high - support.low > definition.maxGroundVariation) return fail('terrain too steep', transform);
    if (this.all().some((building) => intersects(f, building.transform.footprint)) ||
        this.obstacles.some((obstacle) => circleIntersects(f, obstacle.x, obstacle.z, obstacle.radius))) return fail('occupied space', transform);
    if (player.x > f.minX - player.radius && player.x < f.maxX + player.radius &&
        player.z > f.minZ - player.radius && player.z < f.maxZ + player.radius) return fail('player overlap', transform);
    if (definition.cost.some((entry) => !this.inventory.hasItem(entry.itemId, entry.quantity))) return fail('insufficient materials', transform);
    return { reason: 'valid', transform };
  }

  place(typeId: string, x: number, z: number, rotation: number, player: PlayerFootprint): PlacementResult & { readonly building?: BuildingInstance } {
    const result = this.validate(typeId, x, z, rotation, player);
    if (result.reason !== 'valid') return result;
    const definition = this.registry.get(typeId);
    const building: BuildingInstance = Object.freeze({ id: `building-${this.nextId}`, typeId,
      transform: Object.freeze({ ...result.transform, footprint: Object.freeze({ ...result.transform.footprint }) }) });
    if (!this.inventory.exchange(definition.cost, [])) return { ...result, reason: 'insufficient materials' };
    this.buildings.set(building.id, building); this.nextId++;
    return { ...result, building };
  }
  /** Full original refund or no demolition: never discard an overflow remainder. */
  demolish(id: string): 'removed' | 'unknown building' | 'inventory full' {
    const building = this.buildings.get(id);
    if (!building) return 'unknown building';
    const definition: BuildingDefinition = this.registry.get(building.typeId);
    if (!this.inventory.exchange([], definition.cost)) return 'inventory full';
    this.buildings.delete(id);
    return 'removed';
  }
}
