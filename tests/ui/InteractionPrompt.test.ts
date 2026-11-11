// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InteractionPrompt } from '../../src/ui/InteractionPrompt';

function buildShell(): void {
  document.body.innerHTML = `
    <div class="interaction-prompt is-hidden" data-ui="interaction-prompt" aria-hidden="true">
      <span class="interaction-prompt__key">E</span>
      <span class="interaction-prompt__body">
        <span data-ui="interaction-name"></span>
        <span data-ui="interaction-hint"></span>
      </span>
    </div>
    <div class="interaction-feedback is-hidden" data-ui="interaction-feedback"></div>
  `;
}

function promptElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-ui="interaction-prompt"]');
  if (element === null) {
    throw new Error('prompt missing');
  }
  return element;
}

function feedbackElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-ui="interaction-feedback"]');
  if (element === null) {
    throw new Error('feedback missing');
  }
  return element;
}

let prompt: InteractionPrompt | undefined;

beforeEach(() => {
  buildShell();
  prompt = InteractionPrompt.fromDocument(document);
});

afterEach(() => {
  prompt?.dispose();
  prompt = undefined;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('InteractionPrompt', () => {
  it('starts hidden', () => {
    expect(prompt?.isVisible).toBe(false);
    expect(promptElement().classList.contains('is-hidden')).toBe(true);
    expect(promptElement().getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the target name and contextual hint', () => {
    prompt?.show({ displayName: 'Survey Beacon', hint: 'Log survey ping' }, 'survey-beacon');

    expect(prompt?.isVisible).toBe(true);
    expect(promptElement().classList.contains('is-hidden')).toBe(false);
    expect(promptElement().getAttribute('aria-hidden')).toBe('false');
    expect(document.querySelector('[data-ui="interaction-name"]')?.textContent).toBe('Survey Beacon');
    expect(document.querySelector('[data-ui="interaction-hint"]')?.textContent).toBe('Log survey ping');
  });

  it('replaces the content when the target changes', () => {
    prompt?.show({ displayName: 'Survey Beacon', hint: 'Log survey ping' }, 'survey-beacon');
    prompt?.show({ displayName: 'Relay Mast', hint: 'Cycle relay channel' }, 'relay-mast');

    expect(document.querySelector('[data-ui="interaction-name"]')?.textContent).toBe('Relay Mast');
    expect(document.querySelector('[data-ui="interaction-hint"]')?.textContent).toBe('Cycle relay channel');
  });

  it('hides again when no target is available', () => {
    prompt?.show({ displayName: 'Survey Beacon', hint: 'Log survey ping' }, 'survey-beacon');
    prompt?.hide();

    expect(prompt?.isVisible).toBe(false);
    expect(promptElement().classList.contains('is-hidden')).toBe(true);
    expect(promptElement().getAttribute('aria-hidden')).toBe('true');
  });

  it('shows transient feedback and clears it automatically', () => {
    vi.useFakeTimers();
    prompt?.showFeedback('Survey ping #1 logged.');

    expect(prompt?.feedbackText).toBe('Survey ping #1 logged.');
    expect(feedbackElement().classList.contains('is-hidden')).toBe(false);

    vi.advanceTimersByTime(2700);
    expect(feedbackElement().classList.contains('is-hidden')).toBe(true);
  });

  it('ignores empty feedback and clears its timer on dispose', () => {
    vi.useFakeTimers();
    prompt?.showFeedback('   ');
    expect(prompt?.feedbackText).toBe('');

    prompt?.showFeedback('Relay channel 2 engaged.');
    prompt?.dispose();
    vi.advanceTimersByTime(5000);

    expect(feedbackElement().classList.contains('is-hidden')).toBe(false);
  });

  it('fails fast when the shell is missing the prompt element', () => {
    document.body.innerHTML = '';
    expect(() => InteractionPrompt.fromDocument(document)).toThrow(/interaction-prompt/);
  });
});
