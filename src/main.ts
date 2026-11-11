import './styles/main.css';

import { createGameConfig } from './core/Configuration';
import { Game } from './core/Game';
import { Engine } from './engine/Engine';
import { InputManager } from './input/InputManager';
import { PlayerController } from './player/PlayerController';
import { ControlsHint } from './ui/ControlsHint';
import { StatusOverlay } from './ui/StatusOverlay';

/**
 * Application bootstrap.
 *
 * Keeps DOM wiring out of the game core: `Game` never touches the document,
 * `Engine` never knows about the UI, and `PlayerController` never imports
 * Three.js. The first-person camera is applied by a frame system immediately
 * before each render.
 */

const app = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (app === null || canvas === null) {
  throw new Error('Application shell is missing #app or #game-canvas.');
}

const overlay = StatusOverlay.fromDocument(document);
const controlsHint = ControlsHint.fromDocument(document);
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
  overlay.setBootStatus('Starting rendering engine…');

  const engine = Engine.create(canvas as HTMLCanvasElement, config);
  const createdGame = new Game({
    config,
    engine,
    onError: handleFatalError,
  });
  game = createdGame;

  overlay.setBootStatus('Building foundation scene…');
  await createdGame.init();

  overlay.setBootStatus('Initializing first-person controls…');
  const createdInput = new InputManager(canvas as HTMLCanvasElement, {
    onPointerLockChange: (locked) => controlsHint.setPointerLocked(locked),
  });
  input = createdInput;

  const player = new PlayerController({ controls: config.controls });

  createdGame.registerFrameSystem({
    id: 'player',
    update: (frameDeltaMs) => {
      const movement = createdInput.getMovement();
      const look = createdInput.consumeLookDelta();

      player.update(frameDeltaMs / 1000, {
        moveX: movement.right,
        moveZ: movement.forward,
        sprint: movement.sprint,
        lookDeltaX: look.x,
        lookDeltaY: look.y,
      });

      engine.applyView(player.view);
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
    `[Factory Frontier] ${config.appName} v${config.version} ready — fixed timestep ${config.simulation.fixedTimestepMs} ms, base "${config.basePath}", first-person controls active.`,
  );
}

boot().catch((error: unknown) => {
  handleFatalError(error);
});
