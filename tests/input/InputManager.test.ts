// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InputManager } from '../../src/input/InputManager';

let canvas: HTMLCanvasElement;
let input: InputManager | undefined;

function keyDown(code: string, target: EventTarget = window): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
}

function keyUp(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}

function mouseDown(clientX = 100, clientY = 100, button = 0): void {
  canvas.dispatchEvent(
    new MouseEvent('mousedown', { button, clientX, clientY, bubbles: true }),
  );
}

function mouseMove(clientX: number, clientY: number): void {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
}

function lockedMouseMove(movementX: number, movementY: number): void {
  const event = new MouseEvent('mousemove', { bubbles: true });
  Object.defineProperty(event, 'movementX', { value: movementX });
  Object.defineProperty(event, 'movementY', { value: movementY });
  window.dispatchEvent(event);
}

function setPointerLockElement(element: Element | null): void {
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    value: element,
  });
  document.dispatchEvent(new Event('pointerlockchange'));
}

beforeEach(() => {
  document.body.innerHTML = '';
  canvas = document.createElement('canvas');
  document.body.append(canvas);
  setPointerLockElement(null);
});

afterEach(() => {
  input?.dispose();
  input = undefined;
  setPointerLockElement(null);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('InputManager keyboard', () => {
  it('reports movement axes and sprint state', () => {
    input = new InputManager(canvas);

    keyDown('KeyW');
    expect(input.getMovement()).toEqual({ right: 0, forward: 1, sprint: false });

    keyDown('KeyD');
    keyDown('ShiftLeft');
    expect(input.getMovement()).toEqual({ right: 1, forward: 1, sprint: true });

    keyUp('KeyW');
    expect(input.getMovement()).toEqual({ right: 1, forward: 0, sprint: true });

    keyUp('ShiftLeft');
    expect(input.getMovement().sprint).toBe(false);
  });

  it('supports both shift keys for sprint', () => {
    input = new InputManager(canvas);

    keyDown('ShiftRight');
    expect(input.getMovement().sprint).toBe(true);
    keyUp('ShiftRight');
    expect(input.getMovement().sprint).toBe(false);
  });

  it('clears held keys on window blur', () => {
    input = new InputManager(canvas);
    keyDown('KeyW');
    window.dispatchEvent(new Event('blur'));

    expect(input.getMovement().forward).toBe(0);
  });

  it('ignores keys while the user is typing in a form control', () => {
    input = new InputManager(canvas);
    const field = document.createElement('input');
    document.body.append(field);

    keyDown('KeyW', field);

    expect(input.getMovement().forward).toBe(0);
  });

  it('ignores unrelated keys', () => {
    input = new InputManager(canvas);
    keyDown('KeyQ');

    expect(input.getMovement()).toEqual({ right: 0, forward: 0, sprint: false });
  });
});

describe('InputManager look input', () => {
  it('accumulates drag deltas and consumes them once', () => {
    input = new InputManager(canvas);

    mouseDown(100, 100);
    mouseMove(110, 95);
    mouseMove(115, 90);

    expect(input.consumeLookDelta()).toEqual({ x: 15, y: -10 });
    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
  });

  it('does not accumulate look while merely hovering', () => {
    input = new InputManager(canvas);
    mouseMove(50, 50);

    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
  });

  it('stops dragging on mouse up', () => {
    input = new InputManager(canvas);
    mouseDown(10, 10);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    mouseMove(90, 90);

    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
  });

  it('uses movementX/movementY while pointer-locked', () => {
    input = new InputManager(canvas);
    setPointerLockElement(canvas);

    expect(input.isPointerLocked).toBe(true);
    lockedMouseMove(7, -3);

    expect(input.consumeLookDelta()).toEqual({ x: 7, y: -3 });
  });
});

describe('InputManager pointer lock', () => {
  it('requests pointer lock on primary click', () => {
    const requestPointerLock = vi.fn();
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: requestPointerLock,
    });
    input = new InputManager(canvas);

    mouseDown();

    expect(requestPointerLock).toHaveBeenCalledOnce();
  });

  it('does not request pointer lock on non-primary clicks', () => {
    const requestPointerLock = vi.fn();
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: requestPointerLock,
    });
    input = new InputManager(canvas);

    mouseDown(10, 10, 2);

    expect(requestPointerLock).not.toHaveBeenCalled();
  });

  it('reports pointer-lock changes', () => {
    const onChange = vi.fn();
    input = new InputManager(canvas, { onPointerLockChange: onChange });

    setPointerLockElement(canvas);
    expect(onChange).toHaveBeenLastCalledWith(true);

    setPointerLockElement(null);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('handles a rejected pointer-lock promise without throwing', () => {
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: () => Promise.reject(new Error('denied')),
    });
    input = new InputManager(canvas);

    expect(() => mouseDown()).not.toThrow();
  });

  it('tolerates browsers without pointer lock', () => {
    input = new InputManager(canvas);

    expect(() => mouseDown()).not.toThrow();

    // Drag-look still works as a fallback.
    mouseMove(20, 20);
    expect(input.consumeLookDelta()).toEqual({ x: -80, y: -80 });
  });
});

describe('InputManager disposal', () => {
  it('removes listeners and stops reporting input', () => {
    input = new InputManager(canvas);
    input.dispose();

    keyDown('KeyW');
    mouseDown(10, 10);
    mouseMove(50, 50);

    expect(input.getMovement().forward).toBe(0);
    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    expect(input.isPointerLocked).toBe(false);
  });

  it('is idempotent', () => {
    input = new InputManager(canvas);
    input.dispose();
    expect(() => input?.dispose()).not.toThrow();
  });
});

describe('InputManager action edges', () => {
  it('queues a jump press exactly once per key press', () => {
    input = new InputManager(canvas);

    keyDown('Space');
    expect(input.consumeJump()).toBe(true);
    expect(input.consumeJump()).toBe(false);
  });

  it('ignores key auto-repeat for edge-triggered actions', () => {
    input = new InputManager(canvas);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, bubbles: true }));
    expect(input.consumeJump()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: true, bubbles: true }));
    expect(input.consumeInteract()).toBe(false);
  });

  it('queues an interact press exactly once per key press', () => {
    input = new InputManager(canvas);

    keyDown('KeyE');
    expect(input.consumeInteract()).toBe(true);
    expect(input.consumeInteract()).toBe(false);
  });

  it('clears queued actions on window blur', () => {
    input = new InputManager(canvas);

    keyDown('Space');
    keyDown('KeyE');
    window.dispatchEvent(new Event('blur'));

    expect(input.consumeJump()).toBe(false);
    expect(input.consumeInteract()).toBe(false);
  });

  it('ignores action keys typed into an input field', () => {
    input = new InputManager(canvas);
    const field = document.createElement('input');
    document.body.append(field);

    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));

    expect(input.consumeJump()).toBe(false);
    expect(input.consumeInteract()).toBe(false);
  });
});

describe('inventory modal input isolation', () => {
  it('releases a late pointer-lock grant while the modal is open', () => {
    const canvas = document.createElement('canvas'); document.body.append(canvas);
    const exit = vi.fn();
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: canvas });
    Object.defineProperty(document, 'exitPointerLock', { configurable: true, value: exit });
    const input = new InputManager(canvas);
    input.setGameplayEnabled(false);
    exit.mockClear();
    document.dispatchEvent(new Event('pointerlockchange'));
    expect(exit).toHaveBeenCalledOnce();
    input.dispose();
    Reflect.deleteProperty(document, 'pointerLockElement');
    Reflect.deleteProperty(document, 'exitPointerLock');
    canvas.remove();
  });

  it('toggles via Tab, clears held actions and look, and restores controls', () => {
    const canvas = document.createElement('canvas'); document.body.append(canvas);
    let opened = false;
    let input: InputManager;
    input = new InputManager(canvas, {
      onInventoryToggle: () => { opened = !opened; input.setGameplayEnabled(!opened); },
      onInventoryClose: () => { opened = false; input.setGameplayEnabled(true); },
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    expect(input.getMovement().forward).toBe(1);
    const tab = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true });
    window.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true); expect(opened).toBe(true);
    expect(input.getMovement().forward).toBe(0); expect(input.consumeInteract()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
    expect(input.getMovement().forward).toBe(0); expect(input.consumeJump()).toBe(false);
    expect(input.consumeInteract()).toBe(false); expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    expect(opened).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.getMovement().forward).toBe(1); input.dispose(); canvas.remove();
  });
});

describe('pointer lock restoration around the inventory', () => {
  it('releases and requests previous pointer lock during the close gesture', () => {
    const request = vi.fn(); const exit = vi.fn(() => setPointerLockElement(null));
    Object.defineProperty(canvas, 'requestPointerLock', { configurable: true, value: request });
    Object.defineProperty(document, 'exitPointerLock', { configurable: true, value: exit });
    canvas.tabIndex = 0;
    input = new InputManager(canvas);
    setPointerLockElement(canvas);
    input.suspendForModal();
    expect(exit).toHaveBeenCalledOnce();
    expect(input.isPointerLocked).toBe(false);
    input.resumeFromModal();
    expect(document.activeElement).toBe(canvas);
    expect(request).toHaveBeenCalledOnce();
    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    Reflect.deleteProperty(document, 'exitPointerLock');
  });
  it('does not request capture when opening unlocked', () => {
    const request = vi.fn();
    Object.defineProperty(canvas, 'requestPointerLock', { configurable: true, value: request });
    input = new InputManager(canvas);
    input.suspendForModal(); input.resumeFromModal();
    expect(request).not.toHaveBeenCalled();
  });
  it('falls back safely when the browser rejects a restoration request', async () => {
    const request = vi.fn().mockRejectedValue(new Error('user gesture required'));
    const exit = vi.fn(() => setPointerLockElement(null));
    Object.defineProperty(canvas, 'requestPointerLock', { configurable: true, value: request });
    Object.defineProperty(document, 'exitPointerLock', { configurable: true, value: exit });
    input = new InputManager(canvas); setPointerLockElement(canvas);
    input.suspendForModal(); input.resumeFromModal();
    await Promise.resolve();
    expect(request).toHaveBeenCalledOnce();
    keyDown('KeyW');
    expect(input.getMovement().forward).toBe(1);
    expect(input.isPointerLocked).toBe(false);
    Reflect.deleteProperty(document, 'exitPointerLock');
  });
});

describe('look discontinuities', () => {
  it('discards isolated pointer-lock spikes but preserves ordinary fast events', () => {
    input = new InputManager(canvas); setPointerLockElement(canvas);
    lockedMouseMove(12, -4); lockedMouseMove(4000, -8000); lockedMouseMove(180, 20);
    expect(input.consumeLookDelta()).toEqual({ x: 192, y: 16 });
    for (let i = 0; i < 5; i++) lockedMouseMove(100, 0);
    expect(input.consumeLookDelta()).toEqual({ x: 500, y: 0 });
  });
  it('preserves large deliberate drag movements when pointer lock is unavailable', () => {
    input = new InputManager(canvas); mouseDown(10, 10);
    mouseMove(20, 14); mouseMove(1200, 700); mouseMove(1210, 705);
    expect(input.consumeLookDelta()).toEqual({ x: 1200, y: 695 });
  });
  it('clears pending look on blur, visibility loss and pointer-lock changes', () => {
    input = new InputManager(canvas); setPointerLockElement(canvas);
    lockedMouseMove(20, 5); window.dispatchEvent(new Event('blur'));
    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    lockedMouseMove(20, 5); setPointerLockElement(null);
    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    setPointerLockElement(canvas); lockedMouseMove(20, 5);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(input.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    Reflect.deleteProperty(document, 'visibilityState');
  });
});
