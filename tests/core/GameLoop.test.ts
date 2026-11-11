import { describe, expect, it, vi } from 'vitest';

import { GameClock } from '../../src/core/GameClock';
import { GameLoop, type RenderFrame } from '../../src/core/GameLoop';
import { MockScheduler } from '../helpers/MockScheduler';

interface Harness {
  readonly loop: GameLoop;
  readonly scheduler: MockScheduler;
  readonly fixedUpdates: number[];
  readonly rendered: RenderFrame[];
}

function createHarness(
  options: {
    fixedTimestepMs?: number;
    maxCatchUpSteps?: number;
    maxFrameDeltaMs?: number;
    statsWindowMs?: number;
    onError?: (error: unknown) => void;
  } = {},
): Harness {
  const scheduler = new MockScheduler();
  const fixedUpdates: number[] = [];
  const rendered: RenderFrame[] = [];

  const clock = new GameClock({
    fixedTimestepMs: options.fixedTimestepMs ?? 50,
    maxCatchUpSteps: options.maxCatchUpSteps ?? 10,
    maxFrameDeltaMs: options.maxFrameDeltaMs ?? 250,
  });

  const loop = new GameLoop({
    clock,
    scheduler,
    statsWindowMs: options.statsWindowMs ?? 500,
    onFixedUpdate: (delta) => fixedUpdates.push(delta),
    onRender: (frame) => rendered.push(frame),
    ...(options.onError !== undefined ? { onError: options.onError } : {}),
  });

  return { loop, scheduler, fixedUpdates, rendered };
}

describe('GameLoop', () => {
  it('renders the first frame without simulating', () => {
    const { loop, scheduler, fixedUpdates, rendered } = createHarness();

    loop.start();
    expect(scheduler.pendingCount).toBe(1);

    scheduler.advance(16);

    expect(fixedUpdates).toHaveLength(0);
    expect(rendered).toEqual([{ alpha: 0, frameDeltaMs: 0, fps: 0 }]);
    expect(scheduler.pendingCount).toBe(1);
  });

  it('runs fixed updates from frame deltas and renders once per frame', () => {
    const { loop, scheduler, fixedUpdates, rendered } = createHarness();

    loop.start();
    scheduler.advance(16); // first frame establishes the time origin
    scheduler.advance(100);

    expect(fixedUpdates).toEqual([50, 50]);
    expect(rendered).toHaveLength(2);
    expect(rendered[1]?.alpha).toBeCloseTo(0, 5);
    expect(rendered[1]?.frameDeltaMs).toBe(100);
  });

  it('does not start twice', () => {
    const { loop, scheduler } = createHarness();

    loop.start();
    loop.start();

    expect(scheduler.pendingCount).toBe(1);
  });

  it('stops scheduling and processing after stop()', () => {
    const { loop, scheduler, fixedUpdates, rendered } = createHarness();

    loop.start();
    scheduler.advance(16);
    loop.stop();

    expect(loop.isRunning).toBe(false);
    expect(scheduler.pendingCount).toBe(0);

    scheduler.advance(100);
    expect(fixedUpdates).toHaveLength(0);
    expect(rendered).toHaveLength(1);
  });

  it('can be restarted and re-establishes its time origin', () => {
    const { loop, scheduler, rendered } = createHarness();

    loop.start();
    scheduler.advance(16);
    loop.stop();

    loop.start();
    expect(scheduler.pendingCount).toBe(1);

    scheduler.advance(500); // treated as the new first frame
    expect(rendered).toHaveLength(2);

    scheduler.advance(100);
    expect(rendered).toHaveLength(3);
  });

  it('clamps a very long frame instead of simulating unboundedly', () => {
    const { loop, scheduler, fixedUpdates } = createHarness({ maxFrameDeltaMs: 250 });

    loop.start();
    scheduler.advance(16);
    scheduler.advance(60_000);

    expect(fixedUpdates).toHaveLength(5);
  });

  it('reports fps and frame time from the statistics window', () => {
    const { loop, scheduler } = createHarness({ statsWindowMs: 500 });

    loop.start();
    scheduler.advance(100); // origin frame
    scheduler.advanceFrames(5, 100);

    // Five 100 ms frames fill the 500 ms window.
    expect(loop.stats.fps).toBeCloseTo(10, 5);
    expect(loop.stats.frameTimeMs).toBeCloseTo(100, 5);
  });

  it('exposes the number of fixed steps for the last frame', () => {
    const { loop, scheduler } = createHarness();

    loop.start();
    scheduler.advance(16);
    scheduler.advance(120);

    expect(loop.stats.lastFixedStepCount).toBe(2);
    expect(loop.stats.totalFrames).toBe(2);
  });

  it('stops and reports errors thrown during updates', () => {
    const onError = vi.fn();
    const scheduler = new MockScheduler();
    const clock = new GameClock({ fixedTimestepMs: 50, maxCatchUpSteps: 10 });

    const loop = new GameLoop({
      clock,
      scheduler,
      onError,
      onFixedUpdate: () => {
        throw new Error('simulation exploded');
      },
      onRender: () => undefined,
    });

    loop.start();
    scheduler.advance(16);
    scheduler.advance(100);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(loop.isRunning).toBe(false);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('stops and reports errors thrown during rendering', () => {
    const onError = vi.fn();
    const scheduler = new MockScheduler();

    const loop = new GameLoop({
      clock: new GameClock({ fixedTimestepMs: 50, maxCatchUpSteps: 10 }),
      scheduler,
      onError,
      onFixedUpdate: () => undefined,
      onRender: () => {
        throw new Error('render failed');
      },
    });

    loop.start();
    scheduler.advance(16);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(loop.isRunning).toBe(false);
  });

  it('rethrows when no error handler is provided', () => {
    const scheduler = new MockScheduler();
    const loop = new GameLoop({
      clock: new GameClock({ fixedTimestepMs: 50, maxCatchUpSteps: 10 }),
      scheduler,
      onFixedUpdate: () => undefined,
      onRender: () => {
        throw new Error('boom');
      },
    });

    loop.start();
    expect(() => scheduler.advance(16)).toThrow('boom');
    expect(loop.isRunning).toBe(false);
  });

  it('rejects an invalid maxFrameDeltaMs', () => {
    expect(
      () =>
        new GameLoop({
          clock: new GameClock({ fixedTimestepMs: 50, maxCatchUpSteps: 10 }),
          scheduler: new MockScheduler(),
          maxFrameDeltaMs: 0,
          onFixedUpdate: () => undefined,
          onRender: () => undefined,
        }),
    ).toThrow(RangeError);
  });
});
