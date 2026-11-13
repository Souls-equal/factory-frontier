import { describe, expect, it, vi } from 'vitest';
import { ConveyorRouteEditor } from '../../src/buildings/ConveyorRouteEditor';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x,z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({x,z}), heightAt: () => 0,
  slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const player = { x: 10, z: 10, radius: .4 }, start = { x: -.5, z: -1.5 }, middle = { x: -.5, z: -3.5 }, end = { x: -.5, z: -4.5 };
function setup() {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10), registry = createDefaultBuildingRegistry(items);
  inventory.addItem('stone', 40); inventory.addItem('wood', 20);
  const system = new BuildingSystem(registry, inventory, terrain, [], 1, 29); system.setCreativeMode(true);
  const source = system.place('storage-container', 0, 0, 0, player).building!;
  const sink = system.place('receiving-terminal', 0, -6, 0, player).building!;
  system.setCreativeMode(false);
  return { items, inventory, system, source, sink, editor: new ConveyorRouteEditor(system, terrain) };
}
describe('route editor', () => {
  it('selects a valid start, adds/undoes points, previews and confirms a connected route once', () => {
    const { editor, inventory, system, items, source, sink } = setup(), original = inventory.snapshot();
    expect(editor.preview({ x: 5, z: 5 }, player, 0, inventory.revision, 0).startValid).toBe(false);
    expect(editor.addPoint({ x: 5, z: 5 }, player, 0)).toBe('missing source');
    expect(editor.preview(start, player, 0, inventory.revision, 0).startValid).toBe(true);
    expect(editor.addPoint(start, player, 0)).toBe('point added');
    expect(editor.addPoint(middle, player, 0)).toBe('point added');
    expect(editor.pointCount).toBe(2); editor.undo(); expect(editor.pointCount).toBe(1);
    expect(editor.addPoint(middle, player, 0)).toBe('point added');
    const preview = editor.preview(end, player, 0, inventory.revision, 0);
    expect(preview.reason).toBe('valid'); expect(preview.visualCells).toHaveLength(4);
    expect(preview.cost).toEqual([{ itemId: 'stone', quantity: 16 }, { itemId: 'wood', quantity: 8 }]);
    expect(system.all()).toHaveLength(2); expect(inventory.snapshot()).toEqual(original);
    const result = editor.confirm(end, player)!;
    expect(result.reason).toBe('valid'); expect(editor.pointCount).toBe(0); expect(editor.confirm(end, player)).toBeNull();
    const logistics = new LogisticsManager(system, new MachineManager(system, items, () => []), items);
    logistics.sync(); logistics.terminal(source.id)!.addItem('iron-ore', 3);
    for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
    expect(logistics.terminal(sink.id)!.getItemCount('iron-ore')).toBe(3);
  });
  it('changes bend order and builds a connected turn toward the endpoint', () => {
    const { editor, system, sink } = setup();
    expect(system.demolish(sink.id)).toBe('removed'); system.setCreativeMode(true);
    expect(system.place('receiving-terminal', 4, -6, 0, player).reason).toBe('valid');
    expect(editor.addPoint(start, player, 0)).toBe('point added');
    const target = { x: 3.5, z: -4.5 };
    expect(editor.preview(target, player, 0, 0, 0)).toMatchObject({ reason: 'valid', endConnection: 'open' });
    editor.toggleAxis(); expect(editor.horizontalFirst).toBe(true);
    expect(editor.preview(target, player, 0, 0, 0)).toMatchObject({ reason: 'valid', endConnection: 'connected' });
    expect(editor.confirm(target, player)?.reason).toBe('valid');
  });
  it('permits an open end but still rechecks cost and live guards at commit', () => {
    const { editor, inventory, system } = setup(), openEnd = { x: -.5, z: -2.5 };
    expect(editor.addPoint(start, player, 2)).toBe('point added');
    const preview = editor.preview(openEnd, player, 0, inventory.revision, 0);
    expect(preview).toMatchObject({ reason: 'valid', endConnection: 'open' });
    inventory.removeItem('stone', 40); const before = system.all(), stock = inventory.snapshot();
    expect(editor.confirm(openEnd, player)?.reason).toBe('insufficient materials');
    expect(system.all()).toEqual(before); expect(inventory.snapshot()).toEqual(stock);
    inventory.addItem('stone', 40); system.addTopologyGuard(() => false);
    expect(editor.confirm(openEnd, player)?.reason).toBe('conveyor occupied');
    expect(system.all()).toEqual(before); expect(editor.pointCount).toBe(1);
  });
  it('chooses a usable single-cell start even when the camera initially faces the source', () => {
    const { editor } = setup();
    expect(editor.addPoint(start, player, 2)).toBe('point added');
    expect(editor.confirm(start, player)).toMatchObject({ reason: 'valid', endConnection: 'open' });
  });
  it('rechecks materials, world, and live guards at confirmation, leaving points for correction', () => {
    const { editor, inventory, system } = setup();
    expect(editor.addPoint(start, player, 0)).toBe('point added');
    expect(editor.preview(end, player, 0, inventory.revision, 0).reason).toBe('valid');
    inventory.removeItem('stone', 40);
    expect(editor.confirm(end, player)?.reason).toBe('insufficient materials'); expect(editor.pointCount).toBe(1); expect(system.all()).toHaveLength(2);
    inventory.addItem('stone', 40); let allowed = true; system.addTopologyGuard(() => allowed);
    expect(editor.preview(end, player, 0, inventory.revision, 300).reason).toBe('valid');
    allowed = false; const stock = inventory.snapshot();
    expect(editor.confirm(end, player)?.reason).toBe('conveyor occupied'); expect(inventory.snapshot()).toEqual(stock); expect(system.all()).toHaveLength(2);
    allowed = true; expect(system.place('conveyor-cell', -.5, -3.5, 0, player).reason).toBe('valid');
    expect(editor.confirm(end, player)?.reason).toBe('occupied space'); expect(editor.pointCount).toBe(1);
    editor.reset(); expect(editor.pointCount).toBe(0);
  });
  it('shows invalid geometry and throttles advisory plans while refreshing for changes and time', () => {
    const { editor, system, inventory } = setup(); editor.addPoint(start, player, 0);
    const spy = vi.spyOn(system, 'previewConveyorRoute');
    const one = editor.preview(end, player, 0, inventory.revision, 1);
    expect(editor.preview(end, player, 0, inventory.revision, 200)).toBe(one); expect(spy).toHaveBeenCalledTimes(1);
    editor.preview(end, player, 0, inventory.revision, 251); expect(spy).toHaveBeenCalledTimes(2);
    editor.toggleAxis(); editor.preview(end, player, 0, inventory.revision, 252); expect(spy).toHaveBeenCalledTimes(3);
    expect(system.place('conveyor-cell', -.5, -3.5, 0, player).reason).toBe('valid');
    const failed = editor.preview(end, player, 0, inventory.revision, 253);
    expect(failed.reason).toBe('occupied space'); expect(failed.visualCells).toHaveLength(4);
    expect(editor.addPoint(end, player, 0)).toBe('occupied space');
  });
  it('auto-orients a splitter output start and disallows self-intersecting control points', () => {
    const { editor, system } = setup();
    expect(system.place('splitter', 6, 0, 0, player).reason).toBe('valid');
    expect(editor.addPoint({ x: 7.5, z: -.5 }, player, 0)).toBe('point added');
    const back = editor.addPoint({ x: 8.5, z: -.5 }, player, 0); expect(back).toBe('point added');
    expect(editor.addPoint({ x: 7.5, z: -.5 }, player, 0)).toBe('invalid route');
    expect(editor.pointCount).toBe(2);
  });
});
