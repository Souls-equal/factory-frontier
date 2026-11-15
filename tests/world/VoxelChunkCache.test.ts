import { describe, expect, it, vi } from 'vitest';
import { VoxelTerrain, type VoxelTerrainOptions } from '../../src/world/terrain/VoxelTerrain';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';

const options: VoxelTerrainOptions = {
  originX: -6.5, originZ: -4.5, columnsX: 13, columnsZ: 9, blockSize: 1, bottomLevel: -8,
  sampleHeight: (x, z) => Math.round(2 * Math.sin(x) + 2 * Math.cos(z)),
};

describe('bounded voxel data cache', () => {
  it('evicts least recently used chunks and regenerates exactly, including partial edge chunks', () => {
    const sampleHeight = vi.fn(options.sampleHeight);
    const terrain = new VoxelTerrain({ ...options, sampleHeight, chunkCache: { columns: 4, maxChunks: 2 } });
    expect(sampleHeight).toHaveBeenCalledTimes(117); // eager validation, no retained chunks
    expect(terrain.cachedChunkCount).toBe(0);
    const a = terrain.topLevel(0, 0), b = terrain.topLevel(4, 0);
    expect(terrain.cachedChunkCount).toBe(2);
    terrain.topLevel(0, 0); // refresh A; B becomes least recently used
    terrain.topLevel(12, 8); // one-column, one-row edge chunk
    expect(terrain.cachedChunkCount).toBe(2);
    const count = sampleHeight.mock.calls.length;
    expect(terrain.topLevel(0, 0)).toBe(a);
    expect(sampleHeight).toHaveBeenCalledTimes(count);
    expect(terrain.topLevel(4, 0)).toBe(b);
    expect(sampleHeight).toHaveBeenCalledTimes(count + 16);
    expect(terrain.cachedChunkCount).toBe(2);
    expect(terrain.topLevel(-1, 0)).toBeNull();
    expect(terrain.cachedChunkCount).toBe(2);
  });

  it('matches eager terrain for all columns, height, support, and seam-free surfaces after evictions', () => {
    const eager = new VoxelTerrain(options);
    const cached = new VoxelTerrain({ ...options, chunkCache: { columns: 4, maxChunks: 3 } });
    expect(cached.maxHeight).toBe(eager.maxHeight);
    for (let z = 0; z < options.columnsZ; z++) for (let x = 0; x < options.columnsX; x++)
      expect(cached.topLevel(x, z)).toBe(eager.topLevel(x, z));
    expect(cached.heightAt(-1.2, 2.4)).toBe(eager.heightAt(-1.2, 2.4));
    expect(cached.groundBelow(0, 0, 10, .6)).toBe(eager.groundBelow(0, 0, 10, .6));
    for (let z = 0; z < options.columnsZ; z += 3) for (let x = 0; x < options.columnsX; x += 3) {
      const r = { minX: x, minZ: z, maxX: Math.min(x + 3, options.columnsX), maxZ: Math.min(z + 3, options.columnsZ) };
      expect(cached.getSurfaceData(r)).toEqual(eager.getSurfaceData(r));
    }
    expect(cached.cachedChunkCount).toBeLessThanOrEqual(3);
  });

  it('validates cache options and invalid samples even before first access', () => {
    for (const chunkCache of [{ columns: 0, maxChunks: 1 }, { columns: 1, maxChunks: 0 }, { columns: 1.5, maxChunks: 1 }])
      expect(() => new VoxelTerrain({ ...options, chunkCache })).toThrow(RangeError);
    expect(() => new VoxelTerrain({ ...options, sampleHeight: () => NaN, chunkCache: { columns: 4, maxChunks: 1 } })).toThrow(RangeError);
  });

  it('enables bounded data chunks in the real world assembly', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } }));
    expect(world.terrain.cachedChunkCount).toBeGreaterThan(0);
    expect(world.terrain.cachedChunkCount).toBeLessThanOrEqual(16);
  });
});
