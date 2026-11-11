import { describe, expect, it } from 'vitest';

import { GameClock } from '../../src/core/GameClock';

function createClock(overrides: Partial<{ fixedTimestepMs: number; maxCatchUpSteps: number; maxFrameDeltaMs: number }> = {}) {
  return new GameClock({
    fixedTimestepMs: 50,
    maxCatchUpSteps: 10,
    maxFrameDeltaMs: 250,
    ...overrides,
  });
}

describe('GameClock', () => {
  it('accumulates partial frame time without stepping', () => {
    const clock = createClock();

    expect(clock.advance(16)).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.32);
    expect(clock.simulationTimeMs).toBe(0);
    expect(clock.tickCount).toBe(0);

    expect(clock.advance(16)).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.64);
  });

  it('emits a fixed step once the accumulator reaches the timestep', () => {
    const clock = createClock();

    clock.advance(20);
    clock.advance(20);
    expect(clock.tickCount).toBe(0);

    expect(clock.advance(20)).toBe(1);
    expect(clock.tickCount).toBe(1);
    expect(clock.simulationTimeMs).toBe(50);
    expect(clock.alpha).toBeCloseTo(10 / 50);
  });

  it('emits multiple steps for a large frame and keeps the remainder', () => {
    const clock = createClock();

    expect(clock.advance(120)).toBe(2);
    expect(clock.simulationTimeMs).toBe(100);
    expect(clock.alpha).toBeCloseTo(20 / 50);
  });

  it('clamps frame deltas to maxFrameDeltaMs', () => {
    const clock = createClock({ maxFrameDeltaMs: 250 });

    expect(clock.advance(10_000)).toBe(5);
    expect(clock.simulationTimeMs).toBe(250);
    expect(clock.droppedTimeMs).toBe(0);
  });

  it('caps catch-up steps and discards the excess backlog', () => {
    const clock = createClock({ maxCatchUpSteps: 3, maxFrameDeltaMs: 250 });

    expect(clock.advance(250)).toBe(3);
    expect(clock.simulationTimeMs).toBe(150);
    expect(clock.alpha).toBe(0);
    expect(clock.droppedTimeMs).toBe(100);
  });

  it('never reports an alpha outside [0, 1)', () => {
    const clock = createClock();
    for (const delta of [0, 1, 17, 33, 250, 1000, 7.5]) {
      clock.advance(delta);
      expect(clock.alpha).toBeGreaterThanOrEqual(0);
      expect(clock.alpha).toBeLessThan(1);
    }
  });

  it('ignores invalid or non-positive frame deltas', () => {
    const clock = createClock();

    for (const delta of [0, -10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(clock.advance(delta)).toBe(0);
    }
    expect(clock.simulationTimeMs).toBe(0);
    expect(clock.alpha).toBe(0);
  });

  it('is deterministic across identical delta sequences', () => {
    const a = createClock();
    const b = createClock();
    const deltas = Array.from({ length: 120 }, (_, index) => 8 + ((index * 7) % 23));

    const stepsA = deltas.map((delta) => a.advance(delta));
    const stepsB = deltas.map((delta) => b.advance(delta));

    expect(stepsA).toEqual(stepsB);
    expect(a.tickCount).toBe(b.tickCount);
    expect(a.simulationTimeMs).toBe(b.simulationTimeMs);
  });

  it('resets all counters', () => {
    const clock = createClock();
    clock.advance(100);
    clock.reset();

    expect(clock.tickCount).toBe(0);
    expect(clock.simulationTimeMs).toBe(0);
    expect(clock.alpha).toBe(0);
    expect(clock.droppedTimeMs).toBe(0);
  });

  it('rejects invalid configuration', () => {
    expect(() => createClock({ fixedTimestepMs: 0 })).toThrow(RangeError);
    expect(() => createClock({ fixedTimestepMs: -50 })).toThrow(RangeError);
    expect(() => createClock({ maxCatchUpSteps: 0 })).toThrow(RangeError);
    expect(() => createClock({ maxCatchUpSteps: 2.5 })).toThrow(RangeError);
    expect(() => createClock({ maxFrameDeltaMs: 0 })).toThrow(RangeError);
  });
});
