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
      if (object instanceof Mesh) expect(object.geometry.type, object.name).toBe('BoxGeometry');
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
