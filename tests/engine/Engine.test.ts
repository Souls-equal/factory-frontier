import { describe, expect, it } from 'vitest';

import { createGameConfig } from '../../src/core/Configuration';
import { Engine } from '../../src/engine/Engine';
import { FakeRenderBackend } from '../helpers/FakeRenderBackend';

function createHarness() {
  const backend = new FakeRenderBackend();
  const config = createGameConfig();
  const engine = new Engine({ config, renderer: backend });
  return { engine, backend, config };
}

describe('Engine', () => {
  it('exposes an empty scene before initialization', () => {
    const { engine } = createHarness();

    expect(engine.isInitialized).toBe(false);
    expect(engine.scene.children).toHaveLength(5);
    expect(engine.scene.getObjectByName('lighting')).toBeUndefined();
  });

  it('adds lighting on initialization', () => {
    const { engine } = createHarness();
    engine.init();

    expect(engine.isInitialized).toBe(true);
    expect(engine.scene.getObjectByName('lighting')).toBeDefined();
  });

  it('refuses to initialize twice', () => {
    const { engine } = createHarness();
    engine.init();

    expect(() => engine.init()).toThrow(/already initialized/);
  });

  it('does not render before initialization', () => {
    const { engine, backend } = createHarness();
    engine.render(0.5);

    expect(backend.renderCalls).toHaveLength(0);
  });

  it('renders the scene with the camera', () => {
    const { engine, backend } = createHarness();
    engine.init();
    engine.render(0.25);

    expect(backend.renderCalls).toHaveLength(1);
    expect(backend.renderCalls[0]?.scene).toBe(engine.scene);
    expect(backend.renderCalls[0]?.camera).toBe(engine.camera);
  });

  it('propagates resize to the backend and camera', () => {
    const { engine, backend } = createHarness();
    engine.init();

    engine.resize(1920, 1080, 2);

    expect(backend.resizeCalls).toEqual([{ width: 1920, height: 1080, pixelRatio: 2 }]);
    expect(engine.camera.aspect).toBeCloseTo(1920 / 1080, 6);
  });

  it('ignores invalid resize dimensions', () => {
    const { engine, backend } = createHarness();
    engine.init();

    engine.resize(0, 0, 1);
    engine.resize(Number.NaN, 100, 1);

    expect(backend.resizeCalls).toEqual([]);
  });

  it('exposes renderer statistics', () => {
    const { engine, backend } = createHarness();

    expect(engine.stats).toBe(backend.statsValue);
  });

  it('disposes its subsystems and stops rendering', () => {
    const { engine, backend } = createHarness();
    engine.init();

    engine.dispose();

    expect(engine.isDisposed).toBe(true);
    expect(engine.isInitialized).toBe(false);
    expect(backend.disposeCalls).toBe(1);
    expect(engine.scene.children).toHaveLength(0);

    engine.render(0);
    expect(backend.renderCalls).toHaveLength(0);
    expect(engine.stats).toEqual({ drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  });

  it('disposes only once', () => {
    const { engine, backend } = createHarness();
    engine.init();

    engine.dispose();
    engine.dispose();

    expect(backend.disposeCalls).toBe(1);
  });

  it('refuses to initialize after disposal', () => {
    const { engine } = createHarness();
    engine.dispose();

    expect(() => engine.init()).toThrow(/disposed/);
  });
});
