import { describe, expect, it } from 'vitest';

import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { snapFootprint } from '../../src/buildings/Transform';
import { createGameConfig } from '../../src/core/Configuration';
import { Engine } from '../../src/engine/Engine';
import { createWorld } from '../../src/world/World';
import { FakeRenderBackend } from '../helpers/FakeRenderBackend';

function createHarness() {
  const backend = new FakeRenderBackend();
  const config = createGameConfig({ world: { resolution: 16, obstacleCount: 6, sizeMeters: 80 } });
  const world = createWorld(config);
  const engine = new Engine({ config, renderer: backend, world });
  return { engine, backend, config, world };
}

describe('Engine', () => {
  it('exposes an empty scene before initialization', () => {
    const { engine } = createHarness();

    expect(engine.isInitialized).toBe(false);
    expect(engine.scene.children).toHaveLength(1);
    expect(engine.scene.getObjectByName('environment')).toBeDefined();
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

  it('renders the building registry independently from the preview and removes both on teardown', () => {
    const { engine } = createHarness(); engine.init();
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry());
    engine.initBuildings(registry, 1);
    const transform = snapFootprint(registry.get('foundation'), 4, 4, 1, 1);
    engine.setBuildingPreview('foundation', { reason: 'valid', transform });
    expect(engine.scene.getObjectByName('building-preview')).toBeDefined();
    engine.syncBuildings([{ id: 'building-1', typeId: 'foundation', transform }]);
    expect(engine.scene.getObjectByName('building-1')?.position.x).toBe(transform.x);
    engine.setBuildingPreview(null);
    expect(engine.scene.getObjectByName('building-preview')).toBeUndefined();
    expect(engine.scene.getObjectByName('building-1')).toBeDefined();
    engine.syncBuildings([]); expect(engine.scene.getObjectByName('building-1')).toBeUndefined();
    engine.dispose(); expect(engine.scene.children).toHaveLength(0);
  });

  it('resolves interaction highlights through the scene', () => {
    const { engine } = createHarness();
    engine.init();
    engine.setHighlight('survey-beacon');

    const ring = engine.scene.getObjectByName('environment:prop:survey-beacon:highlight-ring');
    expect(ring?.visible).toBe(true);

    engine.setHighlight(null);
    expect(ring?.visible).toBe(false);
  });

  it('applies camera views from the player layer', () => {
    const { engine } = createHarness();
    engine.init();

    engine.applyView({ position: { x: 1, y: 1.7, z: 2 }, yaw: 0.25, pitch: -0.1 });

    expect(engine.camera.position.x).toBe(1);
    expect(engine.camera.position.y).toBe(1.7);
    expect(engine.camera.position.z).toBe(2);
    expect(engine.camera.rotation.order).toBe('YXZ');
    expect(engine.camera.rotation.y).toBeCloseTo(0.25);
    expect(engine.camera.rotation.x).toBeCloseTo(-0.1);
  });

  it('ignores camera views after disposal', () => {
    const { engine } = createHarness();
    engine.init();
    engine.dispose();

    const positionBefore = engine.camera.position.clone();
    engine.applyView({ position: { x: 9, y: 9, z: 9 }, yaw: 1, pitch: 1 });

    expect(engine.camera.position.equals(positionBefore)).toBe(true);
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
