import { describe, expect, it } from 'vitest';

import { createGameConfig } from '../../src/core/Configuration';
import { PlayerController, type PlayerInput } from '../../src/player/PlayerController';
import { ObstacleField } from '../../src/world/ObstacleField';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const config = createGameConfig();
const controls = config.controls;
const playerConfig = config.player;

interface RampOptions {
  /** Rise in metres per metre travelled along +Z (negative = downhill). */
  readonly slopeTangent: number;
  readonly bounds?: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

/** Synthetic ramp terrain: h = -z * slope (so +z is downhill when positive). */
function rampTerrain(options: RampOptions): TerrainQuery {
  const bounds = options.bounds ?? { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
  const normalLength = Math.hypot(options.slopeTangent, 1);

  return {
    bounds,
    size: bounds.maxX - bounds.minX,
    resolution: 1,
    cellSize: 1,
    heightAt: (_x, z) => -z * options.slopeTangent,
    normalAt: () => ({
      x: 0,
      y: 1 / normalLength,
      z: options.slopeTangent / normalLength,
    }),
    slopeAt: () => Math.atan(Math.abs(options.slopeTangent)),
    contains: (x, z) =>
      x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ,
    clampXZ: (x, z) => ({
      x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
      z: Math.min(Math.max(z, bounds.minZ), bounds.maxZ),
    }),
  };
}

function input(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    ...overrides,
  };
}

function simulate(
  player: PlayerController,
  seconds: number,
  playerInput: PlayerInput,
  stepSeconds = 0.05,
): void {
  const steps = Math.max(1, Math.round(seconds / stepSeconds));
  for (let step = 0; step < steps; step += 1) {
    player.step(stepSeconds, playerInput);
  }
}

function createPlayer(options: {
  terrain?: TerrainQuery;
  obstacles?: ObstacleField;
  spawn?: { x: number; z: number; y?: number; yaw?: number };
}) {
  return new PlayerController({
    controls,
    player: playerConfig,
    ...(options.terrain !== undefined ? { terrain: options.terrain } : {}),
    ...(options.obstacles !== undefined ? { obstacles: options.obstacles } : {}),
    ...(options.spawn !== undefined ? { spawn: options.spawn } : {}),
  });
}

describe('Player physics — gravity and grounding', () => {
  it('falls under gravity and lands on the surface', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0, y: 12 } });

    expect(player.isGrounded).toBe(false);
    simulate(player, 0.3, input());
    expect(player.position.y).toBeGreaterThan(0);
    expect(player.verticalSpeed).toBeLessThan(0);

    simulate(player, 3, input());
    expect(player.position.y).toBeCloseTo(0, 5);
    expect(player.isGrounded).toBe(true);
    expect(player.verticalSpeed).toBe(0);
  });

  it('applies gravity acceleration independent of input', () => {
    const free = createPlayer({ spawn: { x: 0, z: 0, y: 100 } });
    free.step(0.05, input());
    const firstSpeed = free.verticalSpeed;
    free.step(0.05, input());
    const secondSpeed = free.verticalSpeed;

    expect(firstSpeed).toBeCloseTo(-playerConfig.gravity * 0.05, 6);
    expect(secondSpeed).toBeCloseTo(-playerConfig.gravity * 0.1, 6);
  });

  it('never falls through the terrain, even with a huge step', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0, y: 400 } });
    player.step(0.25, input());

    expect(player.position.y).toBeGreaterThanOrEqual(0);
  });

  it('keeps the player exactly on the ground when idle on flat terrain', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0 } });
    const startY = player.position.y;

    simulate(player, 2, input());

    expect(player.position.y).toBe(startY);
    expect(player.isGrounded).toBe(true);
    expect(player.verticalSpeed).toBe(0);
  });
});

describe('Player physics — jumping', () => {
  it('jumps only when grounded', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0 } });

    player.step(0.05, input({ jump: true }));
    expect(player.verticalSpeed).toBeGreaterThan(0);
    expect(player.isGrounded).toBe(false);

    const speedAfterJump = player.verticalSpeed;
    player.step(0.05, input({ jump: true }));
    // Airborne: the second request must not add upward velocity.
    expect(player.verticalSpeed).toBeLessThan(speedAfterJump);
  });

  it('does not repeat a jump while the key is held', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0 } });
    let jumps = 0;
    let previousSpeed = 0;

    for (let step = 0; step < 120; step += 1) {
      player.step(0.05, input({ jump: true }));
      if (previousSpeed <= 0 && player.verticalSpeed > 0) {
        jumps += 1;
      }
      previousSpeed = player.verticalSpeed;
    }

    expect(jumps).toBe(1);
  });

  it('can jump again after releasing and landing', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0 } });

    player.step(0.05, input({ jump: true }));
    simulate(player, 2, input({ jump: true }));

    expect(player.isGrounded).toBe(true);

    player.step(0.05, input({ jump: false }));
    player.step(0.05, input({ jump: true }));

    expect(player.verticalSpeed).toBeGreaterThan(0);
  });

  it('reaches a jump height consistent with the configured impulse', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0 } });
    let apex = 0;

    player.step(0.05, input({ jump: true }));
    for (let step = 0; step < 60; step += 1) {
      player.step(0.05, input());
      apex = Math.max(apex, player.position.y);
    }

    const expectedApex = (playerConfig.jumpSpeed * playerConfig.jumpSpeed) / (2 * playerConfig.gravity);
    expect(apex).toBeGreaterThan(expectedApex * 0.7);
    expect(apex).toBeLessThan(expectedApex * 1.15);
    expect(player.isGrounded).toBe(true);
  });
});

describe('Player physics — slopes', () => {
  it('follows a walkable slope while grounded', () => {
    const terrain = rampTerrain({ slopeTangent: 0.3 });
    const player = createPlayer({ terrain, spawn: { x: 0, z: 0, yaw: Math.PI } });

    // yaw = PI faces +Z (downhill); walk forward for one second.
    simulate(player, 1, input({ moveZ: 1 }));

    const expectedGround = terrain.heightAt(player.position.x, player.position.z);
    expect(player.position.z).toBeGreaterThan(2);
    expect(player.position.y).toBeCloseTo(expectedGround, 5);
    expect(player.isGrounded).toBe(true);
  });

  it('refuses to climb terrain steeper than the walkable limit', () => {
    const steepTangent = Math.tan(playerConfig.maxWalkableSlope + 0.25);
    const terrain = rampTerrain({ slopeTangent: steepTangent });
    const player = createPlayer({ terrain, spawn: { x: 0, z: 0, yaw: 0 } });

    const startY = player.position.y;
    simulate(player, 1.5, input({ moveZ: 1 }));

    // Facing -Z climbs the ramp; the player must not gain significant height.
    expect(player.position.y - startY).toBeLessThan(playerConfig.maxStepHeight * 4);
    expect(player.position.z).toBeGreaterThan(-6);
  });

  it('slides downhill on terrain above the walkable limit', () => {
    const steepTangent = Math.tan(playerConfig.maxWalkableSlope + 0.3);
    const terrain = rampTerrain({ slopeTangent: steepTangent });
    // Spawn on the slope facing across it (+X) so sliding is the only motion.
    const player = createPlayer({ terrain, spawn: { x: 0, z: 0, yaw: Math.PI / 2 } });

    simulate(player, 1.5, input());

    expect(player.position.z).toBeGreaterThan(0.5);
  });

  it('does not slide on gentle terrain', () => {
    const terrain = rampTerrain({ slopeTangent: 0.2 });
    const player = createPlayer({ terrain, spawn: { x: 0, z: 0 } });

    simulate(player, 1.5, input());

    expect(Math.abs(player.position.z)).toBeLessThan(0.05);
  });
});

describe('Player physics — collision and bounds', () => {
  it('is blocked by a solid obstacle instead of passing through it', () => {
    const obstacles = new ObstacleField([
      {
        id: 'rock',
        kind: 'boulder',
        x: 0,
        y: 0,
        z: -6,
        radius: 1.5,
        height: 3,
        yaw: 0,
        variant: 0,
      },
    ]);
    const player = createPlayer({ obstacles, spawn: { x: 0, z: 0, yaw: 0 } });

    simulate(player, 3, input({ moveZ: 1 }));

    const distance = Math.hypot(player.position.x - 0, player.position.z + 6);
    expect(distance).toBeGreaterThanOrEqual(1.5 + playerConfig.radius - 1e-3);
    expect(player.position.z).toBeGreaterThan(-6);
  });

  it('can walk around an obstacle', () => {
    const obstacles = new ObstacleField([
      { id: 'rock', kind: 'boulder', x: 0, y: 0, z: -6, radius: 1.2, height: 3, yaw: 0, variant: 0 },
    ]);
    const player = createPlayer({ obstacles, spawn: { x: 0, z: 0, yaw: 0 } });

    simulate(player, 1, input({ moveZ: 1, moveX: 1 }), 0.05);

    expect(Math.hypot(player.position.x, player.position.z)).toBeGreaterThan(3);
  });

  it('stays inside the finite terrain bounds', () => {
    const terrain = rampTerrain({
      slopeTangent: 0.05,
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    });
    const player = createPlayer({ terrain, spawn: { x: 0, z: 0, yaw: 0 } });

    simulate(player, 6, input({ moveZ: 1, sprint: true }));

    expect(player.position.z).toBeGreaterThanOrEqual(-10 + playerConfig.radius - 1e-6);
    expect(terrain.contains(player.position.x, player.position.z)).toBe(true);
  });

  it('ignores non-finite movement axes and zero deltas', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0 } });
    const before = player.position;

    player.step(0, input({ moveZ: 1 }));
    player.step(0.05, input({ moveX: Number.NaN, moveZ: Number.POSITIVE_INFINITY }));

    expect(player.position.x).toBeCloseTo(before.x, 6);
    expect(player.position.z).toBeCloseTo(before.z, 6);
  });

  it('resets to the spawn pose and clears vertical momentum', () => {
    const player = createPlayer({ spawn: { x: 2, z: 3, yaw: 0.4 } });
    player.step(0.05, input({ jump: true, moveZ: 1 }));
    player.reset();

    expect(player.position).toEqual({ x: 2, y: 0, z: 3 });
    expect(player.verticalSpeed).toBe(0);
    expect(player.horizontalSpeed).toBe(0);
    expect(player.isGrounded).toBe(true);
  });
});

describe('Player physics — stage and frame-rate independence', () => {
  it('produces the same movement at different fixed step sizes', () => {
    const coarse = createPlayer({ spawn: { x: 0, z: 0, yaw: 0 } });
    const fine = createPlayer({ spawn: { x: 0, z: 0, yaw: 0 } });

    simulate(coarse, 1, input({ moveZ: 1 }), 0.05);
    simulate(fine, 1, input({ moveZ: 1 }), 0.025);

    expect(Math.abs(fine.position.z - coarse.position.z)).toBeLessThan(0.15);
    expect(fine.position.y).toBeCloseTo(coarse.position.y, 3);
  });

  it('reaches the same jump apex with different step sizes', () => {
    const coarse = createPlayer({ spawn: { x: 0, z: 0 } });
    const fine = createPlayer({ spawn: { x: 0, z: 0 } });

    const apexFor = (player: PlayerController, dt: number): number => {
      let apex = 0;
      player.step(dt, input({ jump: true }));
      for (let step = 0; step < Math.round(1.2 / dt); step += 1) {
        player.step(dt, input());
        apex = Math.max(apex, player.position.y);
      }
      return apex;
    };

    expect(Math.abs(apexFor(fine, 0.025) - apexFor(coarse, 0.05))).toBeLessThan(0.15);
  });

  it('interpolates the camera view between simulation steps', () => {
    const player = createPlayer({ spawn: { x: 0, z: 0, yaw: 0 } });
    player.step(0.05, input({ moveZ: 1 }));

    const current = player.view;
    const start = player.viewAt(0);
    const halfway = player.viewAt(0.5);
    const startDistance = Math.abs(start.position.z);
    const halfwayDistance = Math.abs(halfway.position.z);
    const currentDistance = Math.abs(current.position.z);

    expect(startDistance).toBe(0);
    expect(halfwayDistance).toBeGreaterThan(startDistance);
    expect(halfwayDistance).toBeLessThan(currentDistance);
    expect(current.position.y).toBeCloseTo(player.position.y + controls.eyeHeight, 6);
  });
});
