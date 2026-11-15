import { describe, expect, it, vi } from 'vitest';
import { InstancedMesh, Matrix4, Vector3, type Material } from 'three';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { EnvironmentView } from '../../src/engine/EnvironmentView';
import { BiomeDecorationView } from '../../src/engine/BiomeDecorationView';

function instances(view: EnvironmentView): InstancedMesh[] {
  return view.group.getObjectByName('environment:biome-details')!.children as InstancedMesh[];
}

function matrix(mesh: InstancedMesh, i: number): Matrix4 {
  const result = new Matrix4(); mesh.getMatrixAt(i, result); return result;
}

describe('biome detail presentation', () => {
  it('is seeded, bounded, biome-specific and does not change world data', () => {
    const config = createGameConfig();
    const world = createWorld(config), again = createWorld(config);
    const original = JSON.stringify({ deposits: world.deposits, resources: world.gatherables.definitions,
      obstacles: world.obstacleDefinitions, buildings: world.buildings.all() });
    const a = new EnvironmentView(world), b = new EnvironmentView(again);
    const first = instances(a), second = instances(b);
    expect(first.map(m => m.name)).toEqual(second.map(m => m.name));
    expect(first.length).toBe(5);
    expect(first.reduce((sum, m) => sum + m.count, 0)).toBeLessThanOrEqual(2200);
    for (let k = 0; k < first.length; k++) {
      const mesh = first[k]!;
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.instanceMatrix.array).toEqual(second[k]!.instanceMatrix.array);
      expect(mesh.instanceColor!.array).toEqual(second[k]!.instanceColor!.array);
      for (let i = 0; i < mesh.count; i++) {
        const position = new Vector3().setFromMatrixPosition(matrix(mesh, i));
        const biome = world.biomes.at(position.x, position.z);
        if (mesh.name.endsWith(':fern')) expect(biome).toBe('forest');
        if (mesh.name.endsWith(':scrub')) expect(biome).toBe('desert');
        if (mesh.name.endsWith(':alpine')) expect(biome).toBe('highlands');
        if (mesh.name.endsWith(':meadow')) expect(biome).toBe('grassland');
        expect(position.y).toBeCloseTo(world.terrain.heightAt(position.x, position.z) + .01, 4);
      }
    }
    expect(JSON.stringify({ deposits: world.deposits, resources: world.gatherables.definitions,
      obstacles: world.obstacleDefinitions, buildings: world.buildings.all() })).toBe(original);
    const instanceDisposals = first.map(m => vi.spyOn(m, 'dispose'));
    const geometryDisposals = first.map(m => vi.spyOn(m.geometry, 'dispose'));
    const materialDisposals = first.map(m => vi.spyOn(m.material as Material, 'dispose'));
    a.dispose(); b.dispose();
    instanceDisposals.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    geometryDisposals.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    materialDisposals.forEach(spy => expect(spy).toHaveBeenCalledOnce());
  });

  it('keeps decoration counts bounded and distributed across a large configured world', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 2000, resolution: 8, heightScale: 0, rimHeight: 0, obstacleCount: 0 }, controls: { playAreaRadius: 150 } }));
    const details = new BiomeDecorationView(world);
    const meshes = details.group.children as InstancedMesh[];
    const positions = meshes.flatMap(mesh => Array.from({ length: mesh.count }, (_, i) => new Vector3().setFromMatrixPosition(matrix(mesh, i))));
    expect(positions.length).toBeGreaterThan(1000); expect(positions.length).toBeLessThanOrEqual(2200);
    expect(positions.some(p => p.z < -100)).toBe(true); expect(positions.some(p => p.z > 100)).toBe(true);
    expect(positions.every(p => Math.hypot(p.x, p.z) < 150)).toBe(true);
    details.dispose();
  }, 30000);

  it('hides decorative instances under a building and restores them after demolition', () => {
    const world = createWorld(createGameConfig());
    const view = new EnvironmentView(world);
    world.buildings.setCreativeMode(true);
    const far = { x: 1000, z: 1000, radius: .4 };
    let chosen: { mesh: InstancedMesh; index: number; before: Matrix4; id: string } | undefined;
    for (const mesh of instances(view)) {
      for (let i = 0; i < mesh.count; i++) {
        const before = matrix(mesh, i), pos = new Vector3().setFromMatrixPosition(before);
        const result = world.buildings.validate('foundation', pos.x, pos.z, 0, far);
        if (result.reason !== 'valid') continue;
        const placed = world.buildings.place('foundation', pos.x, pos.z, 0, far);
        if (placed.reason !== 'valid') continue;
        chosen = { mesh, index: i, before, id: placed.building!.id }; break;
      }
      if (chosen) break;
    }
    expect(chosen).toBeDefined();
    view.syncGatherables();
    expect(new Vector3().setFromMatrixScale(matrix(chosen!.mesh, chosen!.index)).length()).toBe(0);
    expect(world.buildings.demolish(chosen!.id)).toBe('removed');
    view.syncGatherables();
    expect(matrix(chosen!.mesh, chosen!.index).elements).toEqual(chosen!.before.elements);
    view.dispose();
  });
});
