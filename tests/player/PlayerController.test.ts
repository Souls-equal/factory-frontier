import { describe, expect, it } from 'vitest';

import { createGameConfig } from '../../src/core/Configuration';
import { PlayerController, type PlayerInput } from '../../src/player/PlayerController';

const controls = createGameConfig().controls;

function createPlayer(spawn?: { x: number; z: number; yaw?: number; pitch?: number }) {
  return new PlayerController({ controls, ...(spawn !== undefined ? { spawn } : {}) });
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
  frameMs = 50,
): void {
  const stepSeconds = frameMs / 1000;
  const steps = Math.round(seconds / stepSeconds);
  for (let step = 0; step < steps; step += 1) {
    player.update(stepSeconds, playerInput);
  }
}

describe('PlayerController', () => {
  it('starts at the spawn pose at eye height', () => {
    const player = createPlayer();
    const view = player.view;

    expect(view.position).toEqual({ x: 0, y: controls.eyeHeight, z: 18 });
    expect(view.yaw).toBe(0);
    expect(view.pitch).toBe(0);
    expect(player.horizontalSpeed).toBe(0);
  });

  it('accepts a custom spawn and clamps its pitch', () => {
    const player = createPlayer({ x: 5, z: -7, yaw: 1, pitch: 99 });
    const view = player.view;

    expect(view.position.x).toBe(5);
    expect(view.position.z).toBe(-7);
    expect(view.yaw).toBe(1);
    expect(view.pitch).toBe(controls.pitchLimit);
  });

  it('rejects non-finite spawn values', () => {
    expect(() => createPlayer({ x: Number.NaN, z: 0 })).toThrow(RangeError);
  });

  it('moves forward along the facing direction', () => {
    const player = createPlayer();
    simulate(player, 1, input({ moveZ: 1 }));

    expect(player.view.position.z).toBeLessThan(18);
    expect(player.view.position.z).toBeLessThan(16);
    expect(player.view.position.x).toBeCloseTo(0, 5);
    expect(player.horizontalSpeed).toBeGreaterThan(controls.moveSpeed * 0.9);
  });

  it('strafes right relative to the current yaw', () => {
    const player = createPlayer();
    simulate(player, 1, input({ moveX: 1 }));

    expect(player.view.position.x).toBeGreaterThan(3);
    expect(player.view.position.z).toBeCloseTo(18, 5);
  });

  it('moves forward relative to the rotated view', () => {
    const player = createPlayer({ x: 0, z: 0, yaw: Math.PI / 2 });
    simulate(player, 1, input({ moveZ: 1 }));

    // Yaw +90° faces -X.
    expect(player.view.position.x).toBeLessThan(-3);
    expect(player.view.position.z).toBeCloseTo(0, 5);
  });

  it('accelerates up to walking speed and then holds it', () => {
    const player = createPlayer();

    player.update(0.05, input({ moveZ: 1 }));
    const speedAfterOneFrame = player.horizontalSpeed;
    expect(speedAfterOneFrame).toBeGreaterThan(0);
    expect(speedAfterOneFrame).toBeLessThan(controls.moveSpeed);

    simulate(player, 1, input({ moveZ: 1 }));
    expect(player.horizontalSpeed).toBeCloseTo(controls.moveSpeed, 5);
  });

  it('does not move faster diagonally than straight', () => {
    const straight = createPlayer();
    const diagonal = createPlayer();

    simulate(straight, 2, input({ moveZ: 1 }));
    simulate(diagonal, 2, input({ moveZ: 1, moveX: 1 }));

    expect(diagonal.horizontalSpeed).toBeCloseTo(straight.horizontalSpeed, 5);
  });

  it('clamps out-of-range movement axes', () => {
    const player = createPlayer();
    simulate(player, 1, input({ moveZ: 25 }));

    expect(player.horizontalSpeed).toBeCloseTo(controls.moveSpeed, 5);
  });

  it('sprints faster than walking', () => {
    const walker = createPlayer();
    const sprinter = createPlayer();

    simulate(walker, 2, input({ moveZ: 1 }));
    simulate(sprinter, 2, input({ moveZ: 1, sprint: true }));

    const walkDistance = 18 - walker.view.position.z;
    const sprintDistance = 18 - sprinter.view.position.z;

    expect(sprintDistance).toBeGreaterThan(walkDistance * 1.4);
    expect(sprinter.horizontalSpeed).toBeCloseTo(
      controls.moveSpeed * controls.sprintMultiplier,
      5,
    );
  });

  it('brakes to a stop when input is released', () => {
    const player = createPlayer();
    simulate(player, 1, input({ moveZ: 1 }));
    expect(player.horizontalSpeed).toBeGreaterThan(0);

    simulate(player, 1, input());
    expect(player.horizontalSpeed).toBe(0);
  });

  it('applies mouse look with the configured sensitivity', () => {
    const player = createPlayer();
    player.update(0.016, input({ lookDeltaX: 100, lookDeltaY: 50 }));

    expect(player.view.yaw).toBeCloseTo(-100 * controls.lookSensitivity, 8);
    expect(player.view.pitch).toBeCloseTo(-50 * controls.lookSensitivity, 8);
  });

  it('clamps pitch and normalizes yaw', () => {
    const player = createPlayer();
    player.update(0.016, input({ lookDeltaX: 100_000, lookDeltaY: 100_000 }));

    expect(player.view.pitch).toBe(-controls.pitchLimit);
    expect(player.view.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(player.view.yaw).toBeLessThanOrEqual(Math.PI);
  });

  it('ignores non-finite look and movement input', () => {
    const player = createPlayer();

    player.update(0.05, input({ moveZ: Number.NaN, lookDeltaX: Number.NaN }));
    expect(player.view.position).toEqual({ x: 0, y: controls.eyeHeight, z: 18 });
    expect(player.view.yaw).toBe(0);
    expect(player.view.pitch).toBe(0);
  });

  it('applies look but no movement for non-positive frame deltas', () => {
    const player = createPlayer();

    player.update(0, input({ moveZ: 1, lookDeltaX: 10 }));
    expect(player.view.position.z).toBe(18);
    expect(player.view.yaw).not.toBe(0);

    player.update(-1, input({ moveZ: 1 }));
    expect(player.view.position.z).toBe(18);
  });

  it('keeps the player inside the foundation play area', () => {
    const player = createPlayer({ x: controls.playAreaRadius - 1, z: 0 });
    simulate(player, 3, input({ moveX: 1 }));

    const position = player.view.position;
    expect(Math.hypot(position.x, position.z)).toBeLessThanOrEqual(controls.playAreaRadius + 1e-6);
    expect(position.x).toBeCloseTo(controls.playAreaRadius, 5);
    expect(player.horizontalSpeed).toBeCloseTo(0, 5);
  });

  it('resets to the spawn pose and clears momentum', () => {
    const player = createPlayer();
    simulate(player, 1, input({ moveZ: 1, lookDeltaX: 50 }));
    player.reset();

    expect(player.view.position).toEqual({ x: 0, y: controls.eyeHeight, z: 18 });
    expect(player.view.yaw).toBe(0);
    expect(player.view.pitch).toBe(0);
    expect(player.horizontalSpeed).toBe(0);
  });

  it('clamps huge frame deltas so a stall cannot teleport the player', () => {
    const player = createPlayer();

    player.update(10, input({ moveZ: 1 }));

    const distance = 18 - player.view.position.z;
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThanOrEqual(controls.moveSpeed * 0.25 + 1e-9);
  });
});
