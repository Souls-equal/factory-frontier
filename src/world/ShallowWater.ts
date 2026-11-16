import type { GatherableDefinition } from '../resources/Gatherables';
import type { ObstacleDefinition } from './ObstacleField';
import type { BiomeField } from './Biomes';
import { valueNoise2D } from './noise';
import type { VoxelTerrain, VoxelColumnRange } from './terrain/VoxelTerrain';

/** A shallow decorative water patch, not a fluid, collider, or extractable resource. */
export interface ShallowWaterCell {
  readonly columnX: number; readonly columnZ: number;
  readonly x: number; readonly z: number; readonly y: number; readonly size: number;
}

/** Stateless, deterministic sampling of wetland puddles for a voxel column range. */
export class ShallowWaterField {
  constructor(private readonly terrain: VoxelTerrain, private readonly biomes: BiomeField,
    private readonly obstacles: readonly ObstacleDefinition[], private readonly gatherables: readonly GatherableDefinition[],
    private readonly playRadius: number) {}

  cells(range: VoxelColumnRange): readonly ShallowWaterCell[] {
    const t = this.terrain;
    if (![range.minX, range.maxX, range.minZ, range.maxZ].every(Number.isSafeInteger) ||
        range.minX < 0 || range.minZ < 0 || range.maxX > t.columnsX || range.maxZ > t.columnsZ ||
        range.maxX <= range.minX || range.maxZ <= range.minZ) throw new RangeError('Invalid water column range.');
    const result: ShallowWaterCell[] = [], size = t.blockSize, half = size / 2;
    for (let z = range.minZ; z < range.maxZ; z++) for (let x = range.minX; x < range.maxX; x++) {
      const wx = t.originX + (x + .5) * size, wz = t.originZ + (z + .5) * size;
      if (Math.hypot(wx, wz) + Math.SQRT2 * half > this.playRadius || this.biomes.at(wx, wz) !== 'wetlands' ||
          valueNoise2D(this.biomes.seed ^ 0x6db93f, wx / 9, wz / 9) < .52) continue;
      // Avoid hiding deposits, rocks, interaction props or collectable objects.
      const intersects = (object: { readonly x: number; readonly z: number; readonly radius: number }) => {
        const dx = Math.max(0, Math.abs(object.x - wx) - half), dz = Math.max(0, Math.abs(object.z - wz) - half);
        return dx * dx + dz * dz < (object.radius + .2) ** 2;
      };
      if (this.obstacles.some(intersects) || this.gatherables.some(intersects)) continue;
      result.push(Object.freeze({ columnX: x, columnZ: z, x: wx, z: wz, y: t.topLevel(x, z)! * size + .025, size }));
    }
    return result;
  }
}
