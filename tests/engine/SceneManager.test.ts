import { describe, expect, it, vi } from 'vitest';
import {
  Color,
  Fog,
  GridHelper,
  Group,
  InstancedMesh,
  Mesh,
  PlaneGeometry,
} from 'three';

import { createGameConfig } from '../../src/core/Configuration';
import { SceneManager } from '../../src/engine/SceneManager';

const config = createGameConfig().render;

function findObject<T>(sceneManager: SceneManager, name: string): T {
  const object = sceneManager.scene.getObjectByName(name);
  expect(object, `object "${name}" should exist`).toBeDefined();
  return object as T;
}

describe('SceneManager', () => {
  it('builds the foundation scene graph', () => {
    const manager = new SceneManager(config);

    expect(manager.scene.children).toHaveLength(5);
    expect(findObject<Mesh>(manager, 'foundation:ground')).toBeInstanceOf(Mesh);
    expect(findObject<GridHelper>(manager, 'foundation:grid')).toBeInstanceOf(GridHelper);
    expect(findObject<Mesh>(manager, 'foundation:origin-pad')).toBeInstanceOf(Mesh);
    expect(findObject<Group>(manager, 'foundation:beacon')).toBeInstanceOf(Group);
    expect(findObject<InstancedMesh>(manager, 'foundation:boundary-stakes')).toBeInstanceOf(InstancedMesh);
  });

  it('configures background, fog and a translucent construction grid', () => {
    const manager = new SceneManager(config);
    const grid = findObject<GridHelper>(manager, 'foundation:grid');

    expect(manager.scene.background).toBeInstanceOf(Color);
    expect((manager.scene.background as Color).getHex()).toBe(config.backgroundColor);
    expect(manager.scene.fog).toBeInstanceOf(Fog);
    expect(grid.material.transparent).toBe(true);
    expect(grid.material.opacity).toBeCloseTo(0.55);
    expect(grid.geometry.getAttribute('color')).toBeDefined();
  });

  it('uses instancing for repeated boundary markers', () => {
    const manager = new SceneManager(config);
    const stakes = findObject<InstancedMesh>(manager, 'foundation:boundary-stakes');

    expect(stakes.count).toBe(48);
    expect(stakes.instanceMatrix.count).toBe(48);
  });

  it('creates a horizontal, shadow-receiving ground plane', () => {
    const manager = new SceneManager(config);
    const ground = findObject<Mesh>(manager, 'foundation:ground');

    expect(ground.geometry).toBeInstanceOf(PlaneGeometry);
    expect(ground.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
    expect(ground.receiveShadow).toBe(true);
  });

  it('disposes geometries and materials and detaches the scene graph', () => {
    const manager = new SceneManager(config);
    const ground = findObject<Mesh>(manager, 'foundation:ground');
    const geometryDispose = vi.spyOn(ground.geometry, 'dispose');

    manager.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(manager.scene.children).toHaveLength(0);
  });

  it('uses the configured background/fog colors', () => {
    const customConfig = createGameConfig({ render: { backgroundColor: 0x123456 } }).render;
    const manager = new SceneManager(customConfig);

    expect((manager.scene.background as Color).getHex()).toBe(0x123456);
    expect((manager.scene.fog as Fog).color.getHex()).toBe(0x123456);
  });
});
