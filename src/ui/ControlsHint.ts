/**
 * Minimal control hint for the foundation first-person camera.
 *
 * It reflects the real pointer-lock state and never drives gameplay itself.
 */

export const CONTROLS_HINT_UNLOCKED =
  'Click to capture mouse · WASD move · Space jump · Shift sprint · E interact · Q build · F demolish · Tab inventory';
export const CONTROLS_HINT_LOCKED =
  'WASD move · Space jump · Shift sprint · E interact · Q build · F demolish · Tab inventory · Esc releases mouse';

export class ControlsHint {
  private readonly element: HTMLElement;
  private locked = false;

  private constructor(element: HTMLElement) {
    this.element = element;
    this.render();
  }

  static fromDocument(root: ParentNode = document): ControlsHint {
    const element = root.querySelector<HTMLElement>('[data-ui="controls-hint"]');
    if (element === null) {
      throw new Error('ControlsHint: required UI element \'[data-ui="controls-hint"]\' was not found.');
    }
    return new ControlsHint(element);
  }

  get isPointerLocked(): boolean {
    return this.locked;
  }

  setPointerLocked(locked: boolean): void {
    if (this.locked === locked) {
      return;
    }
    this.locked = locked;
    this.render();
  }

  private render(): void {
    this.element.textContent = this.locked ? CONTROLS_HINT_LOCKED : CONTROLS_HINT_UNLOCKED;
    this.element.classList.toggle('is-locked', this.locked);
    this.element.setAttribute('data-locked', String(this.locked));
  }
}
