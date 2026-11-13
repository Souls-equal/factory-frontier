import { describe, expect, it, vi } from 'vitest';
import { Color, Group, InstancedMesh, Vector3 } from 'three';
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

it.each(['conveyor-straight', 'conveyor-curve', 'conveyor-incline'])('renders %s ports at logical endpoints in all rotations', async (typeId) => {
  const { pathForBuilding } = await import('../../src/logistics/ConveyorDefinitions');
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  for (let rotation = 0; rotation < 4; rotation++) {
    const transform = { ...snapFootprint(registry.get(typeId), 0, 0, rotation, 1), y: 1.25 };
    const building = { id: `belt-${rotation}`, typeId, transform }; const path = pathForBuilding(building, 1)!;
    view.sync([building]); view.group.updateMatrixWorld(true);
    for (const [name, distance] of [['conveyor-input', 0], ['conveyor-output', path.length]] as const) {
      const actual = new Vector3(); view.group.getObjectByName(name)!.getWorldPosition(actual);
      const expected = path.point(distance);
      expect(actual.x).toBeCloseTo(expected.x, 8); expect(actual.y).toBeCloseTo(expected.y + .1, 8); expect(actual.z).toBeCloseTo(expected.z, 8);
    }
  }
  view.dispose();
});

it('grows the shared instanced mesh without duplicating or disposing shared resources early', () => {
  const registry = createDefaultItemRegistry(), source = new Inventory(registry, 1), sink = new Inventory(registry, 1);
  source.addItem('iron-ore', 100); const net = new ConveyorNetwork();
  for (let i = 0; i < 40; i++) {
    net.add(`belt-${i}`, new ConveyorPath({ shape: 'straight', x: 0, y: .5, z: -2 * i, size: 2, rotation: 0 }), { speed: 1, throughputPerMinute: 120, spacing: .5 });
    if (i) expect(net.connect(`belt-${i-1}`, `belt-${i}`)).toBe(true);
  }
  const first = net.get('belt-0')!, last = net.get('belt-39')!;
  net.attachSource(first.id, new InventorySource('source', { position: first.path.point(0), direction: first.path.direction('input') }, source, 'iron-ore'));
  net.attachReceiver(last.id, new InventoryReceiver('sink', { position: last.path.point(last.path.length), direction: last.path.direction('output') }, sink));
  const group = new Group(), view = new ConveyorItemsView((mesh) => group.add(mesh), (mesh) => group.remove(mesh));
  const old = group.children[0] as InstancedMesh, oldDispose = vi.spyOn(old, 'dispose'), geometryDispose = vi.spyOn(view.geometry, 'dispose');
  for (let i = 0; i < 1500; i++) net.fixedUpdate(50);
  const count = net.all().reduce((n, s) => n + s.items.length, 0); expect(count).toBeGreaterThan(64);
  view.sync(net.all(), .5);
  const current = group.children[0] as InstancedMesh;
  expect(group.children).toHaveLength(1); expect(current).not.toBe(old); expect(current.count).toBe(count);
  expect(oldDispose).toHaveBeenCalledOnce(); expect(geometryDispose).not.toHaveBeenCalled();
  view.sync([], .5); expect(current.count).toBe(0); view.dispose();
  expect(group.children).toHaveLength(0); expect(geometryDispose).toHaveBeenCalledOnce();
});


it('renders coal distinctly from iron ingots on belts and on the ground', () => {
  const group = new Group(), view = new ConveyorItemsView((mesh) => group.add(mesh), (mesh) => group.remove(mesh));
  const net = new ConveyorNetwork(), path = new ConveyorPath({ shape: 'straight', x: 0, y: .5, z: 0, rotation: 0, size: 1 });
  net.addCell('belt', path, { speed: 1, throughputPerMinute: 60, spacing: .5 });
  expect(net.insertDropped('coal', 'coal', 'belt')).toBe(true);
  const point = { x: 2, y: 0, z: 0 };
  view.sync(net.all(), 1, [{ id: 'drop', itemId: 'iron-ingot', position: point, previousPosition: point, velocityY: 0 }]);
  const mesh = group.children[0] as InstancedMesh, coal = new Color(), ingot = new Color();
  mesh.getColorAt(0, coal); mesh.getColorAt(1, ingot);
  expect(coal.getHex()).toBe(0x303a3c); expect(ingot.getHex()).toBe(0xaac5ce); view.dispose();
});

it('renders constructor controls and directional ports in previews and scene', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const transform = snapFootprint(registry.get('constructor'), 0, 0, 0, 1);
  view.sync([{ id: 'press', typeId: 'constructor', transform }]);
  expect(view.group.getObjectByName('constructor-press')).toBeDefined();
  expect(view.group.getObjectByName('machine-input-port')).toBeDefined();
  expect(view.group.getObjectByName('machine-output-port')).toBeDefined();
  expect(view.group.getObjectByName('conveyor-surface')).toBeUndefined();
  view.setMachineStates([{ id: 'press', state: 'RUNNING' }]);
  view.setPreview('constructor', { reason: 'valid', transform });
  expect(view.group.getObjectByName('building-preview')).toBeDefined(); view.dispose();
});

it('renders storage container with directional ports in scene and preview', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const transform = snapFootprint(registry.get('storage-container'), 0, 0, 0, 1);
  view.sync([{ id: 'storage', typeId: 'storage-container', transform }]);
  expect(view.group.getObjectByName('storage-lid')).toBeDefined();
  expect(view.group.getObjectByName('machine-input-port')).toBeDefined();
  expect(view.group.getObjectByName('machine-output-port')).toBeDefined();
  view.setPreview('storage-container', { reason: 'valid', transform });
  expect(view.group.getObjectByName('building-preview')).toBeDefined(); view.dispose();
});

it('renders a splitter with one cyan and three yellow ports', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const transform = snapFootprint(registry.get('splitter'), 0, 0, 0, 1);
  view.sync([{ id: 'splitter', typeId: 'splitter', transform }]);
  let input = 0, output = 0;
  view.group.traverse((object) => { if (object.name === 'machine-input-port') input++; if (object.name === 'machine-output-port') output++; });
  expect(input).toBe(1); expect(output).toBe(3);
  view.setPreview('splitter', { reason: 'valid', transform }); expect(view.group.getObjectByName('building-preview')).toBeDefined(); view.dispose();
});

it('renders merger ports and lift shafts, retaining visible vertical transport', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const merger = snapFootprint(registry.get('merger'), 0, 0, 0, 1), lift = snapFootprint(registry.get('lift-up-2'), 4, 0, 0, 1);
  view.sync([{ id: 'merger', typeId: 'merger', transform: merger }, { id: 'lift', typeId: 'lift-up-2', transform: lift }]);
  let inputs = 0; view.group.getObjectByName('merger')!.traverse((obj) => { if (obj.name === 'machine-input-port') inputs++; });
  expect(inputs).toBe(3); expect(view.group.getObjectByName('lift-rail')).toBeDefined();
  view.setPreview('lift-up-2', { reason: 'valid', transform: lift }); expect(view.group.getObjectByName('building-preview')).toBeDefined(); view.dispose();
});

it('renders, reuses, recolors and disposes multi-cell route previews', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const cell = (x: number, rotation = 0) => ({ id: `cell-${x}`, typeId: 'conveyor-cell',
    transform: snapFootprint(registry.get('conveyor-cell'), x, -2, rotation, 1) });
  view.setRoutePreview([cell(.5), cell(1.5, 3)], true);
  const first = view.group.getObjectByName('route-preview:1') as import('three').Mesh;
  const second = view.group.getObjectByName('route-preview:2') as import('three').Mesh;
  expect(first.position.x).toBe(.5); expect(second.rotation.y).toBeCloseTo(3 * Math.PI / 2);
  expect((first.material as import('three').MeshStandardMaterial).color.getHex()).toBe(0x55e8b2);
  const dispose = vi.spyOn(second.geometry, 'dispose');
  view.setRoutePreview([cell(2.5)], false);
  expect(view.group.getObjectByName('route-preview:1')).toBe(first); expect(first.position.x).toBe(2.5);
  expect((first.material as import('three').MeshStandardMaterial).color.getHex()).toBe(0xff5363);
  expect(dispose).toHaveBeenCalledOnce();
  view.setRoutePreview([], false); expect(view.group.getObjectByName('route-preview:1')).toBeUndefined();
  view.setRoutePreview([cell(.5)], true); const last = view.group.getObjectByName('route-preview:1') as import('three').Mesh;
  const lastDispose = vi.spyOn(last.geometry, 'dispose'); view.dispose(); expect(lastDispose).toHaveBeenCalledOnce();
});
