// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  CONTROLS_HINT_LOCKED,
  CONTROLS_HINT_UNLOCKED,
  ControlsHint,
} from '../../src/ui/ControlsHint';

beforeEach(() => {
  document.body.innerHTML = '<div data-ui="controls-hint"></div>';
});

describe('ControlsHint', () => {
  it('binds the controls hint element', () => {
    const hint = ControlsHint.fromDocument(document);
    expect(hint.isPointerLocked).toBe(false);
  });

  it('throws a descriptive error when the element is missing', () => {
    document.body.innerHTML = '';
    expect(() => ControlsHint.fromDocument(document)).toThrow(/controls-hint/);
  });

  it('shows the unlocked instructions by default', () => {
    ControlsHint.fromDocument(document);
    const element = document.querySelector<HTMLElement>('[data-ui="controls-hint"]');

    expect(element?.textContent).toBe(CONTROLS_HINT_UNLOCKED);
    expect(element?.getAttribute('data-locked')).toBe('false');
    expect(element?.classList.contains('is-locked')).toBe(false);
  });

  it('updates the text and state when pointer lock changes', () => {
    const hint = ControlsHint.fromDocument(document);
    const element = document.querySelector<HTMLElement>('[data-ui="controls-hint"]');

    hint.setPointerLocked(true);
    expect(hint.isPointerLocked).toBe(true);
    expect(element?.textContent).toBe(CONTROLS_HINT_LOCKED);
    expect(element?.getAttribute('data-locked')).toBe('true');
    expect(element?.classList.contains('is-locked')).toBe(true);

    hint.setPointerLocked(false);
    expect(element?.textContent).toBe(CONTROLS_HINT_UNLOCKED);
    expect(element?.classList.contains('is-locked')).toBe(false);
  });
});
