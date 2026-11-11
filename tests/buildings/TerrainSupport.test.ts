import { describe, expect, it } from 'vitest';
import { TerrainHeightfield } from '../../src/world/terrain/TerrainHeightfield';
import { terrainSupport } from '../../src/buildings/TerrainSupport';

describe('terrain footprint support', () => {
  it('includes a tiny steep triangle fragment crossing a footprint edge', () => {
    const terrain = new TerrainHeightfield({ seed: 1, sizeMeters: 40, resolution: 8, heightScale: 0, spawnFlatRadius: 2, rimHeight: 0 });
    // Set a known synthetic vertex on the production triangle topology.
    const data = (terrain as unknown as { heights: Float32Array }).heights;
    data.fill(0); data[5 * 9 + 5] = 5;
    const box = { minX: 4.999, maxX: 5.001, minZ: 4.999, maxZ: 5.001 };
    const result = terrainSupport(terrain, box)!;
    expect(result.slope).toBeGreaterThan(.7);
    expect(result.high).toBeCloseTo(5, 3);
    expect(result.low).toBeLessThan(result.high);
  });
  it('returns exact minimum and maximum along clipped triangle edges', () => {
    const terrain = new TerrainHeightfield({ seed: 1, sizeMeters: 40, resolution: 8, heightScale: 0, spawnFlatRadius: 2, rimHeight: 0 });
    const data = (terrain as unknown as { heights: Float32Array }).heights; data.fill(0);
    data[4 * 9 + 5] = 5; data[5 * 9 + 5] = 5;
    const support = terrainSupport(terrain, { minX: 1, maxX: 2, minZ: 1, maxZ: 2 })!;
    expect(support.low).toBeCloseTo(1); expect(support.high).toBeCloseTo(2);
    expect(support.slope).toBeCloseTo(Math.PI / 4);
  });
});
