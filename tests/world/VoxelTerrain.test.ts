import { describe, expect, it } from 'vitest';
import { VoxelTerrain, type VoxelTerrainOptions } from '../../src/world/terrain/VoxelTerrain';
import { TerrainHeightfield } from '../../src/world/terrain/TerrainHeightfield';

const options: VoxelTerrainOptions = {
  originX: -1, originZ: -1, columnsX: 2, columnsZ: 2, blockSize: 1, bottomLevel: -1,
  sampleHeight: (x, z) => x > 0 && z < 0 ? 1 : 0,
};

describe('read-only column voxel terrain', () => {
  it('samples column centres and exposes half-open solid cells including negative levels', () => {
    const terrain = new VoxelTerrain(options);
    expect(terrain.columnAt(-1, -1)).toEqual({ x: 0, z: 0 });
    expect(terrain.columnAt(-.001, -.001)).toEqual({ x: 0, z: 0 });
    expect(terrain.columnAt(0, -.1)).toEqual({ x: 1, z: 0 });
    expect(terrain.columnAt(1, 0)).toBeNull();
    expect(terrain.columnAt(NaN, 0)).toBeNull();
    expect(terrain.topLevel(1, 0)).toBe(1);
    expect(terrain.isSolid(1, -1, 0)).toBe(true);
    expect(terrain.isSolid(1, 0, 0)).toBe(true);
    expect(terrain.isSolid(1, 1, 0)).toBe(false);
    expect(terrain.isSolid(0, 0, 0)).toBe(false);
    expect(terrain.isSolid(-1, -1, 0)).toBe(false);
    expect(terrain.isSolid(1, -.5, 0)).toBe(false);
  });

  it('removes internal faces and emits correctly wound per-block sides', () => {
    const terrain = new VoxelTerrain(options), mesh = terrain.getSurfaceData();
    // Four tops, eight outside faces at level -1, two extra outside and two interior ledge faces.
    expect(mesh.faceCount).toBe(16);
    expect(mesh.positions.length).toBe(mesh.faceCount * 12);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.indices.length).toBe(mesh.faceCount * 6);
    for (let face = 0; face < mesh.faceCount; face++) {
      const offset = face * 12;
      const p = (n: number) => [mesh.positions[offset + n * 3]!, mesh.positions[offset + n * 3 + 1]!, mesh.positions[offset + n * 3 + 2]!];
      const a = p(0), b = p(1), c = p(2);
      const ab = b.map((v, i) => v - a[i]!), ac = c.map((v, i) => v - a[i]!);
      const normal = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
      expect(normal.map((v) => v === 0 ? 0 : v)).toEqual(Array.from(mesh.normals.slice(offset, offset + 3)));
      expect(mesh.indices.slice(face * 6, face * 6 + 6)).toEqual(new Uint32Array([face*4, face*4+1, face*4+2, face*4, face*4+2, face*4+3]));
    }
    // A fresh surface is returned rather than exposing mutable internal data.
    mesh.positions[0] = 999;
    expect(terrain.getSurfaceData().positions[0]).not.toBe(999);
  });

  it('reproduces a seeded procedural source exactly without modifying it', () => {
    const source = new TerrainHeightfield({ seed: 17, sizeMeters: 20, resolution: 10, heightScale: 4, spawnFlatRadius: 4, rimHeight: 3 });
    const voxelOptions: VoxelTerrainOptions = { originX: -10, originZ: -10, columnsX: 20, columnsZ: 20, blockSize: 1,
      bottomLevel: -32, sampleHeight: (x, z) => source.heightAt(x, z) };
    const before = source.heightAt(1.5, 2.5);
    const a = new VoxelTerrain(voxelOptions), b = new VoxelTerrain(voxelOptions);
    expect(a.getSurfaceData()).toEqual(b.getSurfaceData());
    expect(a.topLevel(11, 12)).toBe(Math.round(before) || 0);
    expect(source.heightAt(1.5, 2.5)).toBe(before);
  });

  it('uses block size consistently in world coordinates and side faces', () => {
    const terrain = new VoxelTerrain({ ...options, originX: 10, originZ: -4, blockSize: 2,
      sampleHeight: (x) => x < 12 ? 2 : 4 });
    expect(terrain.columnAt(11.99, -2.01)).toEqual({ x: 0, z: 0 });
    expect(terrain.columnAt(12, -2)).toEqual({ x: 1, z: 1 });
    expect(terrain.columnAt(14, -2)).toBeNull();
    const mesh = terrain.getSurfaceData();
    for (let i = 0; i < mesh.positions.length; i++) {
      expect(Math.abs(mesh.positions[i]! % 2)).toBe(0);
    }
  });

  it('rejects an excessively large mesh before allocating its face buffers', () => {
    const terrain = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 100, columnsZ: 100,
      blockSize: 1, bottomLevel: -1, sampleHeight: (x, z) => (Math.floor(x) + Math.floor(z)) % 2 ? 500 : 0 });
    expect(() => terrain.getSurfaceData()).toThrow(/mesh limit/);
  });

  it('rejects malformed and unbounded dimensions or heights', () => {
    expect(() => new VoxelTerrain({ ...options, blockSize: 0 })).toThrow(RangeError);
    expect(() => new VoxelTerrain({ ...options, columnsX: 513 })).toThrow(RangeError);
    expect(() => new VoxelTerrain({ ...options, sampleHeight: () => NaN })).toThrow(RangeError);
    expect(() => new VoxelTerrain({ ...options, sampleHeight: () => -2 })).toThrow(RangeError);
    expect(() => new VoxelTerrain({ ...options, sampleHeight: () => 1000 })).toThrow(RangeError);
  });
});
