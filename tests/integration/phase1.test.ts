import { describe, expect, it } from 'vitest';

import { createGameConfig } from '../../src/core/Configuration';
import { InteractionSystem } from '../../src/interaction/InteractionSystem';
import { createWorldInteractables } from '../../src/interaction/WorldInteractables';
import { PlayerController, type PlayerInput } from '../../src/player/PlayerController';
import { createWorld } from '../../src/world/World';

/**
 * End-to-end Phase 1 test: real terrain, real collisions, real interaction
 * system and the real player simulation, without WebGL.
 */
const config = createGameConfig();
const FIXED_STEP_SECONDS = config.simulation.fixedTimestepMs / 1000;

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

function createScenario() {
  const world = createWorld(config);
  const player = new PlayerController({
    controls: config.controls,
    player: config.player,
    terrain: world.terrain,
    obstacles: world.obstacles,
    spawn: world.spawn,
  });
  const interaction = new InteractionSystem({
    range: config.interaction.range,
    viewProvider: () => player.view,
  });
  for (const interactable of createWorldInteractables(world.interactables)) {
    interaction.register(interactable);
  }
  return { world, player, interaction };
}

describe('Phase 1 integration', () => {
  it('spawns the player standing on the terrain', () => {
    const { world, player } = createScenario();

    expect(player.isGrounded).toBe(true);
    expect(player.position.y).toBeCloseTo(world.terrain.heightAt(world.spawn.x, world.spawn.z), 5);
    expect(player.view.position.y).toBeCloseTo(player.position.y + config.controls.eyeHeight, 6);
  });

  it('walks towards the beacon without leaving the terrain surface', () => {
    const { world, player } = createScenario();
    const startZ = player.position.z;

    for (let step = 0; step < 60; step += 1) {
      player.step(FIXED_STEP_SECONDS, input({ moveZ: 1 }));

      const ground = world.terrain.heightAt(player.position.x, player.position.z);
      expect(player.position.y).toBeGreaterThanOrEqual(ground - 1e-6);
      expect(player.position.y - ground).toBeLessThan(config.player.groundSnapDistance + 1e-6);
      expect(world.terrain.contains(player.position.x, player.position.z)).toBe(true);
    }

    expect(player.position.z).toBeLessThan(startZ - 3);
    expect(player.isGrounded).toBe(true);
  });

  it('is stopped by the beacon collider instead of walking through it', () => {
    const { world, player } = createScenario();
    const beacon = world.interactables[0];
    if (beacon === undefined) {
      throw new Error('World must provide a survey beacon.');
    }

    for (let step = 0; step < 120; step += 1) {
      player.step(FIXED_STEP_SECONDS, input({ moveZ: 1 }));
    }

    const distance = Math.hypot(player.position.x - beacon.x, player.position.z - beacon.z);
    expect(distance).toBeGreaterThan(0.55 + config.player.radius - 1e-3);
  });

  it('targets the beacon and executes a single interaction', () => {
    const { world, player, interaction } = createScenario();

    // Walk within interaction range of the beacon.
    for (let step = 0; step < 120 && interaction.refreshTarget() === null; step += 1) {
      player.step(FIXED_STEP_SECONDS, input({ moveZ: 1 }));
    }

    const target = interaction.refreshTarget();
    expect(target?.id).toBe('survey-beacon');
    expect(target?.displayName).toBe('Survey Beacon');
    expect(target?.distance ?? Infinity).toBeLessThanOrEqual(config.interaction.range);

    interaction.requestInteraction();
    interaction.fixedUpdate(config.simulation.fixedTimestepMs);

    expect(interaction.executions).toBe(1);
    expect(interaction.lastOutcome?.ok).toBe(true);
    expect(interaction.lastOutcome?.message).toContain('Survey ping');

    // Holding the key must not repeat it.
    interaction.fixedUpdate(config.simulation.fixedTimestepMs);
    expect(interaction.executions).toBe(1);

    expect(world.terrain.heightAt(world.spawn.x, world.spawn.z)).toBeCloseTo(world.spawn.y, 6);
  });

  it('jumps on the real terrain and lands back on the surface', () => {
    const { world, player } = createScenario();
    const groundY = player.position.y;

    player.step(FIXED_STEP_SECONDS, input({ jump: true }));
    expect(player.isGrounded).toBe(false);

    let apex = player.position.y;
    for (let step = 0; step < 80; step += 1) {
      player.step(FIXED_STEP_SECONDS, input());
      apex = Math.max(apex, player.position.y);
    }

    expect(apex).toBeGreaterThan(groundY + 0.7);
    expect(player.isGrounded).toBe(true);
    expect(player.position.y).toBeCloseTo(
      world.terrain.heightAt(player.position.x, player.position.z),
      4,
    );
  });
});
