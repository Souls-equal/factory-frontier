/**
 * Explicit lifecycle state machine for the game.
 *
 * Keeping transitions in one place prevents systems from running in an
 * impossible state (for example simulating before the engine is initialized).
 */

export const GameStatus = Object.freeze({
  Created: 'created',
  Initialized: 'initialized',
  Running: 'running',
  Paused: 'paused',
  Stopped: 'stopped',
  Disposed: 'disposed',
} as const);

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

const ALLOWED_TRANSITIONS: Readonly<Record<GameStatus, readonly GameStatus[]>> = Object.freeze({
  [GameStatus.Created]: [GameStatus.Initialized, GameStatus.Disposed],
  [GameStatus.Initialized]: [GameStatus.Running, GameStatus.Stopped, GameStatus.Disposed],
  [GameStatus.Running]: [GameStatus.Paused, GameStatus.Stopped, GameStatus.Disposed],
  [GameStatus.Paused]: [GameStatus.Running, GameStatus.Stopped, GameStatus.Disposed],
  [GameStatus.Stopped]: [GameStatus.Disposed],
  [GameStatus.Disposed]: [],
});

export class GameStateError extends Error {
  constructor(
    readonly from: GameStatus,
    readonly to: GameStatus,
  ) {
    super(`Invalid game state transition: "${from}" -> "${to}".`);
    this.name = 'GameStateError';
  }
}

export class GameState {
  private currentStatus: GameStatus;

  constructor(initialStatus: GameStatus = GameStatus.Created) {
    this.currentStatus = initialStatus;
  }

  get status(): GameStatus {
    return this.currentStatus;
  }

  canTransitionTo(next: GameStatus): boolean {
    return ALLOWED_TRANSITIONS[this.currentStatus].includes(next);
  }

  /** Transition or throw a `GameStateError`. */
  transitionTo(next: GameStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new GameStateError(this.currentStatus, next);
    }
    this.currentStatus = next;
  }

  is(status: GameStatus): boolean {
    return this.currentStatus === status;
  }
}
