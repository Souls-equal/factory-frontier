/**
 * Typed, synchronous publish/subscribe bus.
 *
 * Independent systems communicate through events instead of importing each
 * other (see `docs/TECHNICAL_ARCHITECTURE.md`, §20.4).
 */

export type EventMap = Record<string, unknown>;
export type EventHandler<Payload> = (payload: Payload) => void;

export class EventBus<Events extends EventMap> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<never>>>();

  /** Subscribe to an event. Returns an idempotent unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    let handlersForEvent = this.handlers.get(event);
    if (handlersForEvent === undefined) {
      handlersForEvent = new Set();
      this.handlers.set(event, handlersForEvent);
    }
    const typedHandler = handler as EventHandler<never>;
    handlersForEvent.add(typedHandler);

    return () => {
      this.off(event, handler);
    };
  }

  /** Subscribe to the next occurrence of an event only. */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const handlersForEvent = this.handlers.get(event);
    if (handlersForEvent === undefined) {
      return;
    }
    handlersForEvent.delete(handler as EventHandler<never>);
    if (handlersForEvent.size === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * Emit an event to every current subscriber.
   *
   * A failing subscriber never prevents the others from receiving the event.
   * Errors are re-thrown afterwards so that genuine bugs stay visible.
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const handlersForEvent = this.handlers.get(event);
    if (handlersForEvent === undefined || handlersForEvent.size === 0) {
      return;
    }

    const errors: unknown[] = [];
    // Iterate over a snapshot so subscribing/unsubscribing during emit is safe.
    for (const handler of [...handlersForEvent]) {
      try {
        (handler as EventHandler<Events[K]>)(payload);
      } catch (error) {
        errors.push(error);
      }
    }

    const [firstError, ...otherErrors] = errors;
    if (firstError !== undefined) {
      if (otherErrors.length > 0) {
        throw new AggregateError(errors, `Multiple handlers failed for event "${String(event)}".`);
      }
      throw firstError;
    }
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  eventNames(): Array<keyof Events> {
    return [...this.handlers.keys()];
  }

  clear(): void {
    this.handlers.clear();
  }
}
