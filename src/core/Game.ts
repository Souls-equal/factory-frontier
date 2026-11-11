import type { GameEngine } from '../engine/types';
import type { GameConfig } from './Configuration';
import { EventBus } from './EventBus';
import { GameClock } from './GameClock';
import {
  GameLoop,
  type FrameScheduler,
  type LoopStats,
} from './GameLoop';
import { GameState, GameStatus } from './GameState';

/**
 * Central game orchestrator.
 *
 * Responsibilities:
 * - own the lifecycle state machine,
 * - drive the fixed-step simulation through the render loop,
 * - keep the rendering engine behind an interface,
 * - expose statistics and lifecycle events.
 *
 * Gameplay systems (Phase 1+) register through `registerSystem` and receive
 * deterministic fixed-timestep updates. Rendering never advances game state.
 */

export type GameEvents = {
  'game:initialized': { readonly simulationTimeMs: number };
  'game:started': { readonly simulationTimeMs: number };
  'game:paused': { readonly simulationTimeMs: number };
  'game:resumed': { readonly simulationTimeMs: number };
  'game:stopped': { readonly simulationTimeMs: number };
  'game:disposed': Record<string, never>;
  'game:error': { readonly error: unknown; readonly phase: 'initialization' | 'frame' };
  'engine:resized': { readonly width: number; readonly height: number; readonly pixelRatio: number };
};

/** Deterministic simulation stage driven by the fixed-timestep clock. */
export interface SimulationSystem {
  readonly id: string;
  fixedUpdate(fixedDeltaMs: number): void;
}

export interface GameStats {
  readonly status: GameStatus;
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly simulationTimeMs: number;
  readonly tickCount: number;
  readonly fixedStepsLastFrame: number;
  readonly systems: number;
  readonly drawCalls: number;
  readonly triangles: number;
}

/** Raised when an action is attempted during the wrong part of the lifecycle. */
export class GameLifecycleError extends Error {
  constructor(
    readonly action: string,
    readonly status: GameStatus,
    readonly expected: readonly GameStatus[],
  ) {
    super(
      `Cannot ${action} while the game is "${status}". Expected state: ${expected.join(' or ')}.`,
    );
    this.name = 'GameLifecycleError';
  }
}

export interface GameOptions {
  readonly config: GameConfig;
  readonly engine: GameEngine;
  readonly eventBus?: EventBus<GameEvents>;
  readonly clock?: GameClock;
  readonly scheduler?: FrameScheduler;
  readonly onError?: (error: unknown) => void;
}

export class Game {
  private readonly gameConfig: GameConfig;
  private readonly engine: GameEngine;
  private readonly bus: EventBus<GameEvents>;
  private readonly simulationClock: GameClock;
  private readonly gameState: GameState;
  private readonly loop: GameLoop;
  private readonly systems = new Map<string, SimulationSystem>();
  private readonly onError: ((error: unknown) => void) | undefined;

  constructor(options: GameOptions) {
    this.gameConfig = options.config;
    this.engine = options.engine;
    this.bus = options.eventBus ?? new EventBus<GameEvents>();
    this.gameState = new GameState();
    this.onError = options.onError;

    this.simulationClock =
      options.clock ??
      new GameClock({
        fixedTimestepMs: options.config.simulation.fixedTimestepMs,
        maxCatchUpSteps: options.config.simulation.maxCatchUpSteps,
        maxFrameDeltaMs: options.config.simulation.maxFrameDeltaMs,
      });

    this.loop = new GameLoop({
      clock: this.simulationClock,
      onFixedUpdate: (fixedDeltaMs) => this.runFixedUpdate(fixedDeltaMs),
      onRender: (frame) => this.engine.render(frame.alpha),
      ...(options.scheduler !== undefined ? { scheduler: options.scheduler } : {}),
      maxFrameDeltaMs: options.config.simulation.maxFrameDeltaMs,
      onError: (error) => this.handleFrameError(error),
    });
  }

  get config(): GameConfig {
    return this.gameConfig;
  }

  get eventBus(): EventBus<GameEvents> {
    return this.bus;
  }

  get clock(): GameClock {
    return this.simulationClock;
  }

  get status(): GameStatus {
    return this.gameState.status;
  }

  get stats(): GameStats {
    const loopStats: LoopStats = this.loop.stats;
    const engineStats = this.gameState.is(GameStatus.Disposed)
      ? { drawCalls: 0, triangles: 0 }
      : this.engine.stats;

    return {
      status: this.gameState.status,
      fps: loopStats.fps,
      frameTimeMs: loopStats.frameTimeMs,
      simulationTimeMs: this.simulationClock.simulationTimeMs,
      tickCount: this.simulationClock.tickCount,
      fixedStepsLastFrame: loopStats.lastFixedStepCount,
      systems: this.systems.size,
      drawCalls: engineStats.drawCalls,
      triangles: engineStats.triangles,
    };
  }

  async init(): Promise<void> {
    this.assertStatus('initialize', [GameStatus.Created]);

    try {
      await this.engine.init();
    } catch (error) {
      this.emitError(error, 'initialization');
      throw error;
    }

    this.gameState.transitionTo(GameStatus.Initialized);
    this.bus.emit('game:initialized', { simulationTimeMs: this.simulationClock.simulationTimeMs });
  }

  start(): void {
    this.assertStatus('start', [GameStatus.Initialized]);
    this.gameState.transitionTo(GameStatus.Running);
    this.loop.start();
    this.bus.emit('game:started', { simulationTimeMs: this.simulationClock.simulationTimeMs });
  }

  pause(): void {
    this.assertStatus('pause', [GameStatus.Running]);
    this.gameState.transitionTo(GameStatus.Paused);
    this.loop.stop();
    this.bus.emit('game:paused', { simulationTimeMs: this.simulationClock.simulationTimeMs });
  }

  resume(): void {
    this.assertStatus('resume', [GameStatus.Paused]);
    this.gameState.transitionTo(GameStatus.Running);
    this.loop.start();
    this.bus.emit('game:resumed', { simulationTimeMs: this.simulationClock.simulationTimeMs });
  }

  stop(): void {
    this.assertStatus('stop', [GameStatus.Initialized, GameStatus.Running, GameStatus.Paused]);
    this.gameState.transitionTo(GameStatus.Stopped);
    this.loop.stop();
    this.bus.emit('game:stopped', { simulationTimeMs: this.simulationClock.simulationTimeMs });
  }

  dispose(): void {
    if (this.gameState.is(GameStatus.Disposed)) {
      return;
    }

    this.loop.stop();
    this.engine.dispose();
    this.gameState.transitionTo(GameStatus.Disposed);
    this.bus.emit('game:disposed', {});
    this.bus.clear();
    this.systems.clear();
  }

  /** Resize the rendering surface. Logical simulation state is unaffected. */
  resize(width: number, height: number, pixelRatio = 1): void {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(pixelRatio) ||
      width <= 0 ||
      height <= 0 ||
      pixelRatio <= 0
    ) {
      throw new RangeError(`Invalid viewport size ${width}x${height} @${pixelRatio}.`);
    }

    if (this.gameState.is(GameStatus.Disposed)) {
      return;
    }

    this.engine.resize(width, height, pixelRatio);
    this.bus.emit('engine:resized', { width, height, pixelRatio });
  }

  /**
   * Register a fixed-step simulation system.
   * Returns an idempotent unregister function.
   */
  registerSystem(system: SimulationSystem): () => void {
    if (this.gameState.is(GameStatus.Disposed)) {
      throw new Error(`Cannot register system "${system.id}" after the game was disposed.`);
    }
    if (system.id.trim() === '') {
      throw new Error('Simulation system id must not be empty.');
    }
    if (this.systems.has(system.id)) {
      throw new Error(`Simulation system "${system.id}" is already registered.`);
    }

    this.systems.set(system.id, system);
    return () => {
      this.unregisterSystem(system.id);
    };
  }

  unregisterSystem(id: string): boolean {
    return this.systems.delete(id);
  }

  private assertStatus(action: string, expected: readonly GameStatus[]): void {
    if (!expected.includes(this.gameState.status)) {
      throw new GameLifecycleError(action, this.gameState.status, expected);
    }
  }

  private runFixedUpdate(fixedDeltaMs: number): void {
    // Snapshot: systems may register/unregister other systems safely.
    for (const system of [...this.systems.values()]) {
      system.fixedUpdate(fixedDeltaMs);
    }
  }

  private handleFrameError(error: unknown): void {
    // Stop the loop and reflect the failure in the lifecycle state.
    this.loop.stop();
    if (!this.gameState.is(GameStatus.Disposed) && this.gameState.canTransitionTo(GameStatus.Stopped)) {
      this.gameState.transitionTo(GameStatus.Stopped);
    }
    this.emitError(error, 'frame');
    this.onError?.(error);
  }

  private emitError(error: unknown, phase: 'initialization' | 'frame'): void {
    this.bus.emit('game:error', { error, phase });
  }
}
