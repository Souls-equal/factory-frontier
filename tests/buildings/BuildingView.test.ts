import { describe, expect, it, vi } from 'vitest';
import { Mesh } from 'three';
import { BuildingView } from '../../src/engine/BuildingView';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { snapFootprint } from '../../src/buildings/Transform';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

describe('building rendering consumer', () => {
  it('reuses preview, updates pose and color, and disposes preview and demolished mesh', () => {
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry());
    const view = new BuildingView(registry, 1);
    const transform = snapFootprint(registry.get('foundation'), 0, 0, 0, 1);
    view.setPreview('foundation', { reason: 'valid', transform });
    const preview = view.group.children[0] as Mesh;
    const geometryDispose = vi.spyOn(preview.geometry, 'dispose');
    view.setPreview('foundation', { reason: 'occupied space', transform: { ...transform, x: 3, rotation: 1 } });
    expect(view.group.children[0]).toBe(preview);
    expect(preview.position.x).toBe(3); expect(preview.rotation.y).toBeCloseTo(Math.PI / 2);
    view.sync([{ id: 'building-1', typeId: 'foundation', transform }]);
    const actual = view.group.getObjectByName('building-1') as Mesh;
    expect(actual.position.x).toBe(transform.x);
    const actualDispose = vi.spyOn(actual.geometry, 'dispose');
    view.sync([]); expect(actualDispose).toHaveBeenCalledOnce();
    view.setPreview(null); expect(geometryDispose).toHaveBeenCalledOnce();
    expect(view.group.children).toHaveLength(0);
    view.dispose();
  });
});
