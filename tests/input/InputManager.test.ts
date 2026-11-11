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
