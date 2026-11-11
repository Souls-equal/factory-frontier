// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CameraView } from '../../src/engine/types';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';

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
    viewCalls: [] as CameraView[],
    highlightCalls: [] as Array<string | null>,
    async init() {
      fakeEngine.initCalls += 1;
    },
    resize(width: number, height: number, pixelRatio: number) {
      fakeEngine.resizeCalls.push({ width, height, pixelRatio });
    },
    applyView(view: CameraView) {
      fakeEngine.viewCalls.push(view);
    },
    setHighlight(id: string | null) {
      fakeEngine.highlightCalls.push(id);
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

let pendingFrames: Array<(timestampMs: number) => void> = [];

function runNextFrame(timestampMs: number): void {
  const callback = pendingFrames.shift();
  if (callback === undefined) {
    throw new Error('No animation frame was scheduled.');
  }
  callback(timestampMs);
}

beforeEach(() => {
  vi.resetModules();
  fakeEngine.initCalls = 0;
  fakeEngine.disposeCalls = 0;
  fakeEngine.resizeCalls = [];
  fakeEngine.renderCalls = [];
  fakeEngine.viewCalls = [];
  pendingFrames = [];
  createMock.mockClear();
  // Use the real application shell markup (script tags are inert in jsdom).
  document.body.innerHTML = shellBody;

  // Capture animation frames so tests can step the real GameLoop manually.
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: (timestampMs: number) => void) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    }),
  );
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

    expect(document.querySelector('[data-ui="controls-hint"]')).not.toBeNull();

    // Step one real animation frame: the player frame system must apply the
    // starting camera pose before the engine renders.
    expect(fakeEngine.renderCalls).toHaveLength(0);
    runNextFrame(16);
    expect(fakeEngine.viewCalls).toHaveLength(1);

    // The camera must sit on the real terrain at the world spawn point.
    const world = createWorld(createGameConfig());
    const view = fakeEngine.viewCalls[0];
    expect(view?.position.z).toBeCloseTo(world.spawn.z, 6);
    expect(view?.position.y).toBeCloseTo(world.spawn.y + createGameConfig().controls.eyeHeight, 5);

    // Interaction presentation runs every frame and clears the highlight when
    // nothing is targeted.
    expect(fakeEngine.highlightCalls.at(-1)).toBeNull();
    expect(fakeEngine.renderCalls).toHaveLength(1);
  });

  it('gathers a world deposit and displays the real inventory through the bootstrap', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main');
    await vi.waitFor(() => expect(fakeEngine.initCalls).toBe(1));
    const config = createGameConfig();
    const world = createWorld(config);
    const deposit = world.deposits.find((d) => d.itemId === 'iron-ore');
    if (!deposit) throw new Error('missing starting deposit');
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    // Turn the real player towards the deposit through the existing drag-look input.
    const dx = deposit.x - world.spawn.x, dz = deposit.z - world.spawn.z;
    const yaw = Math.atan2(-dx, -dz);
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 1000, clientY: 1000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 - yaw / config.controls.lookSensitivity, clientY: 1000 }));
    runNextFrame(16);
    window.dispatchEvent(new MouseEvent('mouseup'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let frame = 1; frame <= 25; frame++) runNextFrame(16 + frame * 50);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(document.querySelector('[data-ui="interaction-name"]')?.textContent).toContain('Iron Ore');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    runNextFrame(1316);
    expect(document.querySelector('[data-ui="interaction-feedback"]')?.textContent).toContain('Collected 5 Iron Ore');
    for (let i = 1; i <= 5; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: true }));
      runNextFrame(1316 + i * 50);
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', cancelable: true }));
    const panel = document.querySelector<HTMLElement>('[data-ui="inventory"]')!;
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Iron Ore ×5');
    expect(panel.textContent).toContain('Capacity: 1 / 24');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 300 }));
    runNextFrame(1666);
    expect(panel.textContent).toContain('Iron Ore ×5');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    expect(panel.hidden).toBe(true);
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
