import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { BuildingView } from '../../src/engine/BuildingView';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { pathForBuilding } from '../../src/logistics/ConveyorDefinitions';
import { GroundItems } from '../../src/logistics/GroundItems';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { transportPosition } from '../../src/logistics/ConveyorNetwork';
import { InventorySource } from '../../src/logistics/Ports';
import { MachineManager } from '../../src/machines/MachineManager';
import { VoxelTerrain } from '../../src/world/terrain/VoxelTerrain';

const dirs = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }];
function setup(rotation: number, up: boolean, height = 1) {
  const d = dirs[rotation]!;
  const terrain = new VoxelTerrain({ originX: -10, originZ: -10, columnsX: 20, columnsZ: 20, blockSize: 1, bottomLevel: -2,
    sampleHeight: (x, z) => ((x - .5) * d.x + (z - .5) * d.z > .5) === up ? height : 0 });
  const items = createDefaultItemRegistry(), bag = new Inventory(items, 10);
  bag.addItem('stone', 100); bag.addItem('wood', 100);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), bag, terrain, [], 1, 9);
  const machines = new MachineManager(buildings, items, () => []), ground = new GroundItems(() => 0);
  const logistics = new LogisticsManager(buildings, machines, items, () => false, 1, undefined, ground);
  const far = { x: 8, z: 8, radius: .2 };
  const a = buildings.place('conveyor-cell', .5, .5, rotation, far).building!;
  return { buildings, logistics, ground, items, far, a, d };
}

describe('one-cell height transitions', () => {
  it.each([0, 1, 2, 3])('previews and renders an upward ramp, rotation %i', (r) => {
    const { buildings, far, a, d } = setup(r, true);
    const preview = buildings.validate('conveyor-cell', .5 + d.x, .5 + d.z, r, far);
    expect(preview.reason).toBe('valid');
    const ghost = preview.conveyorPreviewChanges!.find((b) => b.id === a.id)!;
    expect(ghost.cellConveyor!.rise).toBeCloseTo(1);
    const view = new BuildingView(buildings.registry, 1); view.sync(buildings.all()); view.setPreview('conveyor-cell', preview); view.group.updateMatrixWorld(true);
    const mesh = view.group.getObjectByName(`building-change-preview:${a.id}`)!;
    const surface = mesh.getObjectByName('conveyor-surface')!;
    const box = new Box3().setFromObject(mesh), f = a.transform.footprint;
    expect(box.min.x).toBeGreaterThanOrEqual(f.minX - 1e-6); expect(box.max.x).toBeLessThanOrEqual(f.maxX + 1e-6);
    expect(box.min.z).toBeGreaterThanOrEqual(f.minZ - 1e-6); expect(box.max.z).toBeLessThanOrEqual(f.maxZ + 1e-6);
    const v = (surface as import('three').Mesh).geometry.attributes.position!;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < v.count; i++) { min = Math.min(min, v.getY(i)); max = Math.max(max, v.getY(i)); }
    expect(max - min).toBeGreaterThan(1);
    const placed = buildings.place('conveyor-cell', .5 + d.x, .5 + d.z, r, far);
    expect(placed.reason).toBe('valid'); expect(buildings.get(a.id)!.cellConveyor).toEqual(ghost.cellConveyor); view.dispose();
  });
  it.each([0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].flatMap((relative) => [true, false].map((up) => [r, relative, up] as const))))
    ('moves continuously across a %s-to-%s %s step', (r, relative, up) => {
      const { buildings, far, a, d, logistics, items, ground } = setup(r, up);
      const result = buildings.place('conveyor-cell', .5 + d.x, .5 + d.z, (r + relative) % 4, far);
      expect(result.reason).toBe('valid'); const b = result.building!; logistics.sync();
      const first = logistics.network.get(a.id)!; const second = logistics.network.get(b.id)!;
      expect(first.output).toBe(b.id);
      const source = new Inventory(items, 1); source.addItem('iron-ore', 1);
      logistics.network.attachCellSource(a.id, new InventorySource('test-source', { position: first.path.point(0), direction: first.path.direction('input') }, source, 'iron-ore'), 0);
      let previous: { x: number; y: number; z: number } | undefined, sawTarget = false, sawRamp = false;
      for (let i = 0; i < 130; i++) {
        logistics.network.fixedUpdate(50);
        const segment = logistics.network.all().find((s) => s.items.length);
        if (segment) {
          const item = segment.items[0]!, p = transportPosition(item, segment.path);
          if (previous) expect(Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z)).toBeLessThanOrEqual(.051);
          previous = p; sawTarget ||= segment.id === b.id; sawRamp ||= !!item.transition;
        }
      }
      expect(sawTarget).toBe(true); if (!(relative === 0 && up)) expect(sawRamp).toBe(true);
      if (relative !== 2) expect(ground.all()).toHaveLength(1); // opposite faces form a cycle
      if (!up) {
        expect(b.cellConveyor!.entries[0]!.startHeight).toBeCloseTo(1);
        const view = new BuildingView(buildings.registry, 1); view.sync(buildings.all());
        if (relative !== 2) expect(view.group.getObjectByName(b.id)!.getObjectByName('conveyor-entry-ramp')).toBeDefined();
        else expect(b.cellConveyor!.rise).toBeCloseTo(1); // the main deck is already the shared ramp
        view.dispose();
      } else expect(pathForBuilding(buildings.get(a.id)!, 1)!.rise).toBeGreaterThan(0);
      expect(second.path.spec.size).toBe(1);
    });
  it.each([true, false])('rejects unsupported excessive height differences without charging, upward %s', (up) => {
    const { buildings, far, d } = setup(0, up, 2);
    const before = buildings.all().length;
    expect(buildings.place('conveyor-cell', .5 + d.x, .5 + d.z, 0, far).reason).toBe('incompatible connection');
    expect(buildings.all()).toHaveLength(before);
  });
});

it('reshapes an occupied uphill belt without losing its item or charging on unsafe demolition', () => {
  const { buildings, far, a, d, logistics, items } = setup(0, true); logistics.sync();
  const source = new Inventory(items, 1); source.addItem('iron-ore', 2);
  const segment = logistics.network.get(a.id)!;
  logistics.network.attachCellSource(a.id, new InventorySource('manual', { position: segment.path.point(0), direction: segment.path.direction('input') }, source, 'iron-ore'), 0);
  logistics.network.fixedUpdate(50); logistics.network.fixedUpdate(200);
  const id = segment.items[0]!.id;
  const preview = buildings.validate('conveyor-cell', .5 + d.x, .5 + d.z, 1, far);
  expect(preview.reason).toBe('valid');
  expect(buildings.place('conveyor-cell', .5 + d.x, .5 + d.z, 1, far).reason).toBe('valid');
  logistics.sync(); expect(logistics.network.get(a.id)!.items[0]!.id).toBe(id);
  expect(logistics.network.get(a.id)!.path.rise).toBeCloseTo(1);
  expect(buildings.demolish(a.id)).toBe('output not empty');
});

it('delivers from a Miner up a voxel step to a terminal and preserves the item count', () => {
  const terrain = new VoxelTerrain({ originX: -10, originZ: -10, columnsX: 20, columnsZ: 20, blockSize: 1, bottomLevel: -2,
    sampleHeight: (_x, z) => z < -2 ? 1 : 0 });
  const items = createDefaultItemRegistry(), bag = new Inventory(items, 10); bag.addItem('stone', 100); bag.addItem('wood', 100);
  const deposit = { id: 'iron', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal' as const, productionMultiplier: 1, extractionCompatible: true };
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), bag, terrain, [], 1, 9, [deposit]);
  const machines = new MachineManager(buildings, items, () => [deposit]), ground = new GroundItems(() => 0);
  const logistics = new LogisticsManager(buildings, machines, items, () => false, 1, undefined, ground);
  const far = { x: 8, z: 8, radius: .2 };
  const place = (type: string, x: number, z: number) => {
    const result = buildings.place(type, x, z, 0, far); expect(result.reason).toBe('valid'); return result.building!;
  };
  const miner = place('miner-mk1', 0, 0), a = place('conveyor-cell', .5, -1.5);
  place('conveyor-cell', .5, -2.5); place('conveyor-cell', .5, -3.5);
  const terminal = place('receiving-terminal', 0, -5); logistics.sync();
  expect(logistics.network.get(a.id)!.path.rise).toBeCloseTo(1);
  const source = machines.get(miner.id)!.output, sink = logistics.terminal(terminal.id)!; source.addItem('iron-ore', 8);
  for (let i = 0; i < 400; i++) {
    logistics.fixedUpdate(50);
    expect(source.getItemCount('iron-ore') + sink.getItemCount('iron-ore') + ground.all().length + logistics.network.all().reduce((n, s) => n + s.items.length, 0)).toBe(8);
  }
  expect(sink.getItemCount('iron-ore')).toBe(8); expect(ground.all()).toHaveLength(0);
});

it('restores the placed belt after a ramp preview is cancelled', () => {
  const { buildings, far, a, d } = setup(0, true);
  const preview = buildings.validate('conveyor-cell', .5 + d.x, .5 + d.z, 0, far);
  const view = new BuildingView(buildings.registry, 1); view.sync(buildings.all());
  view.setPreview('conveyor-cell', preview);
  expect(view.group.getObjectByName(a.id)!.visible).toBe(false);
  expect(view.group.getObjectByName(`building-change-preview:${a.id}`)).toBeDefined();
  view.setPreview(null); expect(view.group.getObjectByName(a.id)!.visible).toBe(true);
  expect(view.group.getObjectByName(`building-change-preview:${a.id}`)).toBeUndefined(); view.dispose();
});

it('supports successive ascending voxel steps without exceeding the per-cell ramp limit', () => {
  const terrain = new VoxelTerrain({ originX: -10, originZ: -10, columnsX: 20, columnsZ: 20, blockSize: 1, bottomLevel: -2,
    sampleHeight: (_x, z) => Math.max(0, Math.min(3, Math.floor(-z))) });
  const items = createDefaultItemRegistry(), bag = new Inventory(items, 10); bag.addItem('stone', 100); bag.addItem('wood', 100);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), bag, terrain, [], 1, 9);
  const far = { x: 8, z: 8, radius: .2 };
  for (let i = 0; i < 4; i++) expect(buildings.place('conveyor-cell', .5, .5 - i, 0, far).reason).toBe('valid');
  const belts = buildings.all(); expect(belts.map((b) => b.transform.y)).toEqual([0, 0, 1, 2]);
  expect(belts[1]!.cellConveyor!.rise).toBeCloseTo(1); expect(belts[2]!.cellConveyor!.rise).toBeCloseTo(1);
});

it('keeps an entry ramp while an item is crossing it during demolition', () => {
  const { buildings, far, a, d, logistics, items } = setup(0, false);
  const b = buildings.place('conveyor-cell', .5 + d.x, .5 + d.z, 1, far).building!; logistics.sync();
  const source = new Inventory(items, 1); source.addItem('iron-ore', 1); const s = logistics.network.get(a.id)!;
  logistics.network.attachCellSource(a.id, new InventorySource('manual', { position: s.path.point(0), direction: s.path.direction('input') }, source, 'iron-ore'), 0);
  for (let i = 0; i < 100 && !logistics.network.get(b.id)!.items.some((item) => item.transition); i++) logistics.network.fixedUpdate(50);
  expect(logistics.network.get(b.id)!.items[0]!.transition).toBeDefined();
  expect(buildings.demolish(a.id)).toBe('conveyor occupied');
  expect(buildings.get(a.id)).toBeDefined();
  for (let i = 0; i < 100 && logistics.network.get(b.id)!.items.some((item) => item.transition); i++) logistics.network.fixedUpdate(50);
  expect(buildings.demolish(a.id)).toBe('removed');
});

it.each([0, 1, 2, 3])('matches the rendered ramp top to the simulation path in rotation %i', (r) => {
  const { buildings, far, a, d } = setup(r, true);
  buildings.place('conveyor-cell', .5 + d.x, .5 + d.z, r, far);
  const built = buildings.get(a.id)!, path = pathForBuilding(built, 1)!;
  const view = new BuildingView(buildings.registry, 1); view.sync(buildings.all()); view.group.updateMatrixWorld(true);
  const surface = view.group.getObjectByName(a.id)!.getObjectByName('conveyor-surface') as import('three').Mesh;
  const vertices = surface.geometry.attributes.position!;
  for (let i = 0; i < vertices.count; i++) {
    const p = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(surface.matrixWorld);
    const t = Math.max(0, Math.min(1, .5 + (p.x - a.transform.x) * d.x + (p.z - a.transform.z) * d.z));
    expect(Math.abs(p.y - path.point(t * path.length).y)).toBeCloseTo(.06, 5);
  }
  view.dispose();
});

it.each([0, 1, 3])('renders a downward entry surface matching its simulated transition, relative direction %i', (relative) => {
  const { buildings, far, a, d } = setup(0, false);
  const b = buildings.place('conveyor-cell', .5 + d.x, .5 + d.z, relative, far).building!;
  const source = pathForBuilding(buildings.get(a.id)!, 1)!, destination = pathForBuilding(b, 1)!;
  const start = source.point(source.length), end = destination.point(destination.length / 2);
  const view = new BuildingView(buildings.registry, 1); view.sync(buildings.all()); view.group.updateMatrixWorld(true);
  const mesh = view.group.getObjectByName(b.id)!.getObjectByName('conveyor-entry-ramp') as import('three').Mesh;
  expect(mesh).toBeDefined(); const vertices = mesh.geometry.attributes.position!;
  for (let i = 0; i < vertices.count; i++) {
    const p = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
    const dx = end.x - start.x, dz = end.z - start.z;
    const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.z - start.z) * dz) / (dx * dx + dz * dz)));
    expect(Math.abs(p.y - (start.y + t * (end.y - start.y)))).toBeCloseTo(.03, 5);
  }
  const box = new Box3().setFromObject(view.group.getObjectByName(b.id)!);
  expect(box.min.x).toBeGreaterThanOrEqual(b.transform.footprint.minX - 1e-6);
  expect(box.max.x).toBeLessThanOrEqual(b.transform.footprint.maxX + 1e-6);
  expect(box.min.z).toBeGreaterThanOrEqual(b.transform.footprint.minZ - 1e-6);
  expect(box.max.z).toBeLessThanOrEqual(b.transform.footprint.maxZ + 1e-6); view.dispose();
});
