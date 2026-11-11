import './styles/main.css';

import { createGameConfig } from './core/Configuration';
import { Game } from './core/Game';
import { Engine } from './engine/Engine';
import { InputManager } from './input/InputManager';
import { InteractionSystem } from './interaction/InteractionSystem';
import { createWorldInteractables } from './interaction/WorldInteractables';
import { PlayerController } from './player/PlayerController';
import { ControlsHint } from './ui/ControlsHint';
import { InteractionPrompt } from './ui/InteractionPrompt';
import { StatusOverlay } from './ui/StatusOverlay';
import { createWorld } from './world/World';

/**
 * Application bootstrap.
 *
 * Keeps DOM wiring out of the game core: `Game` never touches the document,
 * `Engine` never knows about the UI, and the player/interaction systems never
 * import Three.js. Stage assignment matters:
 *
 * - player physics and interaction targeting run on the fixed simulation clock,
 * - mouse look, camera application, highlighting and the prompt run once per
 *   rendered frame, reading authoritative state without mutating it.
 */

const app = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (app === null || canvas === null) {
  throw new Error('Application shell is missing #app or #game-canvas.');
}

const overlay = StatusOverlay.fromDocument(document);
const controlsHint = ControlsHint.fromDocument(document);
const interactionPrompt = InteractionPrompt.fromDocument(document);
const query = new URLSearchParams(window.location.search);

const config = createGameConfig({
  appName: __APP_NAME__,
  version: __APP_VERSION__,
  basePath: import.meta.env.BASE_URL,
  debug: import.meta.env.DEV || query.has('debug'),
});

let game: Game | undefined;
let input: InputManager | undefined;
let statsTimer: number | undefined;

function measureViewport(): { width: number; height: number } {
  const width = app?.clientWidth ?? 0;
  const height = app?.clientHeight ?? 0;
  return {
    width: Math.max(1, Math.floor(width > 0 ? width : window.innerWidth)),
    height: Math.max(1, Math.floor(height > 0 ? height : window.innerHeight)),
  };
}

function handleResize(): void {
  if (game === undefined) {
    return;
  }
  const { width, height } = measureViewport();
  game.resize(width, height, window.devicePixelRatio || 1);
}

function shutdown(): void {
  if (statsTimer !== undefined) {
    window.clearInterval(statsTimer);
    statsTimer = undefined;
  }
  window.removeEventListener('resize', handleResize);
  input?.dispose();
  input = undefined;
  interactionPrompt.dispose();
  game?.dispose();
}

function handleFatalError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[Factory Frontier] fatal error:', error);
  shutdown();
  overlay.showFatal(message);
}

function startDebugStats(target: Game): void {
  if (!config.debug) {
    return;
  }
  overlay.showStats();
  statsTimer = window.setInterval(() => {
    overlay.updateStats(target.stats);
  }, 250);
}

async function boot(): Promise<void> {
  overlay.setBootStatus('Generating terrain…');
  const world = createWorld(config);

  overlay.setBootStatus('Building environment…');
  const engine = Engine.create(canvas as HTMLCanvasElement, config, world);
  const createdGame = new Game({
    config,
    engine,
    onError: handleFatalError,
  });
  game = createdGame;
  await createdGame.init();

  overlay.setBootStatus('Wiring first-person controls…');
  const createdInput = new InputManager(canvas as HTMLCanvasElement, {
    onPointerLockChange: (locked) => controlsHint.setPointerLocked(locked),
  });
  input = createdInput;

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

  // --- deterministic simulation stage -------------------------------------
  createdGame.registerSystem({
    id: 'player-simulation',
    fixedUpdate: (fixedDeltaMs) => {
      const movement = createdInput.getMovement();
      player.step(fixedDeltaMs / 1000, {
        moveX: movement.right,
        moveZ: movement.forward,
        sprint: movement.sprint,
        lookDeltaX: 0,
        lookDeltaY: 0,
        jump: createdInput.consumeJump(),
      });

      if (createdInput.consumeInteract()) {
        interaction.requestInteraction();
      }
    },
  });
  createdGame.registerSystem(interaction);

  // --- presentation stage --------------------------------------------------
  createdGame.registerFrameSystem({
    id: 'player-view',
    update: () => {
      const look = createdInput.consumeLookDelta();
      if (look.x !== 0 || look.y !== 0) {
        player.applyLook({
          moveX: 0,
          moveZ: 0,
          sprint: false,
          lookDeltaX: look.x,
          lookDeltaY: look.y,
        });
      }
      // Interpolation keeps the camera smooth between 20 Hz physics steps
      // without touching authoritative simulation state.
      engine.applyView(player.viewAt(createdGame.clock.alpha));
    },
  });

  let lastOutcomeSequence = interaction.outcomeSequence;
  createdGame.registerFrameSystem({
    id: 'interaction-presentation',
    update: () => {
      const target = interaction.target;
      engine.setHighlight?.(target?.id ?? null);

      if (target === null) {
        interactionPrompt.hide();
      } else {
        interactionPrompt.show(target, target.id);
      }

      if (interaction.outcomeSequence !== lastOutcomeSequence) {
        lastOutcomeSequence = interaction.outcomeSequence;
        const outcome = interaction.lastOutcome;
        if (outcome !== null) {
          interactionPrompt.showFeedback(outcome.message);
        }
      }
    },
  });

  const { width, height } = measureViewport();
  createdGame.resize(width, height, window.devicePixelRatio || 1);

  window.addEventListener('resize', handleResize);
  window.addEventListener('beforeunload', shutdown);

  overlay.hideBoot();
  createdGame.start();
  startDebugStats(createdGame);

  console.info(
    `[Factory Frontier] ${config.appName} v${config.version} ready — ${world.terrain.resolution}² terrain cells, ` +
      `${world.obstacleDefinitions.length} solid obstacles, ${interaction.size} interactables, ` +
      `fixed timestep ${config.simulation.fixedTimestepMs} ms, base "${config.basePath}".`,
  );
}

boot().catch((error: unknown) => {
  handleFatalError(error);
});
