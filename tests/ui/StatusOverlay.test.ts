// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import type { GameStats } from '../../src/core/Game';
import { StatusOverlay, formatStats } from '../../src/ui/StatusOverlay';

const FIXTURE = `
  <div data-ui="boot">
    <p data-ui="boot-status">Initializing…</p>
  </div>
  <pre class="is-hidden" data-ui="debug-stats" aria-hidden="true"></pre>
  <div data-ui="fatal" hidden>
    <p data-ui="fatal-message"></p>
  </div>
`;

const STATS: GameStats = {
  status: 'running',
  fps: 60,
  frameTimeMs: 16.7,
  simulationTimeMs: 2500,
  tickCount: 50,
  fixedStepsLastFrame: 1,
  systems: 0,
  drawCalls: 42,
  triangles: 12345,
};

function bootElement(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-ui="boot"]') as HTMLElement;
}

describe('StatusOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = FIXTURE;
  });

  it('binds the Phase 0 shell elements', () => {
    const overlay = StatusOverlay.fromDocument(document);
    expect(overlay).toBeInstanceOf(StatusOverlay);
  });

  it('throws a descriptive error when the shell is incomplete', () => {
    const emptyRoot = document.createElement('div');
    expect(() => StatusOverlay.fromDocument(emptyRoot)).toThrow(/\[data-ui="boot"\]/);
  });

  it('updates the boot status text', () => {
    const overlay = StatusOverlay.fromDocument(document);
    overlay.setBootStatus('Starting rendering engine…');

    expect(document.querySelector('[data-ui="boot-status"]')?.textContent).toBe(
      'Starting rendering engine…',
    );
  });

  it('hides the boot overlay accessibly', () => {
    const overlay = StatusOverlay.fromDocument(document);
    overlay.hideBoot();

    expect(bootElement().classList.contains('is-hidden')).toBe(true);
    expect(bootElement().getAttribute('aria-hidden')).toBe('true');
  });

  it('reveals and fills the fatal error panel', () => {
    const overlay = StatusOverlay.fromDocument(document);
    overlay.showFatal('WebGL2 is unavailable');

    const fatal = document.querySelector<HTMLElement>('[data-ui="fatal"]') as HTMLElement;
    expect(fatal.hidden).toBe(false);
    expect(document.querySelector('[data-ui="fatal-message"]')?.textContent).toBe(
      'WebGL2 is unavailable',
    );
    expect(bootElement().classList.contains('is-hidden')).toBe(true);
  });

  it('shows and hides the debug statistics panel', () => {
    const overlay = StatusOverlay.fromDocument(document);
    const statsElement = document.querySelector<HTMLElement>('[data-ui="debug-stats"]') as HTMLElement;

    overlay.showStats();
    expect(statsElement.classList.contains('is-hidden')).toBe(false);
    expect(statsElement.getAttribute('aria-hidden')).toBe('false');

    overlay.hideStats();
    expect(statsElement.classList.contains('is-hidden')).toBe(true);
    expect(statsElement.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders real game statistics', () => {
    const overlay = StatusOverlay.fromDocument(document);
    overlay.updateStats(STATS);

    const text = document.querySelector('[data-ui="debug-stats"]')?.textContent ?? '';
    expect(text).toContain('FPS  60.0');
    expect(text).toContain('sim 2.50 s');
    expect(text).toContain('ticks 50');
    expect(text).toContain('draws 42');
    expect(text).toContain('status running');
  });
});

describe('formatStats', () => {
  it('formats frame, simulation and renderer metrics', () => {
    const text = formatStats(STATS);

    expect(text.split('\n')).toHaveLength(2);
    expect(text).toContain('frame 16.7 ms');
    expect(text).toContain('tris 12,345');
    expect(text).toContain('systems 0');
  });
});
