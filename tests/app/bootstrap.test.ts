// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the real application bootstrap.
 *
 * The WebGL engine is mocked at the `GameEngine` boundary: everything above it
 * (configuration, Game lifecycle, DOM shell, status overlay, resize handling)
 * runs for real against the actual `index.html`.
 */

const { fakeEngine, createMock } = vi.hoisted(() => {
  const fakeEngine = {
    initCalls: 0,
    disposeCalls: 0,
    resizeCalls: [] as Array<{ width: number; height: number; pixelRatio: number }>,
    renderCalls: [] as number[],
    async init() {
      fakeEngine.initCalls += 1;
    },
    resize(width: number, height: number, pixelRatio: number) {
      fakeEngine.resizeCalls.push({ width, height, pixelRatio });
    },
    render(alpha: number) {
      fakeEngine.renderCalls.push(alpha);
    },
    dispose() {
      fakeEngine.disposeCalls += 1;
    },
    get stats() {
      return { drawCalls: 3, triangles: 100, geometries: 2, textures: 0 };
    },
  };

  const createMock = vi.fn((_canvas: HTMLCanvasElement, _config: unknown) => fakeEngine);
  return { fakeEngine, createMock };
});

vi.mock('../../src/engine/Engine', () => ({
  Engine: { create: createMock },
}));

const testDir = dirname(fileURLToPath(import.meta.url));
const shellHtml = readFileSync(resolve(testDir, '../../index.html'), 'utf8');
const shellBody = /<body[^>]*>([\s\S]*)<\/body>/i.exec(shellHtml)?.[1] ?? '';

beforeEach(() => {
  vi.resetModules();
  fakeEngine.initCalls = 0;
  fakeEngine.disposeCalls = 0;
  fakeEngine.resizeCalls = [];
  fakeEngine.renderCalls = [];
  createMock.mockClear();
  // Use the real application shell markup (script tags are inert in jsdom).
  document.body.innerHTML = shellBody;

  // The loop must not schedule real animation frames in tests.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  // Detach the page listener and dispose the current game. Disposal is
  // idempotent, so games from previous tests cannot affect later counts.
  window.dispatchEvent(new Event('beforeunload'));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('application bootstrap', () => {
  it('builds the engine, starts the game and reveals the 3D viewport', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('../../src/main');

    await vi.waitFor(() => {
      expect(document.querySelector('[data-ui="boot"]')?.classList.contains('is-hidden')).toBe(true);
    });

    expect(createMock).toHaveBeenCalledOnce();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    expect(createMock.mock.calls[0]?.[0]).toBe(canvas);
    expect(fakeEngine.initCalls).toBe(1);
    expect(fakeEngine.resizeCalls.length).toBeGreaterThan(0);
    expect(fakeEngine.resizeCalls[0]?.width).toBeGreaterThan(0);
    expect(fakeEngine.resizeCalls[0]?.height).toBeGreaterThan(0);

    const fatal = document.querySelector<HTMLElement>('[data-ui="fatal"]');
    expect(fatal?.hidden).toBe(true);
    expect(error).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
  });

  it('disposes the game when the page unloads', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('../../src/main');
    await vi.waitFor(() => {
      expect(fakeEngine.initCalls).toBe(1);
    });

    window.dispatchEvent(new Event('beforeunload'));
    expect(fakeEngine.disposeCalls).toBe(1);
  });

  it('reports engine creation failures in the fatal panel without throwing', async () => {
    createMock.mockImplementationOnce(() => {
      throw new Error('WebGL2 context unavailable');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(import('../../src/main')).resolves.toBeDefined();

    await vi.waitFor(() => {
      const fatal = document.querySelector<HTMLElement>('[data-ui="fatal"]');
      expect(fatal?.hidden).toBe(false);
    });

    expect(document.querySelector('[data-ui="fatal-message"]')?.textContent).toBe(
      'WebGL2 context unavailable',
    );
    expect(error).toHaveBeenCalled();
  });
});
