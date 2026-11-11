import type { FrameScheduler } from '../../src/core/GameLoop';

/**
 * Deterministic frame scheduler for tests.
 *
 * `advance(ms)` runs exactly the callbacks that were pending *before* the
 * advance, so loops behave like real animation frames.
 */
export class MockScheduler implements FrameScheduler {
  private readonly pendingFrames = new Map<number, (timestampMs: number) => void>();
  private nextHandle = 1;
  private currentTimeMs = 0;

  get pendingCount(): number {
    return this.pendingFrames.size;
  }

  get nowMs(): number {
    return this.currentTimeMs;
  }

  requestFrame(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.pendingFrames.set(handle, callback);
    return handle;
  }

  cancelFrame(handle: number): void {
    this.pendingFrames.delete(handle);
  }

  advance(ms: number): void {
    this.currentTimeMs += ms;
    const callbacks = [...this.pendingFrames.values()];
    this.pendingFrames.clear();
    for (const callback of callbacks) {
      callback(this.currentTimeMs);
    }
  }

  /** Advance several frames of identical duration. */
  advanceFrames(count: number, frameMs: number): void {
    for (let index = 0; index < count; index += 1) {
      this.advance(frameMs);
    }
  }
}
