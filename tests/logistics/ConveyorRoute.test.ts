import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { expandRoute, MAX_ROUTE_CELLS } from '../../src/logistics/ConveyorRoute';
import { MachineManager } from '../../src/machines/MachineManager';
import { GroundItems } from '../../src/logistics/GroundItems';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({x,z}), heightAt: () => 0,
  slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const player = { x: 15, z: 15, radius: .4 };
function setup() {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10), registry = createDefaultBuildingRegistry(items);
  const system = new BuildingSystem(registry, inventory, terrain, [], 1, 29);
  system.setCreativeMode(true);
  const source = system.place('storage-container', 0, 0, 0, player).building!;
  const sink = system.place('receiving-terminal', 0, -6, 0, player).building!;
  return { items, inventory, registry, system, source, sink };
}
const points = [{ x: -.5, z: -1.5 }, { x: -.5, z: -4.5 }];
describe('conveyor route planning', () => {
  it('snaps, expands orthogonal corners in either order, and rejects loops and oversized paths', () => {
    const { registry } = setup(), def = registry.get('conveyor-cell');
    expect(expandRoute([{ x: .5, z: .5 }, { x: 2.5, z: -1.5 }], def, 1, true, 0)).toEqual([
      { x: .5, z: .5, rotation: 3 }, { x: 1.5, z: .5, rotation: 3 }, { x: 2.5, z: .5, rotation: 0 },
      { x: 2.5, z: -.5, rotation: 0 }, { x: 2.5, z: -1.5, rotation: 0 }]);
    expect(expandRoute([{ x: .5, z: .5 }, { x: 2.5, z: -1.5 }], def, 1, false, 0)?.[0]?.rotation).toBe(0);
    expect(expandRoute([{ x: .5, z: .5 }, { x: 2.5, z: .5 }, { x: .5, z: .5 }], def, 1, true, 0)).toBeNull();
    expect(expandRoute([{ x: .5, z: .5 }, { x: MAX_ROUTE_CELLS + .5, z: .5 }], def, 1, true, 0)).toBeNull();
    expect(expandRoute([{ x: NaN, z: 0 }], def, 1, true, 0)).toBeNull();
  });
  it('previews without mutation and atomically builds a real connected route with one payment', () => {
    const { items, inventory, system, source, sink } = setup();
    inventory.addItem('stone', 40); inventory.addItem('wood', 20); system.setCreativeMode(false);
    const before = system.all(), revision = system.revision, snapshot = inventory.snapshot();
    const preview = system.previewConveyorRoute(points, player);
    expect(preview.reason).toBe('valid'); expect(preview.cells).toHaveLength(4);
    expect(system.all()).toEqual(before); expect(system.revision).toBe(revision); expect(inventory.snapshot()).toEqual(snapshot);
    const result = system.placeConveyorRoute(points, player);
    expect(result).toEqual(preview); expect(system.revision).toBe(revision + 1);
    expect(inventory.getItemCount('stone')).toBe(24); expect(inventory.getItemCount('wood')).toBe(12);
    const machines = new MachineManager(system, items, () => []), logistics = new LogisticsManager(system, machines, items);
    logistics.sync(); logistics.terminal(source.id)!.addItem('iron-ore', 5);
    for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
    expect(logistics.terminal(sink.id)!.getItemCount('iron-ore')).toBe(5);
  });
  it('routes around a corner, conserving items through the real network', () => {
    const { items, system, source } = setup();
    const oldSink = system.all().find((b) => b.typeId === 'receiving-terminal')!;
    expect(system.demolish(oldSink.id)).toBe('removed');
    const sink = system.place('receiving-terminal', 4, -6, 0, player).building!;
    const route = system.placeConveyorRoute([{ x: -.5, z: -1.5 }, { x: -.5, z: -3.5 },
      { x: 3.5, z: -3.5 }, { x: 3.5, z: -4.5 }], player);
    expect(route.reason).toBe('valid');
    const logistics = new LogisticsManager(system, new MachineManager(system, items, () => []), items);
    logistics.sync(); logistics.terminal(source.id)!.addItem('iron-ore', 10);
    for (let i = 0; i < 500; i++) {
      logistics.fixedUpdate(50);
      expect(logistics.terminal(source.id)!.getItemCount('iron-ore') + logistics.terminal(sink.id)!.getItemCount('iron-ore') +
        logistics.network.all().reduce((sum, segment) => sum + segment.items.length, 0)).toBe(10);
    }
    expect(logistics.terminal(sink.id)!.getItemCount('iron-ore')).toBe(10);
  });
  it('revalidates after the world changes and preserves free-placement refunds', () => {
    const { inventory, system } = setup();
    expect(system.previewConveyorRoute(points, player).reason).toBe('valid');
    expect(system.place('conveyor-cell', -.5, -3.5, 0, player).reason).toBe('valid');
    const before = system.all(), stock = inventory.snapshot();
    expect(system.placeConveyorRoute(points, player).reason).toBe('occupied space');
    expect(system.all()).toEqual(before); expect(inventory.snapshot()).toEqual(stock);
    const blocking = system.all().find((b) => b.typeId === 'conveyor-cell')!;
    expect(system.demolish(blocking.id)).toBe('removed');
    const route = system.placeConveyorRoute(points, player);
    expect(route.reason).toBe('valid');
    system.setCreativeMode(false);
    for (const cell of route.cells) expect(system.demolish(cell.id)).toBe('removed');
    expect(inventory.snapshot()).toEqual(stock);
  });
  it('leaves no partial route or payment on failure or a live topology guard rejection', () => {
    const { inventory, system } = setup(); system.setCreativeMode(false);
    const before = system.all(), snapshot = inventory.snapshot(), revision = system.revision;
    expect(system.placeConveyorRoute(points, player).reason).toBe('insufficient materials');
    expect(system.all()).toEqual(before); expect(system.revision).toBe(revision); expect(inventory.snapshot()).toEqual(snapshot);
    inventory.addItem('stone', 40); inventory.addItem('wood', 20); const stocked = inventory.snapshot();
    system.addTopologyGuard(() => false);
    expect(system.placeConveyorRoute(points, player).reason).toBe('conveyor occupied');
    expect(system.all()).toEqual(before); expect(inventory.snapshot()).toEqual(stocked); expect(system.revision).toBe(revision);
  });
  it('rejects occupied paths, missing sources and ports already claimed by another lane', () => {
    const { system } = setup();
    expect(system.previewConveyorRoute([{ x: 5.5, z: 5.5 }], player).reason).toBe('missing source');
    expect(system.previewConveyorRoute([points[0]!], player)).toMatchObject({ reason: 'valid', endConnection: 'open' });
    expect(system.place('conveyor-cell', .5, -1.5, 0, player).reason).toBe('valid');
    expect(system.previewConveyorRoute(points, player).reason).toBe('missing source');
    expect(system.previewConveyorRoute([{ x: .5, z: -1.5 }, points[1]!], player).reason).toBe('occupied space');
  });
});

it('builds two consecutive 24-cell routes with no destination, then attaches a terminal without losing in-flight items', () => {
  const wide: TerrainQuery = { ...terrain, bounds: { minX: -80, maxX: 80, minZ: -80, maxZ: 80 }, size: 160,
    contains: (x, z) => Math.abs(x) <= 80 && Math.abs(z) <= 80 };
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10), registry = createDefaultBuildingRegistry(items);
  const system = new BuildingSystem(registry, inventory, wide, [], 1, 70);
  system.setCreativeMode(true);
  const source = system.place('storage-container', 0, 0, 0, player).building!;
  system.setCreativeMode(false); inventory.addItem('stone', 192); inventory.addItem('wood', 96);
  const logistics = new LogisticsManager(system, new MachineManager(system, items, () => []), items);
  const firstPoints = [{ x: -.5, z: -1.5 }, { x: -.5, z: -24.5 }];
  const preview = system.previewConveyorRoute(firstPoints, player);
  expect(preview).toMatchObject({ reason: 'valid', endConnection: 'open' }); expect(preview.cells).toHaveLength(24);
  const first = system.placeConveyorRoute(firstPoints, player); expect(first.cells).toHaveLength(24);
  logistics.sync(); logistics.terminal(source.id)!.addItem('iron-ore', 10);
  for (let i = 0; i < 200; i++) logistics.fixedUpdate(50);
  const transitBefore = logistics.network.all().reduce((sum, segment) => sum + segment.items.length, 0);
  expect(transitBefore).toBeGreaterThan(0);
  const second = system.placeConveyorRoute([{ x: -.5, z: -25.5 }, { x: -.5, z: -48.5 }], player);
  expect(second).toMatchObject({ reason: 'valid', endConnection: 'open' }); expect(second.cells).toHaveLength(24);
  expect(inventory.getItemCount('stone')).toBe(0); expect(inventory.getItemCount('wood')).toBe(0);
  logistics.sync(); expect(logistics.network.get(first.cells.at(-1)!.id)?.output).toBe(second.cells[0]!.id);
  expect(logistics.network.all().reduce((sum, segment) => sum + segment.items.length, 0)).toBe(transitBefore);
  system.setCreativeMode(true);
  const sink = system.place('receiving-terminal', 0, -50, 0, player);
  expect(sink.reason).toBe('valid'); logistics.sync();
  for (let i = 0; i < 1500; i++) {
    logistics.fixedUpdate(50);
    const total = logistics.terminal(source.id)!.getItemCount('iron-ore') + logistics.terminal(sink.building!.id)!.getItemCount('iron-ore') +
      logistics.network.all().reduce((sum, segment) => sum + segment.items.length, 0);
    expect(total).toBe(10);
  }
  expect(logistics.terminal(sink.building!.id)!.getItemCount('iron-ore')).toBe(10);
});

it('identifies an obstructed output instead of mistaking an incompatible machine for an open end', () => {
  const { system, inventory, sink } = setup();
  expect(system.demolish(sink.id)).toBe('removed');
  expect(system.place('storage-container', 0, -4, 2, player).reason).toBe('valid');
  const points = [{ x: -.5, z: -1.5 }, { x: -.5, z: -2.5 }];
  const before = system.all(), stock = inventory.snapshot();
  expect(system.previewConveyorRoute(points, player)).toMatchObject({ reason: 'output blocked', endConnection: 'blocked' });
  expect(system.placeConveyorRoute(points, player).reason).toBe('output blocked');
  expect(system.all()).toEqual(before); expect(inventory.snapshot()).toEqual(stock);
});

it('preserves real items as ground drops at a deliberately open route end', () => {
  const { items, system, source, sink } = setup();
  expect(system.demolish(sink.id)).toBe('removed');
  const ground = new GroundItems(() => 0);
  const logistics = new LogisticsManager(system, new MachineManager(system, items, () => []), items, () => false, 1, undefined, ground);
  const result = system.placeConveyorRoute([{ x: -.5, z: -1.5 }, { x: -.5, z: -2.5 }], player);
  expect(result).toMatchObject({ reason: 'valid', endConnection: 'open' }); logistics.sync();
  logistics.terminal(source.id)!.addItem('iron-ore', 3);
  for (let i = 0; i < 200; i++) {
    logistics.fixedUpdate(50);
    expect(logistics.terminal(source.id)!.getItemCount('iron-ore') + ground.all().length +
      logistics.network.all().reduce((sum, segment) => sum + segment.items.length, 0)).toBe(3);
  }
  expect(ground.all()).toHaveLength(3);
});
