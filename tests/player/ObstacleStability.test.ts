import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { GameClock } from '../../src/core/GameClock';
import { Game } from '../../src/core/Game';
import { FakeEngine } from '../helpers/FakeEngine';
import { MockScheduler } from '../helpers/MockScheduler';
import { PlayerController, type PlayerInput } from '../../src/player/PlayerController';
import { ObstacleField, type ObstacleDefinition } from '../../src/world/ObstacleField';
import { createWorld } from '../../src/world/World';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const config = createGameConfig();
const dt = config.simulation.fixedTimestepMs / 1000;
const idle: PlayerInput = { moveX: 0, moveZ: 0, sprint: false, lookDeltaX: 0, lookDeltaY: 0 };
const forward = { ...idle, moveZ: 1 };
function rock(x: number, z: number, radius = 2): ObstacleDefinition {
  return { id: `${x}:${z}`, kind: 'boulder', x, y: -5, z, radius, height: 20, yaw: 0, variant: 0 };
}
function player(field: ObstacleField, x = 0, z = 4, terrain?: TerrainQuery) {
  return new PlayerController({ controls: config.controls, player: config.player, obstacles: field,
    spawn: { x, z }, ...(terrain ? { terrain } : {}) });
}

// The game uses cylinders. A large cylinder approximates a wall near the origin.
const wall = () => new ObstacleField([rock(0, -100, 100)]);

describe('stable obstacle contacts', () => {
  it('does not turn depenetration into velocity, even for an initially overlapping spawn', () => {
    const field = new ObstacleField([rock(0, 0)]);
    const p = player(field, 0.3, 2.1);
    p.step(dt, idle);
    expect(Math.hypot(p.position.x, p.position.z)).toBeGreaterThanOrEqual(2.4 - 1e-7);
    expect(p.horizontalSpeed).toBeLessThan(1e-7);
    for (let i = 0; i < 400; i++) p.step(dt, forward);
    expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
  });

  it('does not launch from the reproduced floating-point boulder contact', () => {
    // Before the fix, step 10 teleported to the +X escape sample and produced
    // 31.52 m/s: round-off was mistaken for a cluster requiring escape.
    const x = 1.447567;
    const z = 0.023544;
    const angle = 0.01;
    const distance = 0.71 + config.player.radius + 0.5;
    const p = new PlayerController({
      controls: config.controls, player: config.player,
      obstacles: new ObstacleField([rock(x, z, 0.71)]),
      spawn: { x: x + Math.sin(angle) * distance, z: z + Math.cos(angle) * distance, yaw: angle },
    });
    for (let i = 0; i < 1200; i++) {
      const previous = p.position;
      p.step(dt, forward);
      expect(Math.hypot(p.position.x - previous.x, p.position.z - previous.z))
        .toBeLessThanOrEqual(config.controls.moveSpeed * dt + 1e-7);
      expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
      expect(Math.hypot(p.position.x - x, p.position.z - z)).toBeGreaterThanOrEqual(1.11 - 1e-7);
    }
    expect(p.horizontalSpeed).toBeLessThan(1e-6);
  });

  it('holds against a wall for a minute without recoil or accumulated velocity', () => {
    const p = player(wall(), 0, 2);
    for (let i = 0; i < 1200; i++) {
      p.step(dt, forward);
      expect(p.position.z).toBeGreaterThanOrEqual(config.player.radius - 1e-7);
      expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
    }
    expect(p.position.z).toBeCloseTo(config.player.radius, 5);
    expect(p.position.x).toBeCloseTo(0, 5);
    expect(p.horizontalSpeed).toBeLessThan(1e-6);
    p.step(dt, idle);
    expect(p.horizontalSpeed).toBeLessThan(1e-6);
  });

  it('slides tangentially while pressing diagonally against the wall', () => {
    const p = player(wall(), 0, 0.4);
    for (let i = 0; i < 30; i++) p.step(dt, { ...forward, moveX: 1 });
    expect(p.position.x).toBeGreaterThan(2);
    expect(Math.hypot(p.position.x, p.position.z + 100)).toBeGreaterThanOrEqual(100.4 - 1e-6);
    expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
  });

  it('stays stable in a two-contact corner', () => {
    const p = player(new ObstacleField([rock(0, -100, 100), rock(-100, 0, 100)]), 1, 1);
    for (let i = 0; i < 800; i++) {
      p.step(dt, { ...forward, moveX: -1 });
      expect(p.position.x).toBeGreaterThanOrEqual(0.39);
      expect(p.position.z).toBeGreaterThanOrEqual(0.39);
      expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
    }
    expect(p.position.x).toBeLessThan(0.42);
    expect(p.position.z).toBeLessThan(0.42);
  });

  it('remains stable in a non-orthogonal overlapping-cylinder corner', () => {
    const p = player(new ObstacleField([rock(-1, -1, 1.6), rock(1, -1, 1.6)]), 0, 2);
    for (let i = 0; i < 1200; i++) {
      const before = p.position;
      p.step(dt, forward);
      expect(Math.hypot(p.position.x - before.x, p.position.z - before.z))
        .toBeLessThanOrEqual(config.controls.moveSpeed * dt + 1e-6);
      expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
      expect(Math.hypot(p.position.x + 1, p.position.z + 1)).toBeGreaterThanOrEqual(2 - 1e-6);
      expect(Math.hypot(p.position.x - 1, p.position.z + 1)).toBeGreaterThanOrEqual(2 - 1e-6);
    }
  });

  it('returns to the same contact after repeated approaches', () => {
    const p = player(wall(), 0, 2);
    for (let attempt = 0; attempt < 8; attempt++) {
      for (let i = 0; i < 30; i++) p.step(dt, forward);
      expect(p.position.z).toBeCloseTo(0.4, 5);
      expect(p.horizontalSpeed).toBeLessThan(1e-6);
      for (let i = 0; i < 10; i++) p.step(dt, { ...idle, moveZ: -1 });
    }
  });

  it('keeps jump and gravity independent of wall contact', () => {
    const field = wall();
    const touching = player(field, 0, 0.4);
    const free = player(new ObstacleField([]), 0, 4);
    for (let i = 0; i < 60; i++) {
      const input = { ...forward, jump: i === 0 };
      touching.step(dt, input); free.step(dt, input);
      expect(touching.position.y).toBeCloseTo(free.position.y, 8);
      expect(touching.verticalSpeed).toBeCloseTo(free.verticalSpeed, 8);
      expect(touching.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
    }
    expect(touching.isGrounded).toBe(true);
  });

  it('uses fixed steps despite irregular frames and long pauses', () => {
    const p = player(wall(), 0, 2);
    const clock = new GameClock(config.simulation);
    for (let frame = 0; frame < 500; frame++) {
      const steps = clock.advance([16, 3000, 2, 100, 33][frame % 5] ?? 0);
      for (let i = 0; i < steps; i++) p.step(clock.fixedTimestepMs / 1000, forward);
      expect(p.position.z).toBeGreaterThanOrEqual(0.4 - 1e-6);
      expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
    }
    expect(p.position.z).toBeCloseTo(0.4, 5);
  });

  it('remains stable through actual Game loop frame spikes', async () => {
    const p = player(wall(), 0, 2);
    const scheduler = new MockScheduler();
    const game = new Game({ config, engine: new FakeEngine(), scheduler });
    const stepSizes: number[] = [];
    game.registerSystem({ id: 'collision-test', fixedUpdate: (ms) => {
      stepSizes.push(ms);
      p.step(ms / 1000, forward);
    } });
    await game.init();
    game.start();
    scheduler.advance(16);
    for (let frame = 0; frame < 200; frame++) {
      scheduler.advance([16, 3000, 5, 90][frame % 4] ?? 0);
      expect(p.position.z).toBeGreaterThanOrEqual(0.4 - 1e-6);
      expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
    }
    expect(stepSizes.length).toBeGreaterThan(50);
    expect(stepSizes.every((ms) => ms === config.simulation.fixedTimestepMs)).toBe(true);
    expect(p.position.z).toBeCloseTo(0.4, 5);
    game.dispose();
  });

  it('stays grounded and stable against a wall on a gentle slope', () => {
    const terrain: TerrainQuery = {
      bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 }, size: 400, resolution: 1, cellSize: 1,
      heightAt: (x) => 0.1 * x, normalAt: () => ({ x: -0.099503719, y: 0.99503719, z: 0 }),
      slopeAt: () => Math.atan(0.1), contains: () => true, clampXZ: (x, z) => ({ x, z }),
    };
    const p = player(wall(), 0, 2, terrain);
    for (let i = 0; i < 500; i++) {
      p.step(dt, forward);
      expect(p.isGrounded).toBe(true);
      expect(p.position.y).toBeCloseTo(terrain.heightAt(p.position.x, p.position.z), 6);
      expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
    }
    expect(p.position.z).toBeCloseTo(0.4, 5);
  });

  it('does not launch when pressing into generated world boulders', () => {
    const world = createWorld(config);
    const boulders = world.obstacleDefinitions.filter((obstacle) => obstacle.kind === 'boulder').slice(0, 8);
    expect(boulders).toHaveLength(8);
    for (const obstacle of boulders) {
      const p = new PlayerController({ controls: config.controls, player: config.player,
        terrain: world.terrain, obstacles: world.obstacles,
        spawn: { x: obstacle.x, z: obstacle.z + obstacle.radius + config.player.radius + 0.5, yaw: 0 },
      });
      for (let step = 0; step < 400; step++) {
        p.step(dt, forward);
        expect(p.horizontalSpeed).toBeLessThanOrEqual(config.controls.moveSpeed + 1e-6);
      }
    }
  });

  it('does not tunnel through a thin obstacle in a large direct step', () => {
    const p = player(new ObstacleField([rock(0, 0, 0.1)]), 0, 1);
    p.step(0.25, { ...forward, sprint: true });
    expect(p.position.z).toBeGreaterThanOrEqual(0.5 - 1e-7);
  });
});
