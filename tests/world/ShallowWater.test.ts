import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { BiomeField, type Biome } from '../../src/world/Biomes';
import { valueNoise2D } from '../../src/world/noise';
import { generateGatherables } from '../../src/resources/Gatherables';
import { generateDeposits } from '../../src/resources/ResourceDeposit';
import { distributeBiomeDeposits } from '../../src/resources/BiomeDeposits';
import { snapFootprint } from '../../src/buildings/Transform';
import { terrainSupport } from '../../src/buildings/TerrainSupport';

/** Former classifier: wetland cells were previously part of forests. */
class PreviousBiomes extends BiomeField {
  constructor(seed: number, private readonly initialSpawn: { x: number; z: number }) { super(seed, initialSpawn); }
  override at(x: number, z: number): Biome {
    if (Math.hypot(x - this.initialSpawn.x, z - this.initialSpawn.z) < 24) return 'grassland';
    const moisture = valueNoise2D(this.seed ^ 0x642c57, x / 42, z / 42);
    const ruggedness = valueNoise2D(this.seed ^ 0x1e63a1, x / 48, z / 48);
    return ruggedness > .68 ? 'highlands' : moisture < .37 ? 'desert' : moisture > .61 ? 'forest' : 'grassland';
  }
}

describe('wetland puddles', () => {
  it('generates stable, bounded wet cells with seamless partitioning and no resource overlap', () => {
    const config = createGameConfig(), world = createWorld(config), again = createWorld(config), terrain = world.terrain;
    const full = { minX: 0, minZ: 0, maxX: terrain.columnsX, maxZ: terrain.columnsZ };
    const cells = world.shallowWater.cells(full);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells).toEqual(again.shallowWater.cells(full));
    const parts = [];
    for (let z = 0; z < terrain.columnsZ; z += 37) for (let x = 0; x < terrain.columnsX; x += 37)
      parts.push(...world.shallowWater.cells({ minX: x, minZ: z, maxX: Math.min(x + 37, terrain.columnsX), maxZ: Math.min(z + 37, terrain.columnsZ) }));
    const sort = (a: typeof cells) => [...a].sort((a, b) => a.columnZ - b.columnZ || a.columnX - b.columnX);
    expect(sort(parts)).toEqual(sort(cells));
    expect(new Set(cells.map(c => `${c.columnX},${c.columnZ}`)).size).toBe(cells.length);
    for (const c of cells) {
      expect(world.biomes.at(c.x, c.z)).toBe('wetlands');
      expect(Math.hypot(c.x, c.z) + Math.SQRT2 * c.size / 2).toBeLessThanOrEqual(world.playAreaRadius);
      expect(Math.hypot(c.x - world.spawn.x, c.z - world.spawn.z)).toBeGreaterThanOrEqual(24);
      expect(c.y).toBeCloseTo(terrain.heightAt(c.x, c.z) + .025, 8);
      for (const object of [...world.obstacleDefinitions, ...world.gatherables.definitions]) {
        const dx = Math.max(0, Math.abs(object.x - c.x) - c.size / 2), dz = Math.max(0, Math.abs(object.z - c.z) - c.size / 2);
        expect(dx * dx + dz * dz).toBeGreaterThanOrEqual((object.radius + .2) ** 2 - 1e-9);
      }
    }
    expect(() => world.shallowWater.cells({ ...full, maxX: full.maxX + 1 })).toThrow(RangeError);
    expect(() => world.shallowWater.cells({ ...full, minZ: 1.5 })).toThrow(RangeError);
    const other = createWorld(createGameConfig({ world: { seed: config.world.seed + 1 } }));
    expect(other.shallowWater.cells(full)).not.toEqual(cells);
  });

  it('preserves former seeded deposits and gatherables while reclassifying forest as wetland', () => {
    for (const seed of [1, 123, 20261111]) {
      const config = createGameConfig({ world: { seed } }), world = createWorld(config), terrain = world.terrain;
      const oldBiomes = new PreviousBiomes(seed, world.spawn), miner = world.buildings.registry.get('miner-mk1');
      const suitable = (x: number, z: number) => {
        const f = snapFootprint(miner, x, z, 0, config.construction.gridSize).footprint;
        if (!terrain.contains(f.minX, f.minZ) || !terrain.contains(f.maxX, f.maxZ) ||
          [[f.minX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.minZ], [f.maxX, f.maxZ]]
            .some(([px, pz]) => Math.hypot(px!, pz!) > config.controls.playAreaRadius)) return false;
        const support = terrainSupport(terrain, f);
        return !!support && support.slope <= miner.maxSlope && support.high - support.low <= miner.maxGroundVariation;
      };
      const originalObstacles = world.obstacleDefinitions.filter(o => !o.id.startsWith('deposit-'));
      const baseline = generateDeposits(terrain, originalObstacles, seed, world.spawn, config.resources, config.controls.playAreaRadius, suitable);
      const previous = distributeBiomeDeposits(baseline, terrain, originalObstacles, oldBiomes, seed, world.spawn, config.controls.playAreaRadius, suitable);
      expect(world.deposits).toEqual(previous);
      const oldGatherables = generateGatherables(terrain, world.obstacleDefinitions, previous, seed, world.spawn, config.controls.playAreaRadius, oldBiomes);
      expect(world.gatherables.definitions).toEqual(oldGatherables);
    }
  });
});
