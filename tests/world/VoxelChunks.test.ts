import { describe, expect, it } from 'vitest';
import { VoxelTerrain } from '../../src/world/terrain/VoxelTerrain';

describe('voxel column regions', () => {
  it('partitions the same exposed faces without seams, duplicates or artificial internal walls', () => {
    const terrain = new VoxelTerrain({ originX: -4, originZ: -3, columnsX: 8, columnsZ: 6, blockSize: 1, bottomLevel: -5,
      sampleHeight: (x, z) => Math.floor((Math.sin(x * 1.7) + Math.cos(z * .9)) * 2) });
    const faces = (data: ReturnType<VoxelTerrain['getSurfaceData']>) => Array.from({ length: data.faceCount }, (_, i) =>
      [...data.positions.slice(i * 12, i * 12 + 12), ...data.normals.slice(i * 12, i * 12 + 3)].join(','));
    const whole = faces(terrain.getSurfaceData()).sort(), split: string[] = [];
    for (let z = 0; z < 6; z += 2) for (let x = 0; x < 8; x += 3) {
      const range = { minX: x, maxX: Math.min(8, x + 3), minZ: z, maxZ: Math.min(6, z + 2) };
      const data = terrain.getSurfaceData(range);
      expect(data.faceCount).toBe(terrain.getSurfaceFaceCount(range));
      split.push(...faces(data));
    }
    expect(split.sort()).toEqual(whole);
    expect(new Set(split).size).toBe(split.length);
  });
  it('validates region boundaries before allocation', () => {
    const terrain = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 2, columnsZ: 2, blockSize: 1, bottomLevel: -1, sampleHeight: () => 0 });
    for (const range of [{ minX: -1, maxX: 1, minZ: 0, maxZ: 1 }, { minX: 0, maxX: 3, minZ: 0, maxZ: 1 },
      { minX: 0, maxX: 1, minZ: 1, maxZ: 1 }, { minX: .5, maxX: 1, minZ: 0, maxZ: 2 }])
      expect(() => terrain.getSurfaceData(range)).toThrow(RangeError);
  });
});
