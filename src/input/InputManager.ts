/**
 * DOM input layer for the foundation first-person camera.
 *
 * Responsibilities are limited to translating browser events into movement
 * axes and accumulated look deltas. It contains no game logic and no rendering
 * knowledge, so it can be tested in jsdom.
 *
 * Look input supports both pointer lock (preferred) and click-drag as a
 * fallback when pointer lock is unavailable or denied.
 */

export interface MovementInput {
  /** Strafe axis: -1 left, +1 right. */
  readonly right: number;
  /** Forward axis: -1 backward, +1 forward. */
  readonly forward: number;
  readonly sprint: boolean;
}

export interface LookDelta {
  readonly x: number;
  readonly y: number;
}

export interface InputManagerOptions {
  readonly onPointerLockChange?: (locked: boolean) => void;
  readonly onInventoryToggle?: () => void;
  readonly onInventoryClose?: () => void;
  readonly onConstructionKey?: (code: string) => boolean;
}

const FORWARD_CODES = new Set(['KeyW']);
const BACKWARD_CODES = new Set(['KeyS']);
const LEFT_CODES = new Set(['KeyA']);
const RIGHT_CODES = new Set(['KeyD']);
const SPRINT_CODES = new Set(['ShiftLeft', 'ShiftRight']);
const JUMP_CODES = new Set(['Space']);
const INTERACT_CODES = new Set(['KeyE']);

export class InputManager {
  private readonly element: HTMLElement;
  private readonly view: Window;
  private readonly document: Document;
  private readonly keys = new Set<string>();
  private readonly onPointerLockChange: ((locked: boolean) => void) | undefined;
  private readonly onInventoryToggle: (() => void) | undefined;
  private readonly onInventoryClose: (() => void) | undefined;
  private readonly onConstructionKey: ((code: string) => boolean) | undefined;
  private gameplayEnabled = true;
  private restorePointerLockAfterModal = false;

  private dragging = false;
  private disposed = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lookX = 0;
  private lookY = 0;
  private jumpQueued = false;
  private interactQueued = false;

  constructor(element: HTMLElement, options: InputManagerOptions = {}) {
    const view = element.ownerDocument.defaultView;
    if (view === null) {
      throw new Error('InputManager requires an element attached to a browser document.');
    }

    this.element = element;
    this.document = element.ownerDocument;
    this.view = view;
    this.onPointerLockChange = options.onPointerLockChange;
    this.onInventoryToggle = options.onInventoryToggle;
    this.onInventoryClose = options.onInventoryClose;
    this.onConstructionKey = options.onConstructionKey;

    this.element.addEventListener('mousedown', this.handleMouseDown);
    this.view.addEventListener('keydown', this.handleKeyDown);
    this.view.addEventListener('keyup', this.handleKeyUp);
    this.view.addEventListener('mousemove', this.handleMouseMove);
    this.view.addEventListener('mouseup', this.handleMouseUp);
    this.view.addEventListener('blur', this.handleBlur);
    this.document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  get isPointerLocked(): boolean {
    return this.document.pointerLockElement === this.element;
  }

  /** Current movement axes, independent of mouse look. */
  getMovement(): MovementInput {
    return {
      right: Number(this.isHeld(RIGHT_CODES)) - Number(this.isHeld(LEFT_CODES)),
      forward: Number(this.isHeld(FORWARD_CODES)) - Number(this.isHeld(BACKWARD_CODES)),
      sprint: this.isHeld(SPRINT_CODES),
    };
  }

  /**
   * Consume a queued jump press.
   *
   * Jump is edge-triggered: holding the key does not queue repeatedly, and the
   * simulation consumes the flag exactly once.
   */
  consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  /** Consume a queued interact press (edge-triggered, exactly once). */
  consumeInteract(): boolean {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  /** Return the accumulated mouse delta since the last call and reset it. */
  consumeLookDelta(): LookDelta {
    const delta = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return delta;
  }

  /** Suspend gameplay while a modal is open; clear queued input and release capture. */
  setGameplayEnabled(enabled: boolean): void {
    this.gameplayEnabled = enabled;
    this.keys.clear(); this.dragging = false;
    this.jumpQueued = false; this.interactQueued = false;
    this.lookX = 0; this.lookY = 0;
    if (!enabled && this.isPointerLocked) {
      try { this.document.exitPointerLock(); } catch { /* capture release is best effort */ }
    }
  }

  /** Remember capture before opening a modal, then release it for UI use. */
  suspendForModal(): void {
    if (!this.gameplayEnabled) return;
    this.restorePointerLockAfterModal = this.isPointerLocked;
    this.setGameplayEnabled(false);
  }

  /** Call synchronously from the close gesture; browsers may still deny capture. */
  resumeFromModal(): void {
    const restore = this.restorePointerLockAfterModal;
    this.restorePointerLockAfterModal = false;
    this.setGameplayEnabled(true);
    this.element.focus({ preventScroll: true });
    if (restore) this.requestPointerLock();
  }

  /** Request pointer lock; drag-look remains available if it is denied. */
  requestPointerLock(): void {
    if (this.disposed || !this.gameplayEnabled) {
      return;
    }

    const element = this.element as HTMLElement & { requestPointerLock?: () => unknown };
    if (typeof element.requestPointerLock !== 'function') {
      return;
    }

    try {
      const result = element.requestPointerLock();
      if (result instanceof Promise) {
        void result.catch(() => undefined);
      }
    } catch {
      // Pointer lock is optional; click-drag look still works.
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.restorePointerLockAfterModal = false;

    this.element.removeEventListener('mousedown', this.handleMouseDown);
    this.view.removeEventListener('keydown', this.handleKeyDown);
    this.view.removeEventListener('keyup', this.handleKeyUp);
    this.view.removeEventListener('mousemove', this.handleMouseMove);
    this.view.removeEventListener('mouseup', this.handleMouseUp);
    this.view.removeEventListener('blur', this.handleBlur);
    this.document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.keys.clear();
    this.dragging = false;
    this.lookX = 0;
    this.lookY = 0;
    this.jumpQueued = false;
    this.interactQueued = false;

    if (this.document.pointerLockElement === this.element) {
      try {
        this.document.exitPointerLock();
      } catch {
        // Releasing pointer lock is best-effort during teardown.
      }
    }
  }

  private isHeld(codes: ReadonlySet<string>): boolean {
    for (const code of codes) {
      if (this.keys.has(code)) {
        return true;
      }
    }
    return false;
  }

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (!this.gameplayEnabled || event.button !== 0) {
      return;
    }
    this.dragging = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.requestPointerLock();
  };

  private readonly handleMouseUp = (): void => {
    this.dragging = false;
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.gameplayEnabled) return;
    if (this.isPointerLocked) {
      const movementX = Number.isFinite(event.movementX) ? event.movementX : 0;
      const movementY = Number.isFinite(event.movementY) ? event.movementY : 0;
      this.lookX += movementX;
      this.lookY += movementY;
      return;
    }

    if (!this.dragging) {
      return;
    }

    this.lookX += event.clientX - this.lastPointerX;
    this.lookY += event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) {
      return;
    }
    if (this.onConstructionKey && ['KeyQ', 'KeyR', 'KeyC', 'KeyF', 'Escape'].includes(event.code)) {
      if (!event.repeat && this.onConstructionKey(event.code)) { event.preventDefault(); return; }
      if (event.repeat && ['KeyQ', 'KeyR', 'KeyC', 'KeyF'].includes(event.code)) { event.preventDefault(); return; }
    }
    if (event.code === 'Tab' && this.onInventoryToggle) {
      event.preventDefault();
      if (!event.repeat) this.onInventoryToggle();
      return;
    }
    if (event.code === 'Escape' && !this.gameplayEnabled && this.onInventoryClose) {
      event.preventDefault();
      if (!event.repeat) this.onInventoryClose();
      return;
    }
    if (!this.gameplayEnabled || !this.isHandledCode(event.code)) return;

    // Space would scroll the page in a browser without a focused control.
    if (JUMP_CODES.has(event.code)) {
      event.preventDefault();
    }

    // `event.repeat` filters OS key-repeat so edge-triggered actions fire once.
    if (!event.repeat) {
      if (JUMP_CODES.has(event.code)) {
        this.jumpQueued = true;
      }
      if (INTERACT_CODES.has(event.code)) {
        this.interactQueued = true;
      }
    }

    this.keys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.keys.clear();
    this.dragging = false;
    this.jumpQueued = false;
    this.interactQueued = false;
  };

  private readonly handleVisibilityChange = (): void => {
    if (this.document.visibilityState === 'hidden') {
      this.keys.clear();
      this.dragging = false;
      this.jumpQueued = false;
      this.interactQueued = false;
    }
  };

  private readonly handlePointerLockChange = (): void => {
    if (this.disposed) {
      return;
    }
    this.dragging = false;
    // A pending pointer-lock request may resolve after the inventory opens.
    if (!this.gameplayEnabled && this.isPointerLocked) {
      try { this.document.exitPointerLock(); } catch { /* release remains best effort */ }
    }
    this.onPointerLockChange?.(this.isPointerLocked);
  };

  private isHandledCode(code: string): boolean {
    return (
      FORWARD_CODES.has(code) ||
      BACKWARD_CODES.has(code) ||
      LEFT_CODES.has(code) ||
      RIGHT_CODES.has(code) ||
      SPRINT_CODES.has(code) ||
      JUMP_CODES.has(code) ||
      INTERACT_CODES.has(code)
    );
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element === null || typeof element.tagName !== 'string') {
    return false;
  }

  const tagName = element.tagName.toUpperCase();
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || element.isContentEditable;
}
