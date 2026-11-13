/**
 * Minimal control hint for the foundation first-person camera.
 *
 * It reflects the real pointer-lock state and never drives gameplay itself.
 */

export const CONTROLS_HINT_UNLOCKED =
  'Click to capture mouse · WASD move · Space jump · Shift sprint · E interact · G inspect belt · Q build · F demolish · Tab inventory';
export const CONTROLS_HINT_LOCKED =
  'WASD move · Space jump · Shift sprint · E interact · G inspect belt · Q build · F demolish · Tab inventory · Esc releases mouse';
export const CONSTRUCTION_HINT_UNLOCKED =
  'Left click place · Drag to look · Right click capture mouse · R rotate · Esc cancel';
export const CONSTRUCTION_HINT_LOCKED =
  'Left click place · Mouse look · R rotate · Esc cancel';

export class ControlsHint {
  private readonly element: HTMLElement;
  private locked = false;
  private constructing = false;
  private routing = false;

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

  setConstructionActive(active: boolean): void {
    if (this.constructing === active) return;
    this.constructing = active;
    this.render();
  }

  setRouteActive(active: boolean): void { if (this.routing !== active) { this.routing = active; this.render(); } }

  private render(): void {
    this.element.textContent = this.constructing && this.routing
      ? 'Click add point · Enter build · Backspace undo · R bend · T single cell · Esc cancel'
      : this.constructing
      ? (this.locked ? CONSTRUCTION_HINT_LOCKED : CONSTRUCTION_HINT_UNLOCKED)
      : (this.locked ? CONTROLS_HINT_LOCKED : CONTROLS_HINT_UNLOCKED);
    this.element.classList.toggle('is-locked', this.locked);
    this.element.setAttribute('data-locked', String(this.locked));
  }
}
