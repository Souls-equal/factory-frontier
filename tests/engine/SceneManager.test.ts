import { describe, expect, it, vi } from 'vitest';
import { Color, Fog, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';

import { createGameConfig } from '../../src/core/Configuration';
import { SceneManager } from '../../src/engine/SceneManager';
import { createWorld } from '../../src/world/World';
import type { World } from '../../src/world/World';

function createHarness(overrides: Parameters<typeof createGameConfig>[0] = {}) {
  const config = createGameConfig({
    world: { resolution: 24, obstacleCount: 10, sizeMeters: 80 },
    ...overrides,
  });
  const world = createWorld(config);
  const manager = new SceneManager(config.render, world);
  return { manager, world, config };
}

function findObject<T>(manager: SceneManager, name: string): T {
  const object = manager.scene.getObjectByName(name);
  expect(object, `object "${name}" should exist`).toBeDefined();
  return object as T;
}

describe('SceneManager', () => {
  it('builds the Phase 1 environment from world data', () => {
    const { manager } = createHarness();

    expect(manager.scene.children).toHaveLength(1);
    expect(findObject<Mesh>(manager, 'environment:terrain')).toBeInstanceOf(Mesh);
    expect(findObject<Mesh>(manager, 'environment:sky')).toBeInstanceOf(Mesh);
    expect(manager.scene.getObjectByName('environment:rocks')).toBeDefined();
    expect(manager.scene.getObjectByName('environment:props')).toBeDefined();
  });

  it('builds the terrain mesh from the same height data physics uses', () => {
    const { manager, world } = createHarness();
    const terrain = findObject<Mesh>(manager, 'environment:terrain');
    const data = world.terrain.getRenderData();

    const position = terrain.geometry.getAttribute('position');
    expect(position.count).toBe(data.vertexCount);
    expect(terrain.geometry.getIndex()?.count).toBe(data.triangleCount * 3);

    // Each top face centre must agree with the authoritative voxel column.
    let tops = 0, walls = 0;
    for (let face = 0; face < data.faceCount; face++) {
      const offset = face * 12;
      if (data.normals[offset + 1] === 1) {
        const x = (data.positions[offset]! + data.positions[offset + 6]!) / 2;
        const z = (data.positions[offset + 2]! + data.positions[offset + 8]!) / 2;
        expect(data.positions[offset + 1]).toBeCloseTo(world.terrain.heightAt(x, z), 5);
        tops++;
      } else walls++;
    }
    expect(tops).toBe(world.terrain.columnsX * world.terrain.columnsZ);
    expect(walls).toBeGreaterThan(0);
  });

  it('shades terrain with vertex colours and receives shadows', () => {
    const { manager } = createHarness();
    const terrain = findObject<Mesh>(manager, 'environment:terrain');
    const material = terrain.material as MeshStandardMaterial;

    expect(terrain.geometry.getAttribute('color')).toBeDefined();
    expect(terrain.receiveShadow).toBe(true);
    expect(material.vertexColors).toBe(true);
  });

  it('renders every solid obstacle with instancing instead of one mesh each', () => {
    const { manager, world } = createHarness();
    const rockGroup = manager.scene.getObjectByName('environment:rocks');
    expect(rockGroup).toBeDefined();

    const instanced = (rockGroup?.children ?? []).filter(
      (child): child is InstancedMesh => child instanceof InstancedMesh,
    );
    const totalInstances = instanced.reduce((sum, mesh) => sum + mesh.count, 0);
    const solidCount = world.obstacleDefinitions.filter((obstacle) => obstacle.kind !== 'prop').length;

    expect(solidCount).toBeGreaterThan(0);
    expect(totalInstances).toBe(solidCount);
    expect(instanced.length).toBeLessThanOrEqual(3);
  });

  it('places interactable props on the terrain with a hidden highlight ring', () => {
    const { manager } = createHarness();
    const beacon = manager.scene.getObjectByName('environment:prop:survey-beacon');
    const ring = manager.scene.getObjectByName('environment:prop:survey-beacon:highlight-ring');

    expect(beacon).toBeDefined();
    expect(ring?.visible).toBe(false);
  });

  it('toggles the highlight only for the targeted interactable', () => {
    const { manager } = createHarness();
    const beaconRing = manager.scene.getObjectByName('environment:prop:survey-beacon:highlight-ring');
    const relayRing = manager.scene.getObjectByName('environment:prop:relay-mast:highlight-ring');

    manager.setHighlight('relay-mast');
    expect(relayRing?.visible).toBe(true);
    expect(beaconRing?.visible).toBe(false);
    expect(manager.environment.highlighted).toBe('relay-mast');

    manager.setHighlight(null);
    expect(relayRing?.visible).toBe(false);
  });

  it('configures background and fog from the render config', () => {
    const { manager, config } = createHarness({ render: { backgroundColor: 0x123456, fogColor: 0x654321 } });

    expect(manager.scene.background).toBeInstanceOf(Color);
    expect((manager.scene.background as Color).getHex()).toBe(0x123456);
    expect(manager.scene.fog).toBeInstanceOf(Fog);
    expect((manager.scene.fog as Fog).color.getHex()).toBe(0x654321);
    expect((manager.scene.fog as Fog).near).toBe(config.render.fogNear);
    expect((manager.scene.fog as Fog).far).toBe(config.render.fogFar);
  });

  it('disposes geometries and materials and detaches the scene graph', () => {
    const { manager } = createHarness();
    const terrain = findObject<Mesh>(manager, 'environment:terrain');
    const geometryDispose = vi.spyOn(terrain.geometry, 'dispose');
    const materialDispose = vi.spyOn(terrain.material as MeshStandardMaterial, 'dispose');

    manager.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(manager.scene.children).toHaveLength(0);
  });

  it('renders and highlights the logical deposit identities', () => {
    const { manager, world } = createHarness();
    expect(world.deposits.length).toBeGreaterThan(0);
    const deposit = world.deposits[0]; if (!deposit) throw new Error('missing deposit');
    const model = manager.scene.getObjectByName(`environment:deposit:${deposit.id}`);
    const ring = manager.scene.getObjectByName(`environment:deposit:${deposit.id}:highlight-ring`);
    expect(model?.position.y).toBeCloseTo(deposit.y, 6);
    expect(ring?.visible).toBe(false);
    manager.setHighlight(deposit.id); expect(ring?.visible).toBe(true);
    manager.setHighlight(null); expect(ring?.visible).toBe(false);
    manager.dispose();
  });

  it('renders terrain-following resource markers independently of targeting and disposes them', () => {
    const { manager, world } = createHarness();
    const colors = new Map<string, number>();
    const first = world.deposits[0]!;
    const firstMark = findObject<Mesh>(manager, `environment:deposit:${first.id}:ground-mark`);
    const firstAura = findObject<Mesh>(manager, `environment:deposit:${first.id}:aura`);
    const geometryDispose = vi.spyOn(firstMark.geometry, 'dispose');
    const materialDispose = vi.spyOn(firstAura.material as MeshBasicMaterial, 'dispose');
    for (const deposit of world.deposits) {
      const base = `environment:deposit:${deposit.id}`;
      const aura = findObject<Mesh>(manager, `${base}:aura`);
      const mark = findObject<Mesh>(manager, `${base}:ground-mark`);
      expect(aura.visible).toBe(true); expect(mark.visible).toBe(true);
      const color = (aura.material as MeshBasicMaterial).color.getHex();
      if (colors.has(deposit.itemId)) expect(color).toBe(colors.get(deposit.itemId));
      colors.set(deposit.itemId, color);
      const positions = mark.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i) + deposit.y).toBeCloseTo(
          world.terrain.heightAt(deposit.x + positions.getX(i), deposit.z + positions.getZ(i)) + .035, 5);
      }
    }
    expect(new Set(colors.values()).size).toBe(colors.size);
    manager.setHighlight(first.id); manager.setHighlight(null);
    expect(firstAura.visible).toBe(true); expect(firstMark.visible).toBe(true);
    manager.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce(); expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('does not mutate world data while building the scene', () => {
    const config = createGameConfig({ world: { resolution: 12, obstacleCount: 4, sizeMeters: 60 } });
    const world: World = createWorld(config);
    const before = world.terrain.heightAt(4, 4);
    const resolutionBefore = world.terrain.resolution;

    const manager = new SceneManager(config.render, world);
    expect(world.terrain.heightAt(4, 4)).toBe(before);
    expect(world.terrain.resolution).toBe(resolutionBefore);
    expect(resolutionBefore).toBe(60);
    manager.dispose();
  });
});
