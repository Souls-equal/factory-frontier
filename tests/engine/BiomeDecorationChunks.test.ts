import { describe, expect, it, vi } from 'vitest';
import { InstancedMesh, Matrix4, Vector3, type MeshStandardMaterial } from 'three';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { EnvironmentView } from '../../src/engine/EnvironmentView';
import { BiomeDecorationView } from '../../src/engine/BiomeDecorationView';
import { ChunkManager } from '../../src/world/ChunkManager';

function meshes(view: EnvironmentView): InstancedMesh[] {
  return view.group.getObjectByName('environment:biome-details')!.children as InstancedMesh[];
}
function matrix(mesh: InstancedMesh, i: number): Matrix4 {
  const result = new Matrix4(); mesh.getMatrixAt(i, result); return result;
}
function snapshot(view: EnvironmentView): string[] {
  return meshes(view).flatMap(mesh => Array.from({ length: mesh.count }, (_, i) => {
    const transform = matrix(mesh, i), tint = mesh.instanceColor!.array.slice(i * 3, i * 3 + 3);
    return JSON.stringify([mesh.name.split(':').at(-1), transform.elements, [...tint]]);
  })).sort();
}

describe('chunked biome details', () => {
  it('keeps the same full-map seeded appearance across chunk sizes and exploration order', () => {
    const config = createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 12 } });
    const a = new EnvironmentView(createWorld(config), 100, 8), b = new EnvironmentView(createWorld(config), 100, 13);
    const initial = snapshot(a);
    expect(initial.length).toBeGreaterThan(50); expect(snapshot(b)).toEqual(initial);
    a.setFocus(1000, 1000, 0); expect(meshes(a)).toHaveLength(0);
    a.setFocus(-35, -35, 0); a.setFocus(35, 35, 0); a.setFocus(0, 0, 100);
    expect(snapshot(a)).toEqual(initial);
    expect(new Set(initial).size).toBe(initial.length);
    a.dispose(); b.dispose();
  });

  it('rejects mismatched chunk sizes before loading any batches', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } }));
    const view = new BiomeDecorationView(world, 8), wrong = new ChunkManager(world, 13);
    expect(() => view.load(wrong.update(0, 0, 20).loaded)).toThrow(RangeError);
    expect(view.group.children).toHaveLength(0);
    expect(() => new BiomeDecorationView(world, 0)).toThrow(RangeError);
    view.dispose();
  });

  it('restores the current building occlusion after unloading and releases shared assets only on disposal', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } }));
    world.buildings.setCreativeMode(true);
    const view = new EnvironmentView(world, 100, 8), far = { x: 1000, z: 1000, radius: .4 };
    let selected: { mesh: InstancedMesh; position: Vector3; before: Matrix4; index: number } | undefined;
    for (const mesh of meshes(view)) {
      for (let i = 0; i < mesh.count; i++) {
        const before = matrix(mesh, i), position = new Vector3().setFromMatrixPosition(before);
        if (world.buildings.validate('foundation', position.x, position.z, 0, far).reason === 'valid') {
          selected = { mesh, position, before, index: i }; break;
        }
      }
      if (selected) break;
    }
    expect(selected).toBeDefined();
    const { mesh, position, before, index } = selected!;
    const ids = mesh.name, disposeMesh = vi.spyOn(mesh, 'dispose'), disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose');
    view.setFocus(1000, 1000, 0); expect(view.group.getObjectByName(ids)).toBeUndefined();
    expect(disposeMesh).toHaveBeenCalledOnce(); expect(disposeGeometry).not.toHaveBeenCalled(); expect(disposeMaterial).not.toHaveBeenCalled();
    const placed = world.buildings.place('foundation', position.x, position.z, 0, far);
    expect(placed.reason).toBe('valid');
    view.setFocus(position.x, position.z, 0);
    const reloaded = view.group.getObjectByName(ids) as InstancedMesh;
    expect(reloaded).toBeDefined(); expect(reloaded).not.toBe(mesh); expect(reloaded.geometry).toBe(mesh.geometry);
    expect(new Vector3().setFromMatrixScale(matrix(reloaded, index)).length()).toBe(0);
    expect(world.buildings.demolish(placed.building!.id)).toBe('removed');
    view.syncGatherables(); expect(matrix(reloaded, index).elements).toEqual(before.elements);
    view.setFocus(position.x, position.z, 0);
    expect(meshes(view).filter(m => m.name === ids)).toHaveLength(1);
    const disposeReloaded = vi.spyOn(reloaded, 'dispose');
    view.dispose(); expect(disposeReloaded).toHaveBeenCalledOnce();
    expect(disposeGeometry).toHaveBeenCalledOnce(); expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
