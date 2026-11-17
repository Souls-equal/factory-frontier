import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { BiomeDecorationField } from '../../src/world/BiomeDecorations';

describe('procedural chunk decoration data', () => {
  it('partitions precisely, regenerates regardless of visit order, and stays away from natural objects', () => {
    const world = createWorld(createGameConfig()), field = new BiomeDecorationField(world), bounds = world.terrain.bounds;
    const whole = field.inBounds(bounds);
    expect(whole.length).toBeGreaterThan(100);
    const collected = [];
    for (let z = bounds.minZ; z < bounds.maxZ; z += 17.3) for (let x = bounds.minX; x < bounds.maxX; x += 17.3)
      collected.push(...field.inBounds({ minX: x, minZ: z, maxX: Math.min(x + 17.3, bounds.maxX), maxZ: Math.min(z + 17.3, bounds.maxZ) }));
    const sort = (a: typeof whole) => [...a].sort((a, b) => a.decoration.z - b.decoration.z || a.decoration.x - b.decoration.x);
    expect(sort(collected)).toEqual(sort(whole));
    expect(new Set(whole.map(({ decoration: d }) => `${d.x},${d.z}`)).size).toBe(whole.length);
    const first = { minX: -70, maxX: 0, minZ: -80, maxZ: 0 }, other = { minX: 0, maxX: 80, minZ: 0, maxZ: 80 };
    const original = field.inBounds(first); field.inBounds(other);
    expect(field.inBounds(first)).toEqual(original);
    for (const { decoration: d } of whole) {
      for (const o of world.obstacleDefinitions) expect(Math.hypot(o.x - d.x, o.z - d.z)).toBeGreaterThanOrEqual(o.radius + .65);
      for (const o of world.gatherables.definitions) expect(Math.hypot(o.x - d.x, o.z - d.z)).toBeGreaterThanOrEqual(o.radius + .7);
      expect(d.y).toBe(world.terrain.heightAt(d.x, d.z) + .01);
    }
    expect(field.inBounds({ minX: 1000, maxX: 1001, minZ: 1000, maxZ: 1001 })).toEqual([]);
    expect(() => field.inBounds({ minX: 0, maxX: 0, minZ: 0, maxZ: 1 })).toThrow(RangeError);
  });
});
