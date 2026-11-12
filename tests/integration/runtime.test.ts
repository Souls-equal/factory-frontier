import { BuildingTerrain } from '../../src/buildings/BuildingTerrain';
import { BuildingCollision } from '../../src/buildings/BuildingCollision';
import { VoxelCollision } from '../../src/world/terrain/VoxelCollision';
import { describe, expect, it } from 'vitest';

import { createGameConfig } from '../../src/core/Configuration';
import { Game } from '../../src/core/Game';
import { Engine } from '../../src/engine/Engine';
import { InteractionSystem } from '../../src/interaction/InteractionSystem';
import { createWorldInteractables } from '../../src/interaction/WorldInteractables';
import { PlayerController, type PlayerInput } from '../../src/player/PlayerController';
import { createWorld } from '../../src/world/World';
import { FakeRenderBackend } from '../helpers/FakeRenderBackend';
import { MockScheduler } from '../helpers/MockScheduler';

/**
 * Runtime composition test: real `Game` loop, real `Engine`/`SceneManager`
 * (Three.js objects, no WebGL), real player and interaction systems, wired the
 * same way `main.ts` wires them. It proves the two update stages cooperate —
 * fixed physics steps plus per-frame view application — without a browser.
 */
function idleInput(): PlayerInput {
  return { moveX: 0, moveZ: 0, sprint: false, lookDeltaX: 0, lookDeltaY: 0 };
}

function createRuntime() {
  const config = createGameConfig({
    world: { resolution: 32, obstacleCount: 8, sizeMeters: 100, seed: 5 },
  });
  const world = createWorld(config);
  const backend = new FakeRenderBackend();
  const engine = new Engine({ config, renderer: backend, world });
  const scheduler = new MockScheduler();
  const game = new Game({ config, engine, scheduler });

  const player = new PlayerController({
    controls: config.controls,
    player: config.player,
    terrain: new BuildingTerrain(world.terrain, world.buildings),
    obstacles: new BuildingCollision(new VoxelCollision(world.terrain, world.obstacles), world.buildings),
    spawn: world.spawn,
  });
  const interaction = new InteractionSystem({
    range: config.interaction.range,
    viewProvider: () => player.view,
  });
  for (const interactable of createWorldInteractables(world.interactables)) {
    interaction.register(interactable);
  }

  let movement = idleInput();
  const highlights: Array<string | null> = [];

  game.registerSystem({
    id: 'player-simulation',
    fixedUpdate: (fixedDeltaMs) => {
      player.step(fixedDeltaMs / 1000, movement);
    },
  });
  game.registerSystem(interaction);

  game.registerFrameSystem({
    id: 'player-view',
    update: () => {
      engine.applyView(player.viewAt(game.clock.alpha));
    },
  });

  game.registerFrameSystem({
    id: 'interaction-presentation',
    update: () => {
      const id = interaction.target?.id ?? null;
      engine.setHighlight(id);
      highlights.push(id);
    },
  });

  return {
    game,
    engine,
    backend,
    scheduler,
    player,
    interaction,
    world,
    config,
    highlights,
    setMovement(next: Partial<PlayerInput>) {
      movement = { ...idleInput(), ...next };
    },
  };
}

describe('runtime composition', () => {
  it('runs fixed physics steps and renders once per frame', async () => {
    const runtime = createRuntime();
    await runtime.game.init();
    runtime.game.start();

    runtime.scheduler.advance(16);
    expect(runtime.backend.renderCalls).toHaveLength(1);

    runtime.scheduler.advance(16);
    runtime.scheduler.advance(16);
    expect(runtime.backend.renderCalls).toHaveLength(3);
    expect(runtime.game.stats.systems).toBe(2);
    expect(runtime.game.stats.frameSystems).toBe(2);
    expect(runtime.engine.camera.position.z).toBeCloseTo(
      runtime.player.view.position.z,
      6,
    );

    runtime.game.dispose();
  });

  it('moves the player through the simulation stage and the camera follows', async () => {
    const runtime = createRuntime();
    await runtime.game.init();
    runtime.game.start();
    runtime.scheduler.advance(16);

    const startZ = runtime.player.position.z;
    expect(startZ).toBe(runtime.world.spawn.z);

    runtime.setMovement({ moveZ: 1 });
    for (let frame = 0; frame < 20; frame += 1) {
      runtime.scheduler.advance(16);
    }

    expect(runtime.player.position.z).toBeLessThan(startZ - 0.5);
    // The camera is interpolated between the last two fixed steps, so it trails
    // the authoritative position by less than one step of travel.
    expect(Math.abs(runtime.engine.camera.position.z - runtime.player.position.z)).toBeLessThan(0.5);
    expect(runtime.engine.camera.position.y).toBeCloseTo(
      runtime.player.view.position.y,
      1,
    );

    runtime.game.dispose();
  });

  it('clears the highlight while nothing is targeted', async () => {
    const runtime = createRuntime();
    await runtime.game.init();
    runtime.game.start();

    runtime.scheduler.advance(16);
    runtime.scheduler.advance(16);

    expect(runtime.highlights.length).toBeGreaterThan(0);
    expect(runtime.highlights.at(-1)).toBeNull();
    expect(runtime.engine.scene.getObjectByName('environment:prop:survey-beacon:highlight-ring')?.visible).toBe(
      false,
    );

    runtime.game.dispose();
  });

  it('highlights and executes the beacon when aimed at it', () => {
    const runtime = createRuntime();
    const beacon = runtime.world.interactables[0];
    if (beacon === undefined) {
      throw new Error('missing beacon');
    }

    // Stand two metres in front of the beacon and look at it.
    const player = new PlayerController({
      controls: runtime.config.controls,
      player: runtime.config.player,
      terrain: new BuildingTerrain(runtime.world.terrain, runtime.world.buildings),
      obstacles: new BuildingCollision(new VoxelCollision(runtime.world.terrain, runtime.world.obstacles), runtime.world.buildings),
      spawn: { x: beacon.x, y: beacon.baseY, z: beacon.z + 2, yaw: 0 },
    });
    const interaction = new InteractionSystem({
      range: runtime.config.interaction.range,
      viewProvider: () => player.view,
    });
    for (const interactable of createWorldInteractables(runtime.world.interactables)) {
      interaction.register(interactable);
    }

    interaction.fixedUpdate(50);
    expect(interaction.target?.id).toBe(beacon.id);

    runtime.engine.setHighlight(interaction.target?.id ?? null);
    const ring = runtime.engine.scene.getObjectByName(
      `environment:prop:${beacon.id}:highlight-ring`,
    );
    expect(ring?.visible).toBe(true);

    interaction.requestInteraction();
    interaction.fixedUpdate(50);
    expect(interaction.executions).toBe(1);

    runtime.engine.setHighlight(null);
    expect(ring?.visible).toBe(false);

    runtime.game.dispose();
  });
});
