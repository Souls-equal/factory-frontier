import { describe, expect, it } from 'vitest';

import { GameState, GameStateError, GameStatus } from '../../src/core/GameState';

describe('GameState', () => {
  it('starts in the created state', () => {
    expect(new GameState().status).toBe(GameStatus.Created);
  });

  it('walks the full happy-path lifecycle', () => {
    const state = new GameState();

    state.transitionTo(GameStatus.Initialized);
    state.transitionTo(GameStatus.Running);
    state.transitionTo(GameStatus.Paused);
    state.transitionTo(GameStatus.Running);
    state.transitionTo(GameStatus.Stopped);
    state.transitionTo(GameStatus.Disposed);

    expect(state.status).toBe(GameStatus.Disposed);
  });

  it('allows disposing from any live state', () => {
    expect(() => new GameState().transitionTo(GameStatus.Disposed)).not.toThrow();

    const initialized = new GameState(GameStatus.Initialized);
    expect(() => initialized.transitionTo(GameStatus.Disposed)).not.toThrow();

    const running = new GameState(GameStatus.Running);
    expect(() => running.transitionTo(GameStatus.Disposed)).not.toThrow();

    const paused = new GameState(GameStatus.Paused);
    expect(() => paused.transitionTo(GameStatus.Disposed)).not.toThrow();
  });

  it('rejects running before initialization', () => {
    const state = new GameState();

    expect(state.canTransitionTo(GameStatus.Running)).toBe(false);
    expect(() => state.transitionTo(GameStatus.Running)).toThrow(GameStateError);
    expect(state.status).toBe(GameStatus.Created);
  });

  it('rejects pausing when not running', () => {
    const state = new GameState(GameStatus.Initialized);
    expect(() => state.transitionTo(GameStatus.Paused)).toThrow(GameStateError);
  });

  it('rejects resuming when not paused', () => {
    const state = new GameState(GameStatus.Running);
    expect(() => state.transitionTo(GameStatus.Running)).toThrow(GameStateError);
  });

  it('treats disposed as terminal', () => {
    const state = new GameState(GameStatus.Disposed);
    expect(state.canTransitionTo(GameStatus.Initialized)).toBe(false);
    expect(state.canTransitionTo(GameStatus.Running)).toBe(false);
    expect(() => state.transitionTo(GameStatus.Stopped)).toThrow(GameStateError);
  });

  it('exposes the invalid transition details', () => {
    const state = new GameState(GameStatus.Created);

    try {
      state.transitionTo(GameStatus.Running);
      expect.unreachable('transition should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(GameStateError);
      const stateError = error as GameStateError;
      expect(stateError.from).toBe(GameStatus.Created);
      expect(stateError.to).toBe(GameStatus.Running);
      expect(stateError.message).toContain('created');
      expect(stateError.message).toContain('running');
    }
  });

  it('does not allow restarting a stopped game', () => {
    const state = new GameState(GameStatus.Stopped);
    expect(state.canTransitionTo(GameStatus.Initialized)).toBe(false);
    expect(state.canTransitionTo(GameStatus.Running)).toBe(false);
    expect(state.canTransitionTo(GameStatus.Disposed)).toBe(true);
  });

  it('reports the current status with is()', () => {
    const state = new GameState(GameStatus.Running);
    expect(state.is(GameStatus.Running)).toBe(true);
    expect(state.is(GameStatus.Paused)).toBe(false);
  });
});
