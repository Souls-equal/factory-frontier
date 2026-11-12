import { describe, expect, it, vi } from 'vitest';
import { Group, InstancedMesh, Vector3 } from 'three';
import { BuildingView } from '../../src/engine/BuildingView';
import { ConveyorItemsView } from '../../src/engine/ConveyorItemsView';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { snapFootprint } from '../../src/buildings/Transform';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { ConveyorNetwork } from '../../src/logistics/ConveyorNetwork';
import { ConveyorPath } from '../../src/logistics/ConveyorPath';
import { Inventory } from '../../src/items/Inventory';
import { InventoryReceiver, InventorySource } from '../../src/logistics/Ports';

describe('conveyor renderer (Three.js scene graph without WebGL)', () => {
  it('builds curved and inclined surfaces with endpoint markers and disposes geometry', () => {
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
    const curve = { id: 'curve', typeId: 'conveyor-curve', transform: snapFootprint(registry.get('conveyor-curve'), 0, 0, 0, 1) };
    const incline = { id: 'incline', typeId: 'conveyor-incline', transform: snapFootprint(registry.get('conveyor-incline'), 4, 0, 3, 1) };
    view.sync([curve, incline]);
    const c = view.group.getObjectByName('curve')!, ramp = view.group.getObjectByName('incline')!;
    expect(c.children.filter((child) => child.name === 'conveyor-surface')).toHaveLength(16);
    expect(c.getObjectByName('conveyor-input')).toBeDefined(); expect(c.getObjectByName('conveyor-output')).toBeDefined();
    expect(ramp.getObjectByName('conveyor-surface')!.quaternion.x).not.toBe(0);
    const surface = c.getObjectByName('conveyor-surface') as import('three').Mesh;
    const dispose = vi.spyOn(surface.geometry, 'dispose'); view.sync([incline]); expect(dispose).toHaveBeenCalledOnce(); view.dispose();
  });
  it('renders one instanced resource at interpolated authoritative positions', () => {
    const registry = createDefaultItemRegistry(), source = new Inventory(registry, 1), sink = new Inventory(registry, 1);
    source.addItem('iron-ore', 1); const net = new ConveyorNetwork();
    const path = new ConveyorPath({ shape: 'straight', x: 0, y: .5, z: 0, rotation: 0, size: 2 });
    net.add('a', path); net.attachSource('a', new InventorySource('s', { position: path.point(0), direction: path.direction('input') }, source, 'iron-ore'));
    net.attachReceiver('a', new InventoryReceiver('r', { position: path.point(path.length), direction: path.direction('output') }, sink));
    net.fixedUpdate(50); net.fixedUpdate(50); const segment = net.get('a')!;
    const group = new Group(), view = new ConveyorItemsView((mesh) => group.add(mesh), (mesh) => group.remove(mesh));
    view.sync([segment], .5); const mesh = group.getObjectByName('conveyor-items') as InstancedMesh;
    expect(mesh.count).toBe(1);
    const pos = new Vector3().setFromMatrixPosition(view.matrixAt(0));
    expect(pos.z).toBeCloseTo(.975); expect(pos.y).toBeCloseTo(.72); expect(segment.items[0]!.distance).toBeCloseTo(.05);
    view.dispose(); expect(group.children).toHaveLength(0);
  });
});
