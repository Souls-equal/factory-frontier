import { describe, expect, it } from 'vitest';
import { createGameConfig, DEFAULT_WORLD_CONFIG } from '../../src/core/Configuration';
import { worldSeedOverride } from '../../src/core/WorldSeed';
import { createWorld } from '../../src/world/World';

describe('world seed URL setting', () => {
  it('accepts the supported integer range and reproduces distinct seeded worlds', () => {
    for (const n of [0, 1, 123, 2147483647]) expect(worldSeedOverride(new URLSearchParams(`seed=${n}`))).toBe(n);
    const config = (seed: number) => createGameConfig({ world: { seed, sizeMeters: 80, resolution: 32 } });
    const a = createWorld(config(worldSeedOverride(new URLSearchParams('seed=123'))!));
    const b = createWorld(config(123)), c = createWorld(config(124));
    expect(a.obstacleDefinitions).toEqual(b.obstacleDefinitions);
    expect(a.obstacleDefinitions).not.toEqual(c.obstacleDefinitions);
    expect(a.terrain.getSurfaceData()).toEqual(b.terrain.getSurfaceData());
    expect(a.terrain.getSurfaceData()).not.toEqual(c.terrain.getSurfaceData());
  });
  it('falls back safely for malformed, repeated and out-of-range inputs', () => {
    for (const text of ['', 'seed=', 'seed=-1', 'seed=1.5', 'seed=2147483648', 'seed=NaN',
      'seed=0x10', 'seed=3x', 'seed=1&seed=2']) {
      expect(worldSeedOverride(new URLSearchParams(text))).toBeUndefined();
      expect(worldSeedOverride(new URLSearchParams(text)) ?? DEFAULT_WORLD_CONFIG.seed).toBe(20261111);
    }
  });
});
