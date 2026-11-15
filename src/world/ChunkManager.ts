import type { BuildingInstance } from '../buildings/BuildingSystem';
import type { GatherableDefinition } from '../resources/Gatherables';
import type { ResourceDeposit } from '../resources/ResourceDeposit';
import type { Biome } from './Biomes';
import type { ObstacleDefinition } from './ObstacleField';
import type { InteractableDefinition, World } from './World';
import type { VoxelColumnRange } from './terrain/VoxelTerrain';

/** Immutable chunk metadata; mutable gameplay state remains with the world systems. */
export interface WorldChunk {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly range: VoxelColumnRange;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  /** Sample at the centre; the biome field can vary within a chunk. */
  readonly centreBiome: Biome;
  readonly deposits: readonly ResourceDeposit[];
  readonly gatherables: readonly GatherableDefinition[];
  readonly obstacles: readonly ObstacleDefinition[];
  readonly interactables: readonly InteractableDefinition[];
}
export interface ChunkChanges { readonly loaded: readonly WorldChunk[]; readonly unloaded: readonly WorldChunk[] }

/**
 * Tracks a bounded, camera-centred set of world regions. It does not own or
 * suspend factory state: a chunk's metadata can be recreated at any time.
 * Position-based objects belong to the chunk containing their centre. Buildings
 * are queried by footprint because they can cross chunk boundaries.
 */
export class ChunkManager {
  private readonly chunks = new Map<string, WorldChunk>();
  private lastX = NaN;
  private lastZ = NaN;
  private lastRadius = -1;

  constructor(private readonly world: World, readonly chunkColumns = 64) {
    if (!Number.isSafeInteger(chunkColumns) || chunkColumns < 1 || chunkColumns > 512)
      throw new RangeError('Invalid chunk size.');
  }

  all(): readonly WorldChunk[] { return [...this.chunks.values()]; }
  get(x: number, z: number): WorldChunk | undefined { return this.chunks.get(`${x},${z}`); }

  /** Return current buildings intersecting a loaded chunk, including edge-spanning buildings. */
  buildings(chunk: WorldChunk): readonly BuildingInstance[] {
    const b = chunk.bounds;
    return this.world.buildings.all().filter(({ transform: { footprint: f } }) =>
      f.minX < b.maxX && f.maxX > b.minX && f.minZ < b.maxZ && f.maxZ > b.minZ);
  }

  /** Coverage includes a one-chunk margin for positions within the focus chunk. */
  update(x: number, z: number, coverage: number): ChunkChanges {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(coverage) || coverage < 0)
      return { loaded: [], unloaded: [] };
    const t = this.world.terrain, width = this.chunkColumns * t.blockSize;
    const cx = Math.floor((x - t.originX) / width), cz = Math.floor((z - t.originZ) / width);
    const radius = Math.ceil(coverage / width) + 1;
    if (cx === this.lastX && cz === this.lastZ && radius === this.lastRadius) return { loaded: [], unloaded: [] };
    const maxX = Math.ceil(t.columnsX / this.chunkColumns), maxZ = Math.ceil(t.columnsZ / this.chunkColumns);
    const needed = new Set<string>(), loaded: WorldChunk[] = [], unloaded: WorldChunk[] = [];
    for (let zc = Math.max(0, cz - radius); zc <= Math.min(maxZ - 1, cz + radius); zc++)
      for (let xc = Math.max(0, cx - radius); xc <= Math.min(maxX - 1, cx + radius); xc++) {
        const id = `${xc},${zc}`; needed.add(id);
        if (!this.chunks.has(id)) loaded.push(this.create(xc, zc));
      }
    for (const [id, chunk] of this.chunks) if (!needed.has(id)) unloaded.push(chunk);
    // Publish only after all chunk metadata has been generated successfully.
    for (const chunk of unloaded) this.chunks.delete(chunk.id);
    for (const chunk of loaded) this.chunks.set(chunk.id, chunk);
    this.lastX = cx; this.lastZ = cz; this.lastRadius = radius;
    return { loaded, unloaded };
  }

  clear(): void { this.chunks.clear(); this.lastX = NaN; this.lastZ = NaN; this.lastRadius = -1; }

  private create(x: number, z: number): WorldChunk {
    const t = this.world.terrain, size = this.chunkColumns;
    const range = Object.freeze({ minX: x * size, maxX: Math.min(t.columnsX, (x + 1) * size),
      minZ: z * size, maxZ: Math.min(t.columnsZ, (z + 1) * size) });
    const bounds = Object.freeze({ minX: t.originX + range.minX * t.blockSize, maxX: t.originX + range.maxX * t.blockSize,
      minZ: t.originZ + range.minZ * t.blockSize, maxZ: t.originZ + range.maxZ * t.blockSize });
    const inside = (item: { readonly x: number; readonly z: number }) => item.x >= bounds.minX && item.x < bounds.maxX && item.z >= bounds.minZ && item.z < bounds.maxZ;
    return Object.freeze({ id: `${x},${z}`, x, z, range, bounds,
      centreBiome: this.world.biomes.at((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2),
      deposits: Object.freeze(this.world.deposits.filter(inside)),
      gatherables: Object.freeze(this.world.gatherables.definitions.filter(inside)),
      obstacles: Object.freeze(this.world.obstacleDefinitions.filter(inside)),
      interactables: Object.freeze(this.world.interactables.filter(inside)) });
  }
}
