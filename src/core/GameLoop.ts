import { GameClock } from './GameClock';

/**
 * Rendering loop.
 *
 * Drives fixed simulation steps through a `GameClock`, then renders once per
 * animation frame. The scheduler is injectable so the loop can be tested
 * deterministically without a browser.
 */

export interface FrameScheduler {
  requestFrame(callback: (timestampMs: number) => void): number;
  cancelFrame(handle: number): void;
}

export const browserFrameScheduler: FrameScheduler = {
  requestFrame: (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame: (handle) => globalThis.cancelAnimationFrame(handle),
};

export interface RenderFrame {
  /** Interpolation factor between the previous and next fixed step. */
  readonly alpha: number;
  readonly frameDeltaMs: number;
  readonly fps: number;
}

export interface LoopStats {
  readonly running: boolean;
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly lastFixedStepCount: number;
  readonly totalFrames: number;
}

export interface GameLoopOptions {
  readonly clock: GameClock;
  readonly onFixedUpdate: (fixedDeltaMs: number) => void;
  readonly onRender: (frame: RenderFrame) => void;
  readonly scheduler?: FrameScheduler;
  readonly maxFrameDeltaMs?: number;
  readonly statsWindowMs?: number;
  readonly onError?: (error: unknown) => void;
}

const DEFAULT_MAX_FRAME_DELTA_MS = 250;
const DEFAULT_STATS_WINDOW_MS = 500;

export class GameLoop {
  private readonly clock: GameClock;
  private readonly onFixedUpdate: (fixedDeltaMs: number) => void;
  private readonly onRender: (frame: RenderFrame) => void;
  private readonly scheduler: FrameScheduler;
  private readonly maxFrameDeltaMs: number;
  private readonly statsWindowMs: number;
  private readonly onError: ((error: unknown) => void) | undefined;

  private running = false;
  private frameHandle: number | null = null;
  private lastTimestampMs: number | null = null;
  private lastFixedStepCount = 0;
  private totalFrames = 0;

  private statsElapsedMs = 0;
  private statsFrames = 0;
  private fps = 0;
  private frameTimeMs = 0;

  constructor(options: GameLoopOptions) {
    const maxFrameDeltaMs = options.maxFrameDeltaMs ?? DEFAULT_MAX_FRAME_DELTA_MS;
    if (!Number.isFinite(maxFrameDeltaMs) || maxFrameDeltaMs <= 0) {
      throw new RangeError(`maxFrameDeltaMs must be a positive number (received ${maxFrameDeltaMs}).`);
    }

    this.clock = options.clock;
    this.onFixedUpdate = options.onFixedUpdate;
    this.onRender = options.onRender;
    this.scheduler = options.scheduler ?? browserFrameScheduler;
    this.maxFrameDeltaMs = maxFrameDeltaMs;
    this.statsWindowMs = options.statsWindowMs ?? DEFAULT_STATS_WINDOW_MS;
    this.onError = options.onError;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get stats(): LoopStats {
    return {
      running: this.running,
      fps: this.fps,
      frameTimeMs: this.frameTimeMs,
      lastFixedStepCount: this.lastFixedStepCount,
      totalFrames: this.totalFrames,
    };
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTimestampMs = null;
    this.scheduleNextFrame();
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle !== null) {
      this.scheduler.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private scheduleNextFrame(): void {
    if (!this.running) {
      return;
    }
    this.frameHandle = this.scheduler.requestFrame(this.handleFrame);
  }

  private readonly handleFrame = (timestampMs: number): void => {
    this.frameHandle = null;
    if (!this.running) {
      return;
    }

    try {
      this.totalFrames += 1;

      if (this.lastTimestampMs === null) {
        // First frame: establish the time origin and render without simulating.
        this.lastTimestampMs = timestampMs;
        this.lastFixedStepCount = 0;
        this.onRender({ alpha: 0, frameDeltaMs: 0, fps: this.fps });
        this.scheduleNextFrame();
        return;
      }

      const rawDeltaMs = timestampMs - this.lastTimestampMs;
      const frameDeltaMs = Math.min(
        Math.max(0, Number.isFinite(rawDeltaMs) ? rawDeltaMs : 0),
        this.maxFrameDeltaMs,
      );
      this.lastTimestampMs = timestampMs;

      this.updateFrameStats(frameDeltaMs);

      const steps = this.clock.advance(frameDeltaMs);
      this.lastFixedStepCount = steps;
      for (let step = 0; step < steps; step += 1) {
        this.onFixedUpdate(this.clock.fixedTimestepMs);
      }

      this.onRender({ alpha: this.clock.alpha, frameDeltaMs, fps: this.fps });
    } catch (error) {
      // Fail fast: never keep scheduling a loop that throws.
      this.stop();
      if (this.onError !== undefined) {
        this.onError(error);
      } else {
        throw error;
      }
      return;
    }

    this.scheduleNextFrame();
  };

  private updateFrameStats(frameDeltaMs: number): void {
    this.statsElapsedMs += frameDeltaMs;
    this.statsFrames += 1;

    if (this.statsElapsedMs >= this.statsWindowMs) {
      this.fps = (this.statsFrames / this.statsElapsedMs) * 1000;
      this.frameTimeMs = this.statsElapsedMs / this.statsFrames;
      this.statsElapsedMs = 0;
      this.statsFrames = 0;
    }
  }
}
