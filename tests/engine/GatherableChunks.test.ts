import { describe, expect, it, vi } from 'vitest';
import { Mesh, type Group } from 'three';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { EnvironmentView } from '../../src/engine/EnvironmentView';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

describe('streamed gatherable models', () => {
  it('recreates a model and preserves collected state, highlight and shared assets across chunk visits', () => {
    const registry = createDefaultItemRegistry(), inventory = new Inventory(registry, 24);
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } }), inventory);
    const branch = world.gatherables.definitions.find(d => d.kind === 'branch')!;
    const view = new EnvironmentView(world, 0, 8);
    view.setFocus(branch.x, branch.z, 0);
    const name = `environment:gatherable:${branch.id}`;
    const first = view.group.getObjectByName(name) as Group;
    expect(first).toBeDefined();
    const shape = first.getObjectByName(`${name}:branch`) as Mesh;
    const disposeGeometry = vi.spyOn(shape.geometry, 'dispose');
    const originalRotation = first.rotation.y;
    view.setHighlight(branch.id);
    expect(first.getObjectByName(`${name}:highlight-ring`)!.visible).toBe(true);
    view.setFocus(branch.x < 0 ? 39 : -39, branch.z < 0 ? 39 : -39, 0);
    expect(view.group.getObjectByName(name)).toBeUndefined();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(world.gatherables.interactables(inventory, 4).find(i => i.descriptor.id === branch.id)!.interact().ok).toBe(true);
    view.setFocus(branch.x, branch.z, 0);
    const restored = view.group.getObjectByName(name) as Group;
    expect(restored).not.toBe(first);
    expect(restored.visible).toBe(false);
    expect(restored.rotation.y).toBe(originalRotation);
    expect((restored.getObjectByName(`${name}:branch`) as Mesh).geometry).toBe(shape.geometry);
    expect(restored.getObjectByName(`${name}:highlight-ring`)!.visible).toBe(true);
    view.setHighlight(null); expect(restored.getObjectByName(`${name}:highlight-ring`)!.visible).toBe(false);
    view.dispose(); expect(disposeGeometry).toHaveBeenCalledOnce();
  });

  it('disposes distant deposit ground geometry and rebuilds the same marker without duplicating it', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } }));
    const deposit = world.deposits[0]!, view = new EnvironmentView(world, 0, 8);
    const name = `environment:deposit:${deposit.id}`;
    view.setFocus(deposit.x, deposit.z, 0);
    const first = view.group.getObjectByName(name) as Group;
    const mark = first.getObjectByName(`${name}:ground-mark`) as Mesh;
    const original = mark.geometry.getAttribute('position').array.slice();
    const geometryDispose = vi.spyOn(mark.geometry, 'dispose');
    const body = first.getObjectByName(`${name}:body`) as Mesh;
    const sharedDispose = vi.spyOn(body.geometry, 'dispose');
    view.setHighlight(deposit.id);
    view.setFocus(deposit.x < 0 ? 39 : -39, deposit.z < 0 ? 39 : -39, 0);
    expect(view.group.getObjectByName(name)).toBeUndefined();
    expect(geometryDispose).toHaveBeenCalledOnce(); expect(sharedDispose).not.toHaveBeenCalled();
    view.setFocus(deposit.x, deposit.z, 0);
    const restored = view.group.getObjectByName(name) as Group;
    expect(restored).not.toBe(first);
    const newMark = restored.getObjectByName(`${name}:ground-mark`) as Mesh;
    expect(newMark.geometry.getAttribute('position').array).toEqual(original);
    expect(restored.getObjectByName(`${name}:highlight-ring`)!.visible).toBe(true);
    expect((restored.getObjectByName(`${name}:body`) as Mesh).geometry).toBe(body.geometry);
    const disposal = vi.spyOn(newMark.geometry, 'dispose');
    view.setFocus(deposit.x, deposit.z, 0);
    expect(view.group.getObjectByName('environment:deposits')!.children.filter(c => c.name === name)).toHaveLength(1);
    view.dispose(); expect(disposal).toHaveBeenCalledOnce(); expect(sharedDispose).toHaveBeenCalledOnce();
  });

});
