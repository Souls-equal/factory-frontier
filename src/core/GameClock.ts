/**
 * Fixed-timestep accumulator.
 *
 * Rendering runs at the display refresh rate, while industrial simulation must
 * be deterministic and independent from it (§21.1, §21.4). This clock converts
 * variable frame deltas into a whole number of fixed simulation steps.
 */

export interface GameClockOptions {
  readonly fixedTimestepMs: number;
  readonly maxCatchUpSteps: number;
  /** Frame deltas above this threshold are clamped (tab was hidden, etc.). */
  readonly maxFrameDeltaMs?: number;
}

export const DEFAULT_MAX_FRAME_DELTA_MS = 250;

export class GameClock {
  readonly fixedTimestepMs: number;
  readonly maxCatchUpSteps: number;
  readonly maxFrameDeltaMs: number;

  private accumulatorMs = 0;
  private simulationMs = 0;
  private ticks = 0;
  private droppedMs = 0;

  constructor(options: GameClockOptions) {
    if (!Number.isFinite(options.fixedTimestepMs) || options.fixedTimestepMs <= 0) {
      throw new RangeError(`fixedTimestepMs must be a positive number (received ${options.fixedTimestepMs}).`);
    }
    if (!Number.isInteger(options.maxCatchUpSteps) || options.maxCatchUpSteps < 1) {
      throw new RangeError(`maxCatchUpSteps must be a positive integer (received ${options.maxCatchUpSteps}).`);
    }

    const maxFrameDeltaMs = options.maxFrameDeltaMs ?? DEFAULT_MAX_FRAME_DELTA_MS;
    if (!Number.isFinite(maxFrameDeltaMs) || maxFrameDeltaMs <= 0) {
      throw new RangeError(`maxFrameDeltaMs must be a positive number (received ${maxFrameDeltaMs}).`);
    }

    this.fixedTimestepMs = options.fixedTimestepMs;
    this.maxCatchUpSteps = options.maxCatchUpSteps;
    this.maxFrameDeltaMs = maxFrameDeltaMs;
  }

  /**
   * Feed a frame delta and get the number of fixed steps to simulate.
   *
   * Excess time beyond the catch-up budget is deliberately discarded to avoid
   * an unbounded "spiral of death" after a long stall; the discarded amount is
   * reported through `droppedTimeMs` for diagnostics.
   */
  advance(frameDeltaMs: number): number {
    const frameDelta =
      Number.isFinite(frameDeltaMs) && frameDeltaMs > 0 ? Math.min(frameDeltaMs, this.maxFrameDeltaMs) : 0;

    this.accumulatorMs += frameDelta;
    let steps = Math.floor(this.accumulatorMs / this.fixedTimestepMs);

    if (steps > this.maxCatchUpSteps) {
      steps = this.maxCatchUpSteps;
    }

    this.accumulatorMs -= steps * this.fixedTimestepMs;

    // Only reachable when the catch-up budget was exhausted.
    if (this.accumulatorMs >= this.fixedTimestepMs) {
      this.droppedMs += this.accumulatorMs;
      this.accumulatorMs = 0;
    }

    this.simulationMs += steps * this.fixedTimestepMs;
    this.ticks += steps;

    return steps;
  }

  reset(): void {
    this.accumulatorMs = 0;
    this.simulationMs = 0;
    this.ticks = 0;
    this.droppedMs = 0;
  }

  /** Interpolation factor in [0, 1) between the last and next fixed step. */
  get alpha(): number {
    return Math.min(this.accumulatorMs / this.fixedTimestepMs, 0.999_999);
  }

  get accumulator(): number {
    return this.accumulatorMs;
  }

  get simulationTimeMs(): number {
    return this.simulationMs;
  }

  get tickCount(): number {
    return this.ticks;
  }

  get droppedTimeMs(): number {
    return this.droppedMs;
  }
}
