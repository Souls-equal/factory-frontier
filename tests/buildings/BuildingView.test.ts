import { describe, expect, it, vi } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
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

describe('machine rendering', () => {
  it('creates a drill and updates the status indicator from logical state', () => {
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()); const view = new BuildingView(registry, 1);
    const transform = snapFootprint(registry.get('miner-mk1'), 0, 0, 0, 1);
    view.sync([{ id: 'machine', typeId: 'miner-mk1', transform }]);
    expect(view.group.getObjectByName('miner-drill')).toBeDefined();
    const lamp = view.group.getObjectByName('machine-indicator') as Mesh;
    const material = lamp.material as import('three').MeshStandardMaterial;
    view.setMachineStates([{ id: 'machine', state: 'RUNNING' }]); expect(material.color.getHex()).toBe(0x38ed8c);
    view.setMachineStates([{ id: 'machine', state: 'OUTPUT_FULL' }]); expect(material.color.getHex()).toBe(0xffd436);
    const dispose = vi.spyOn(lamp.geometry, 'dispose'); view.sync([]); expect(dispose).toHaveBeenCalledOnce(); view.dispose();
  });
});

it.each(['foundation', 'miner-mk1', 'conveyor-straight', 'conveyor-curve', 'conveyor-incline', 'receiving-terminal'])(
  'keeps the %s block model, valid/invalid preview and geometry lifetime consistent', (typeId) => {
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
    const transform = snapFootprint(registry.get(typeId), 0, 0, 0, 1);
    view.sync([{ id: 'placed', typeId, transform }]);
    const actual = view.group.getObjectByName('placed') as Mesh;
    actual.traverse((object) => {
      if (object instanceof Mesh) expect(object.geometry.isBufferGeometry, object.name).toBe(true);
    });
    view.setPreview(typeId, { reason: 'valid', transform });
    const preview = view.group.getObjectByName('building-preview') as Mesh;
    const previewParts: Mesh[] = [];
    preview.traverse((object) => { if (object instanceof Mesh) previewParts.push(object); });
    expect(previewParts.length).toBeGreaterThan(1);
    for (const part of previewParts) {
      const material = part.material as import('three').MeshStandardMaterial;
      expect(material.color.getHex(), part.name).toBe(0x55e8b2);
      expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false);
    }
    view.setPreview(typeId, { reason: 'occupied space', transform });
    for (const part of previewParts) expect((part.material as import('three').MeshStandardMaterial).color.getHex()).toBe(0xff5363);
    const sharedPart = actual.children.find((x) => x.name === (typeId === 'foundation' ? 'foundation-tile' : typeId.startsWith('conveyor-') ? 'conveyor-surface' : typeId === 'miner-mk1' ? 'miner-body' : 'terminal-lid')) as Mesh;
    const dispose = vi.spyOn(sharedPart.geometry, 'dispose');
    view.sync([]); expect(dispose).toHaveBeenCalledOnce(); view.dispose();
  },
);

it('places Miner and terminal port markers on their logical ports at all rotations and grid sizes', async () => {
  const { machinePort } = await import('../../src/logistics/ConveyorDefinitions');
  const { Vector3 } = await import('three');
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry());
  for (const cellSize of [.5, 1, 2]) {
    const view = new BuildingView(registry, cellSize);
    for (const [typeId, name, type] of [['miner-mk1', 'machine-output-port', 'source'], ['receiving-terminal', 'terminal-input-port', 'receiver']] as const) {
      for (let rotation = 0; rotation < 4; rotation++) {
        const transform = { ...snapFootprint(registry.get(typeId), 4, 3, rotation, cellSize), y: 1.5 };
        const building = { id: 'building', typeId, transform };
        view.sync([building]); view.group.updateMatrixWorld(true);
        const actual = new Vector3(); view.group.getObjectByName(name)!.getWorldPosition(actual);
        const expected = machinePort(building, cellSize, type).position;
        expect(actual.x).toBeCloseTo(expected.x, 8); expect(actual.y).toBeCloseTo(expected.y, 8); expect(actual.z).toBeCloseTo(expected.z, 8);
        view.sync([]);
      }
    }
    view.dispose();
  }
});

it('reflects every machine and conveyor state without changing geometry or placed transforms', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const miner = { id: 'm', typeId: 'miner-mk1', transform: snapFootprint(registry.get('miner-mk1'), 0, 0, 2, 1) };
  const belt = { id: 'b', typeId: 'conveyor-curve', transform: snapFootprint(registry.get('conveyor-curve'), 3, 0, 1, 1) };
  view.sync([miner, belt]);
  const machineLamp = view.group.getObjectByName('machine-indicator') as Mesh;
  const conveyorLamp = view.group.getObjectByName('conveyor-indicator') as Mesh;
  const machineColors = { RUNNING: 0x38ed8c, IDLE: 0xb8b8b8, NO_POWER: 0xff713a, MISSING_INPUT: 0xffa426,
    OUTPUT_FULL: 0xffd436, DISABLED: 0x59656c, ERROR: 0xff3535 } as const;
  const beltColors = { RUNNING: 0x38ed8c, IDLE: 0xa8c7cf, BLOCKED: 0xffca47, DISCONNECTED: 0xdd6954,
    INVALID: 0xff3b48, ERROR: 0xff3b48 } as const;
  for (const state of Object.keys(machineColors) as (keyof typeof machineColors)[]) {
    view.setMachineStates([{ id: 'm', state }]); expect((machineLamp.material as import('three').MeshStandardMaterial).color.getHex()).toBe(machineColors[state]);
  }
  for (const state of Object.keys(beltColors) as (keyof typeof beltColors)[]) {
    view.setConveyorStates([{ id: 'b', state }]); expect((conveyorLamp.material as import('three').MeshStandardMaterial).color.getHex()).toBe(beltColors[state]);
  }
  expect(view.group.getObjectByName('m')!.rotation.y).toBeCloseTo(Math.PI);
  expect(view.group.getObjectByName('b')!.rotation.y).toBeCloseTo(Math.PI / 2);
  view.dispose();
});

it('renders and previews the resolved automatic geometry, including reshapes and sloped turns', async () => {
  const { Vector3 } = await import('three');
  const { pathForBuilding } = await import('../../src/logistics/ConveyorDefinitions');
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const transform = { ...snapFootprint(registry.get('conveyor-auto'), 0, 0, 0, 1), y: 2 };
  const autoConveyor = { shape: 'curve-left' as const, rotation: 1, rise: -1, offset: 1 };
  const belt = { id: 'auto', typeId: 'conveyor-auto', transform, autoConveyor };
  view.sync([belt]); view.setPreview('conveyor-auto', { reason: 'valid', transform, autoConveyor });
  view.group.updateMatrixWorld(true);
  const expected = pathForBuilding(belt, 1)!;
  for (const root of ['auto', 'building-preview']) for (const [name, distance] of [['conveyor-input', 0], ['conveyor-output', expected.length]] as const) {
    const marker = view.group.getObjectByName(root)!.getObjectByName(name)!;
    const actual = new Vector3(); marker.getWorldPosition(actual);
    const position = expected.point(distance);
    expect(actual.x).toBeCloseTo(position.x); expect(actual.z).toBeCloseTo(position.z);
    expect(actual.y).toBeCloseTo(position.y + .1);
  }
  const previous = view.group.getObjectByName('auto')!;
  view.sync([{ ...belt, autoConveyor: { shape: 'straight', rotation: 0, rise: 0, offset: 0 } }]);
  expect(view.group.getObjectByName('auto')).not.toBe(previous); view.dispose();
});

it.each(['straight', 'curve-left', 'curve-right', 'incline'] as const)('adds path-following rails and treads for %s', (shape) => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const transform = snapFootprint(registry.get('conveyor-auto'), 0, 0, 0, 1);
  const autoConveyor = { shape, rotation: 0, offset: 0, rise: shape === 'incline' ? 1 : 0 };
  view.sync([{ id: 'belt', typeId: 'conveyor-auto', transform, autoConveyor }]);
  const mesh = view.group.getObjectByName('belt')!;
  const rails = mesh.children.filter((child) => child.name === 'conveyor-rail');
  const treads = mesh.children.filter((child) => child.name === 'conveyor-tread');
  expect(rails.length).toBe(shape.startsWith('curve-') ? 32 : 2); expect(treads).toHaveLength(5);
  const railGeometry = (rails[0] as Mesh).geometry; const dispose = vi.spyOn(railGeometry, 'dispose');
  view.setPreview('conveyor-auto', { reason: 'valid', transform, autoConveyor });
  expect(view.group.getObjectByName('building-preview')!.getObjectByName('conveyor-rail')).toBeDefined();
  view.sync([]); expect(dispose).toHaveBeenCalledOnce(); view.dispose();
});

it.each(['curve-left', 'curve-right'] as const)('shows the changed existing %s path as a reversible preview', async (shape) => {
  const { Vector3 } = await import('three');
  const { pathForBuilding } = await import('../../src/logistics/ConveyorDefinitions');
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const transform = snapFootprint(registry.get('conveyor-auto'), 0, 0, 0, 1);
  const straight = { shape: 'straight' as const, rotation: 0, rise: 0, offset: 0 };
  const turn = { shape, rotation: 0, rise: 0, offset: 0 };
  const existing = { id: 'belt', typeId: 'conveyor-auto', transform, autoConveyor: straight };
  const changed = { ...existing, autoConveyor: turn };
  const candidate = { ...transform, x: shape === 'curve-right' ? 2 : -2 };
  view.sync([existing]); const actual = view.group.getObjectByName('belt')!;
  const placement = { reason: 'valid' as const, transform: candidate, autoConveyor: straight, conveyorPreviewChanges: [changed] };
  view.setPreview('conveyor-auto', placement);
  expect(actual.visible).toBe(false);
  const ghost = view.group.getObjectByName('building-change-preview:belt')!;
  expect(ghost.visible).toBe(true);
  expect(ghost.children.filter((x) => x.name === 'conveyor-surface')).toHaveLength(16);
  expect(((ghost.getObjectByName('conveyor-input') as Mesh).material as MeshStandardMaterial).color.getHex()).toBe(0x59dce1);
  expect(((ghost.getObjectByName('conveyor-output') as Mesh).material as MeshStandardMaterial).color.getHex()).toBe(0xf5d056);
  expect(((view.group.getObjectByName('building-preview')!.getObjectByName('conveyor-output') as Mesh).material as MeshStandardMaterial).color.getHex()).toBe(0xf5d056);
  view.group.updateMatrixWorld(true);
  const pos = new Vector3(); ghost.getObjectByName('conveyor-output')!.getWorldPosition(pos);
  const path = pathForBuilding(changed, 1)!, end = path.point(path.length);
  expect(pos.x).toBeCloseTo(end.x); expect(pos.z).toBeCloseTo(end.z); expect(pos.y).toBeCloseTo(end.y + .1);
  view.setPreview('conveyor-auto', placement);
  expect(view.group.getObjectByName('building-change-preview:belt')).toBe(ghost);
  const dispose = vi.spyOn((ghost.getObjectByName('conveyor-surface') as Mesh).geometry, 'dispose');
  view.setPreview('conveyor-auto', { ...placement, reason: 'occupied space' });
  expect(actual.visible).toBe(true); expect(view.group.getObjectByName('building-change-preview:belt')).toBeUndefined();
  expect(dispose).toHaveBeenCalledOnce();
  const red = view.group.getObjectByName('building-preview')!.getObjectByName('conveyor-output') as Mesh;
  expect((red.material as MeshStandardMaterial).color.getHex()).toBe(0xff5363);
  view.setPreview('conveyor-auto', placement); expect(actual.visible).toBe(false);
  view.setPreview(null); expect(actual.visible).toBe(true); expect(view.group.getObjectByName('building-change-preview:belt')).toBeUndefined();
  view.dispose();
});

it('updates and removes hypothetical neighbouring belt shapes as aim or world changes', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const transform = snapFootprint(registry.get('conveyor-auto'), 0, 0, 0, 1);
  const belt = { id: 'a', typeId: 'conveyor-auto', transform, autoConveyor: { shape: 'straight' as const, rotation: 0, rise: 0, offset: 0 } };
  const changed = { ...belt, autoConveyor: { ...belt.autoConveyor, shape: 'curve-right' as const } };
  view.sync([belt]);
  view.setPreview('conveyor-auto', { reason: 'valid', transform, conveyorPreviewChanges: [changed] });
  const ghost = view.group.getObjectByName('building-change-preview:a')!;
  const geometry = (ghost.getObjectByName('conveyor-surface') as Mesh).geometry, dispose = vi.spyOn(geometry, 'dispose');
  const left = { ...changed, autoConveyor: { ...changed.autoConveyor, shape: 'curve-left' as const } };
  view.setPreview('conveyor-auto', { reason: 'valid', transform, conveyorPreviewChanges: [left] });
  expect(dispose).toHaveBeenCalledOnce(); expect(view.group.getObjectByName('building-change-preview:a')).not.toBe(ghost);
  view.sync([]); view.setPreview('conveyor-auto', { reason: 'valid', transform, conveyorPreviewChanges: [left] });
  expect(view.group.getObjectByName('building-change-preview:a')).toBeUndefined(); view.dispose();
});

describe('refined construction details', () => {
  it.each([
    ['foundation', ['foundation-corner-plates', 'foundation-bolts', 'foundation-side-banding']],
    ['miner-mk1', ['miner-gantry', 'miner-access-panels', 'miner-vents', 'miner-drill-collar']],
    ['conveyor-cell', ['conveyor-feet', 'conveyor-chassis']],
    ['receiving-terminal', ['terminal-frame', 'terminal-controls', 'terminal-screen', 'terminal-latches']],
  ])('shows and disposes batched %s details in placed and invalid/valid previews', (typeId, details) => {
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
    const transform = snapFootprint(registry.get(typeId), 0, 0, 0, 1);
    view.sync([{ id: 'placed', typeId, transform }]);
    view.setPreview(typeId, { reason: 'valid', transform });
    const actual = view.group.getObjectByName('placed')!, ghost = view.group.getObjectByName('building-preview')!;
    const disposals: ReturnType<typeof vi.spyOn>[] = [];
    for (const name of details) {
      const part = actual.getObjectByName(name) as Mesh, preview = ghost.getObjectByName(name) as Mesh;
      expect(part).toBeDefined(); expect(preview).toBeDefined();
      expect((preview.material as MeshStandardMaterial).color.getHex()).toBe(0x55e8b2);
      expect((preview.material as MeshStandardMaterial).depthWrite).toBe(false);
      disposals.push(vi.spyOn(part.geometry, 'dispose'), vi.spyOn(part.material as MeshStandardMaterial, 'dispose'));
    }
    view.setPreview(typeId, { reason: 'occupied space', transform });
    for (const name of details) expect(((ghost.getObjectByName(name) as Mesh).material as MeshStandardMaterial).color.getHex()).toBe(0xff5363);
    view.sync([]);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
    view.dispose();
  });
  it('keeps extra conveyor chassis off junctions with entry ramps', () => {
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
    const transform = snapFootprint(registry.get('conveyor-cell'), 0, 0, 0, 1);
    const cellConveyor = { rise: 0, entries: [{ x: .5, z: 0, startHeight: -.4 }] };
    view.sync([{ id: 'junction', typeId: 'conveyor-cell', transform, cellConveyor }]);
    expect(view.group.getObjectByName('conveyor-entry-ramp')).toBeDefined();
    expect(view.group.getObjectByName('conveyor-chassis')).toBeUndefined();
    view.dispose();
  });
});

it('renders coplanar overlapping foundation cells once, restoring shared cells when an owner is removed', () => {
  const registry = createDefaultBuildingRegistry(createDefaultItemRegistry()), view = new BuildingView(registry, 1);
  const first = { id: 'first', typeId: 'foundation', transform: snapFootprint(registry.get('foundation'), 0, 0, 0, 1) };
  const second = { id: 'second', typeId: 'foundation', transform: snapFootprint(registry.get('foundation'), 1, 1, 1, 1) };
  view.sync([first, second]);
  const cells = (id: string) => view.group.getObjectByName(id)!.children.filter((mesh) => mesh.name === 'foundation-cell');
  expect(cells('first').filter((mesh) => mesh.visible)).toHaveLength(4);
  expect(cells('second').filter((mesh) => mesh.visible)).toHaveLength(3);
  expect(view.group.getObjectByName('second')!.children.filter((mesh) => mesh.name === 'foundation-tile' && mesh.visible)).toHaveLength(3);
  view.sync([second]); expect(cells('second').filter((mesh) => mesh.visible)).toHaveLength(4);
  expect(view.group.getObjectByName('second')!.getObjectByName('foundation-corner-plates')!.visible).toBe(true);
  view.dispose();
});
