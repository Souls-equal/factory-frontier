import { describe, expect, it } from 'vitest';

import {
  GENERATED_MAX_SLOPE_TANGENT,
  TerrainHeightfield,
  type TerrainOptions,
} from '../../src/world/terrain/TerrainHeightfield';

const BASE_OPTIONS: TerrainOptions = {
  seed: 4242,
  sizeMeters: 120,
  resolution: 60,
  heightScale: 12,
  spawnFlatRadius: 14,
  rimHeight: 18,
};

function createTerrain(overrides: Partial<TerrainOptions> = {}): TerrainHeightfield {
  return new TerrainHeightfield({ ...BASE_OPTIONS, ...overrides });
}

describe('TerrainHeightfield', () => {
  it('is deterministic for a given seed', () => {
    const first = createTerrain();
    const second = createTerrain();

    for (let i = 0; i <= 12; i += 1) {
      const x = -50 + i * 8;
      const z = -40 + i * 6;
      expect(second.heightAt(x, z)).toBe(first.heightAt(x, z));
    }
  });

  it('produces a different surface for a different seed', () => {
    const first = createTerrain();
    const other = createTerrain({ seed: 99 });

    expect(other.heightAt(30, -30)).not.toBe(first.heightAt(30, -30));
  });

  it('matches the grid heights exactly at grid vertices', () => {
    const terrain = createTerrain();
    const side = terrain.resolution + 1;

    for (const [i, j] of [
      [0, 0],
      [3, 7],
      [side - 1, side - 1],
      [side - 1, 0],
    ] as const) {
      const x = terrain.bounds.minX + i * terrain.cellSize;
      const z = terrain.bounds.minZ + j * terrain.cellSize;
      expect(terrain.heightAt(x, z)).toBeCloseTo(terrain.heightAtGrid(i, j), 6);
    }
  });

  it('interpolates over the same triangles the render mesh uses', () => {
    const terrain = createTerrain();
    const data = terrain.getRenderData();
    const side = terrain.resolution + 1;

    // Sample a cell centre: it must lie on the rendered triangles, not on a
    // separately invented surface.
    const i = 12;
    const j = 18;
    const cellX = terrain.bounds.minX + (i + 0.25) * terrain.cellSize;
    const cellZ = terrain.bounds.minZ + (j + 0.25) * terrain.cellSize;

    const h00 = terrain.heightAtGrid(i, j);
    const h10 = terrain.heightAtGrid(i + 1, j);
    const h01 = terrain.heightAtGrid(i, j + 1);
    const expected = h00 + (h10 - h00) * 0.25 + (h01 - h00) * 0.25;

    expect(terrain.heightAt(cellX, cellZ)).toBeCloseTo(expected, 6);

    // Every index in the render buffer must reference a vertex whose Y equals
    // the collision height at that vertex.
    const indices = data.indices;
    let mismatches = 0;
    for (let index = 0; index < indices.length; index += 1) {
      const vertex = indices[index] ?? 0;
      const vi = vertex % side;
      const vj = Math.floor(vertex / side);
      const x = data.positions[vertex * 3] ?? Number.NaN;
      const z = data.positions[vertex * 3 + 2] ?? Number.NaN;
      const y = data.positions[vertex * 3 + 1] ?? Number.NaN;

      if (Math.abs(terrain.heightAt(x, z) - y) > 1e-4) {
        mismatches += 1;
      }
      if (Math.abs(terrain.heightAtGrid(vi, vj) - y) > 1e-4) {
        mismatches += 1;
      }
    }
    expect(mismatches).toBe(0);
  });

  it('reports bounds and rejects coordinates outside the finite area', () => {
    const terrain = createTerrain();

    expect(terrain.contains(0, 0)).toBe(true);
    expect(terrain.contains(terrain.bounds.maxX - 0.01, terrain.bounds.minZ + 0.01)).toBe(true);
    expect(terrain.contains(terrain.bounds.maxX + 1, 0)).toBe(false);
    expect(terrain.contains(0, Number.NaN)).toBe(false);

    // Out-of-bounds queries clamp to the edge instead of extrapolating.
    const insideEdge = terrain.heightAt(terrain.bounds.maxX, 0);
    expect(terrain.heightAt(terrain.bounds.maxX + 500, 0)).toBeCloseTo(insideEdge, 6);
  });

  it('throws on non-finite queries and invalid grid indices', () => {
    const terrain = createTerrain();

    expect(() => terrain.heightAt(Number.NaN, 0)).toThrow(RangeError);
    expect(() => terrain.clampXZ(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => terrain.heightAtGrid(-1, 0)).toThrow(RangeError);
    expect(() => terrain.heightAtGrid(0, terrain.resolution + 5)).toThrow(RangeError);
    expect(() => terrain.heightAtGrid(1.5, 0)).toThrow(RangeError);
  });

  it('keeps the spawn clearing flat and walkable', () => {
    const terrain = createTerrain();

    expect(Math.abs(terrain.heightAt(0, 0))).toBeLessThan(0.05);
    expect(terrain.slopeAt(0, 0)).toBeLessThan(0.05);
    expect(Math.abs(terrain.heightAt(4, 4))).toBeLessThan(0.35);
  });

  it('raises a boundary ridge so the world has a horizon', () => {
    const terrain = createTerrain();
    const edgeHeight = terrain.heightAt(terrain.bounds.maxX - 0.5, 0);
    const interiorHeight = terrain.heightAt(0, 0);

    expect(edgeHeight).toBeGreaterThan(interiorHeight + 8);
  });

  it('keeps neighbouring samples smooth (no cliffs between grid cells)', () => {
    const terrain = createTerrain();
    let maxStep = 0;

    for (let i = 0; i < terrain.resolution; i += 1) {
      for (const j of [0, 17, 30, 44, terrain.resolution]) {
        const a = terrain.heightAtGrid(i, j);
        const b = terrain.heightAtGrid(i + 1, j);
        maxStep = Math.max(maxStep, Math.abs(b - a));
        const c = terrain.heightAtGrid(j, i);
        const d = terrain.heightAtGrid(j, i + 1);
        maxStep = Math.max(maxStep, Math.abs(d - c));
      }
    }

    // The relaxation pass guarantees a bounded gradient everywhere.
    const limit = terrain.cellSize * GENERATED_MAX_SLOPE_TANGENT;
    expect(maxStep).toBeLessThanOrEqual(limit * 1.02);
  });

  it('reports unit normals that always point up', () => {
    const terrain = createTerrain();

    for (const [x, z] of [
      [0, 0],
      [20, -15],
      [-40, 30],
      [terrain.bounds.maxX - 2, 0],
    ] as const) {
      const normal = terrain.normalAt(x, z);
      expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 6);
      expect(normal.y).toBeGreaterThan(0);
      expect(terrain.slopeAt(x, z)).toBeGreaterThanOrEqual(0);
      expect(terrain.slopeAt(x, z)).toBeLessThan(Math.PI / 2);
    }
  });

  it('exposes render data sized to the configuration', () => {
    const terrain = createTerrain({ resolution: 20 });
    const data = terrain.getRenderData();
    const side = 21;

    expect(data.vertexCount).toBe(side * side);
    expect(data.triangleCount).toBe(20 * 20 * 2);
    expect(data.positions).toHaveLength(side * side * 3);
    expect(data.normals).toHaveLength(side * side * 3);
    expect(data.indices).toHaveLength(20 * 20 * 6);
    expect(terrain.maxHeight).toBeGreaterThan(0);

    for (const index of data.indices) {
      expect(index).toBeLessThan(data.vertexCount);
    }
  });

  it('produces finite, unit-length render normals', () => {
    const terrain = createTerrain({ resolution: 20 });
    const { positions, normals } = terrain.getRenderData();

    for (let index = 0; index < positions.length; index += 1) {
      expect(Number.isFinite(positions[index])).toBe(true);
    }
    for (let vertex = 0; vertex < normals.length / 3; vertex += 1) {
      const length = Math.hypot(
        normals[vertex * 3] ?? 0,
        normals[vertex * 3 + 1] ?? 0,
        normals[vertex * 3 + 2] ?? 0,
      );
      expect(length).toBeCloseTo(1, 5);
    }
  });

  it('rejects an invalid configuration', () => {
    expect(() => createTerrain({ sizeMeters: 0 })).toThrow(RangeError);
    expect(() => createTerrain({ resolution: 1 })).toThrow(RangeError);
  });
});
