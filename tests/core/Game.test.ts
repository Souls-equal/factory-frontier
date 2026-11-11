import { describe, expect, it, vi } from 'vitest';

import { createGameConfig, type GameConfig } from '../../src/core/Configuration';
import { Game, GameLifecycleError } from '../../src/core/Game';
import { GameStatus } from '../../src/core/GameState';
import { FakeEngine } from '../helpers/FakeEngine';
import { MockScheduler } from '../helpers/MockScheduler';

function createHarness(options: { config?: GameConfig; onError?: (error: unknown) => void } = {}) {
  const engine = new FakeEngine();
  const scheduler = new MockScheduler();
  const config = options.config ?? createGameConfig();
  const game = new Game({
    config,
    engine,
    scheduler,
    ...(options.onError !== undefined ? { onError: options.onError } : {}),
  });

  return { game, engine, scheduler, config };
}

describe('Game lifecycle', () => {
  it('initializes the engine and emits an event', async () => {
    const { game, engine } = createHarness();
    const listener = vi.fn();
    game.eventBus.on('game:initialized', listener);

    await game.init();

    expect(game.status).toBe(GameStatus.Initialized);
    expect(engine.initCalls).toBe(1);
    expect(listener).toHaveBeenCalledWith({ simulationTimeMs: 0 });
  });

  it('refuses to start before initialization', () => {
    const { game } = createHarness();

    expect(() => game.start()).toThrow(GameLifecycleError);
    expect(game.status).toBe(GameStatus.Created);
  });

  it('refuses to initialize twice', async () => {
    const { game, engine } = createHarness();
    await game.init();

    await expect(game.init()).rejects.toThrow(GameLifecycleError);
    expect(engine.initCalls).toBe(1);
  });

  it('reports engine initialization failures without corrupting state', async () => {
    const { game, engine } = createHarness();
    const errorListener = vi.fn();
    game.eventBus.on('game:error', errorListener);
    const failure = new Error('no WebGL');
    engine.initError = failure;

    await expect(game.init()).rejects.toThrow(failure);
    expect(game.status).toBe(GameStatus.Created);
    expect(errorListener).toHaveBeenCalledWith({ error: failure, phase: 'initialization' });

    engine.initError = null;
    await expect(game.init()).resolves.toBeUndefined();
    expect(game.status).toBe(GameStatus.Initialized);
  });

  it('starts, renders and stops the loop', async () => {
    const { game, engine, scheduler } = createHarness();
    const started = vi.fn();
    game.eventBus.on('game:started', started);
    await game.init();

    game.start();
    expect(game.status).toBe(GameStatus.Running);
    expect(started).toHaveBeenCalledOnce();
    expect(scheduler.pendingCount).toBe(1);

    scheduler.advance(16);
    expect(engine.renderCalls).toEqual([0]);

    scheduler.advance(100);
    expect(engine.renderCalls).toHaveLength(2);

    game.stop();
    expect(game.status).toBe(GameStatus.Stopped);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('pauses and resumes without losing the simulation clock', async () => {
    const { game, scheduler } = createHarness();
    const paused = vi.fn();
    const resumed = vi.fn();
    game.eventBus.on('game:paused', paused);
    game.eventBus.on('game:resumed', resumed);

    await game.init();
    game.start();
    scheduler.advance(16);
    scheduler.advance(100);

    const simTimeBeforePause = game.stats.simulationTimeMs;
    game.pause();
    expect(game.status).toBe(GameStatus.Paused);
    expect(paused).toHaveBeenCalledOnce();
    expect(scheduler.pendingCount).toBe(0);

    scheduler.advance(500);
    expect(game.stats.simulationTimeMs).toBe(simTimeBeforePause);

    game.resume();
    expect(game.status).toBe(GameStatus.Running);
    expect(resumed).toHaveBeenCalledOnce();
    expect(scheduler.pendingCount).toBe(1);
  });

  it('rejects invalid pause/resume ordering', async () => {
    const { game } = createHarness();
    await game.init();

    expect(() => game.pause()).toThrow(GameLifecycleError);
    expect(() => game.resume()).toThrow(GameLifecycleError);
  });
});

describe('Game simulation systems', () => {
  it('drives registered systems at the fixed timestep', async () => {
    const { game, scheduler } = createHarness();
    const updates: number[] = [];
    game.registerSystem({ id: 'test', fixedUpdate: (delta) => updates.push(delta) });

    await game.init();
    game.start();
    scheduler.advance(16);
    scheduler.advance(120);

    expect(updates).toEqual([50, 50]);
    expect(game.stats.tickCount).toBe(2);
    expect(game.stats.simulationTimeMs).toBe(100);
  });

  it('passes the interpolation alpha to the engine renderer', async () => {
    const { game, engine, scheduler } = createHarness();
    await game.init();
    game.start();

    scheduler.advance(16);
    scheduler.advance(20);
    scheduler.advance(20);

    const alpha = engine.renderCalls.at(-1);
    expect(alpha).toBeDefined();
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('prevents duplicate and empty system ids', async () => {
    const { game } = createHarness();
    const system = { id: 'duplicate', fixedUpdate: () => undefined };

    game.registerSystem(system);
    expect(() => game.registerSystem(system)).toThrow(/already registered/);
    expect(() => game.registerSystem({ id: '  ', fixedUpdate: () => undefined })).toThrow(/must not be empty/);
  });

  it('unregisters systems through the returned disposer', async () => {
    const { game, scheduler } = createHarness();
    const updates: number[] = [];
    const unregister = game.registerSystem({
      id: 'removable',
      fixedUpdate: () => updates.push(1),
    });

    unregister();
    unregister();
    expect(game.unregisterSystem('removable')).toBe(false);

    await game.init();
    game.start();
    scheduler.advance(16);
    scheduler.advance(100);

    expect(updates).toHaveLength(0);
    expect(game.stats.systems).toBe(0);
  });
});

describe('Game error handling', () => {
  it('stops the game and reports a failing simulation system', async () => {
    const onError = vi.fn();
    const { game, scheduler } = createHarness({ onError });
    const errorListener = vi.fn();
    game.eventBus.on('game:error', errorListener);
    const failure = new Error('system failure');
    game.registerSystem({
      id: 'broken',
      fixedUpdate: () => {
        throw failure;
      },
    });

    await game.init();
    game.start();
    scheduler.advance(16);
    scheduler.advance(100);

    expect(game.status).toBe(GameStatus.Stopped);
    expect(scheduler.pendingCount).toBe(0);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(errorListener).toHaveBeenCalledWith({ error: failure, phase: 'frame' });
  });
});

describe('Game sizing and statistics', () => {
  it('resizes the engine and emits a resize event', async () => {
    const { game, engine } = createHarness();
    const listener = vi.fn();
    game.eventBus.on('engine:resized', listener);
    await game.init();

    game.resize(1280, 720, 2);

    expect(engine.resizeCalls).toEqual([{ width: 1280, height: 720, pixelRatio: 2 }]);
    expect(listener).toHaveBeenCalledWith({ width: 1280, height: 720, pixelRatio: 2 });
  });

  it('rejects invalid viewport sizes', async () => {
    const { game } = createHarness();
    await game.init();

    expect(() => game.resize(0, 720)).toThrow(RangeError);
    expect(() => game.resize(1280, -1)).toThrow(RangeError);
    expect(() => game.resize(Number.NaN, 720)).toThrow(RangeError);
    expect(() => game.resize(1280, 720, 0)).toThrow(RangeError);
  });

  it('combines engine and loop statistics', async () => {
    const { game } = createHarness();

    await game.init();
    const stats = game.stats;

    expect(stats.status).toBe(GameStatus.Initialized);
    expect(stats.systems).toBe(0);
    expect(stats.drawCalls).toBe(7);
    expect(stats.triangles).toBe(1200);
  });
});

describe('Game disposal', () => {
  it('stops the loop, disposes the engine and clears listeners', async () => {
    const { game, engine, scheduler } = createHarness();
    const disposed = vi.fn();
    game.eventBus.on('game:disposed', disposed);
    const leftover = vi.fn();
    game.eventBus.on('game:started', leftover);

    await game.init();
    game.start();
    scheduler.advance(16);
    game.dispose();

    expect(game.status).toBe(GameStatus.Disposed);
    expect(engine.disposeCalls).toBe(1);
    expect(scheduler.pendingCount).toBe(0);
    expect(disposed).toHaveBeenCalledOnce();
    expect(game.eventBus.listenerCount('game:started')).toBe(0);
    expect(game.stats.drawCalls).toBe(0);
  });

  it('is idempotent', async () => {
    const { game, engine } = createHarness();
    await game.init();

    game.dispose();
    game.dispose();

    expect(engine.disposeCalls).toBe(1);
  });

  it('refuses new systems after disposal', async () => {
    const { game } = createHarness();
    await game.init();
    game.dispose();

    expect(() => game.registerSystem({ id: 'late', fixedUpdate: () => undefined })).toThrow(/disposed/);
  });

  it('ignores resize after disposal', async () => {
    const { game, engine } = createHarness();
    await game.init();
    game.dispose();
    game.resize(800, 600);

    expect(engine.resizeCalls).toEqual([]);
  });
});
