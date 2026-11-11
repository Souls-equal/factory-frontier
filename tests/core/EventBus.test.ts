import { describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../src/core/EventBus';

type TestEvents = {
  'test:ping': { readonly value: number };
  'test:other': Record<string, never>;
};

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    bus.on('test:ping', handler);
    bus.emit('test:ping', { value: 42 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('does not deliver after unsubscribe', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on('test:ping', handler);

    unsubscribe();
    unsubscribe();
    bus.emit('test:ping', { value: 1 });

    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount('test:ping')).toBe(0);
  });

  it('supports off() with the original handler reference', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    bus.on('test:ping', handler);
    bus.off('test:ping', handler);
    bus.emit('test:ping', { value: 2 });

    expect(handler).not.toHaveBeenCalled();
    expect(bus.eventNames()).toEqual([]);
  });

  it('invokes once() handlers a single time', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    bus.once('test:ping', handler);
    bus.emit('test:ping', { value: 1 });
    bus.emit('test:ping', { value: 2 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 1 });
    expect(bus.listenerCount('test:ping')).toBe(0);
  });

  it('tracks listener counts and clears subscribers', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('test:ping', () => undefined);
    bus.on('test:other', () => undefined);

    expect(bus.listenerCount('test:ping')).toBe(1);
    expect(bus.listenerCount('test:other')).toBe(1);
    expect(bus.eventNames()).toEqual(['test:ping', 'test:other']);

    bus.clear();
    expect(bus.listenerCount('test:ping')).toBe(0);
    expect(bus.eventNames()).toEqual([]);
  });

  it('isolates a throwing subscriber and still notifies the others', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const failure = new Error('listener failed');

    bus.on('test:ping', () => {
      throw failure;
    });
    bus.on('test:ping', second);

    expect(() => bus.emit('test:ping', { value: 3 })).toThrow(failure);
    expect(second).toHaveBeenCalledWith({ value: 3 });
  });

  it('aggregates multiple subscriber failures', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('test:ping', () => {
      throw new Error('first');
    });
    bus.on('test:ping', () => {
      throw new Error('second');
    });

    expect(() => bus.emit('test:ping', { value: 4 })).toThrow(AggregateError);
  });

  it('allows listeners to unsubscribe others during emit', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on('test:ping', handler);

    bus.on('test:other', () => unsubscribe());
    bus.emit('test:other', {});
    bus.emit('test:ping', { value: 5 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('emits without subscribers safely', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('test:ping', { value: 6 })).not.toThrow();
  });
});
