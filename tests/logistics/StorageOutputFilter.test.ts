import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { MachineManager } from '../../src/machines/MachineManager';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({ x,z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const far = { x: 20, z: 20, radius: .4 };
function setup() {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const place = (type: string, x: number, z: number) => {
    const result = buildings.place(type, x, z, 0, far); expect(result.reason).toBe('valid'); return result.building!;
  };
  const source = place('storage-container', 0, 3), belt = place('conveyor-cell', -.5, 1.5), sink = place('storage-container', 0, 0);
  logistics.sync();
  const input = logistics.terminal(source.id)!, output = logistics.terminal(sink.id)!;
  const tick = (n: number) => { for (let i = 0; i < n; i++) logistics.fixedUpdate(50); };
  const total = (id: string) => input.getItemCount(id) + output.getItemCount(id) + logistics.network.all().reduce((n, b) => n + b.items.filter((v) => v.itemId === id).length, 0);
  return { items, buildings, logistics, source, belt, sink, input, output, tick, total, place };
}

describe('storage output filter', () => {
  it('selects a later stack, waits when absent, and returns to original first-slot behavior', () => {
    const { logistics, source, input, output, tick, total } = setup();
    input.addItem('iron-ore', 10); input.addItem('coal', 6);
    expect(logistics.storageOutputFilter(source.id)).toBeNull();
    logistics.setStorageOutputFilter(source.id, 'coal'); tick(400);
    expect(output.getItemCount('coal')).toBe(6); expect(input.getItemCount('iron-ore')).toBe(10);
    expect(total('coal')).toBe(6); expect(total('iron-ore')).toBe(10);
    tick(200); expect(output.getItemCount('iron-ore')).toBe(0);
    input.addItem('coal', 2); tick(200); expect(output.getItemCount('coal')).toBe(8);
    logistics.setStorageOutputFilter(source.id, null); tick(400);
    expect(output.getItemCount('iron-ore')).toBe(10); expect(total('iron-ore')).toBe(10);
  });
  it('retains in-flight items on changes and applies independent settings across topology rebuilds', () => {
    const { logistics, source, sink, input, output, tick, total, belt, place } = setup();
    input.addItem('coal', 5); input.addItem('iron-ore', 5);
    logistics.setStorageOutputFilter(source.id, 'coal'); tick(1);
    expect(logistics.network.get(belt.id)!.items[0]!.itemId).toBe('coal');
    logistics.setStorageOutputFilter(source.id, 'iron-ore'); logistics.setStorageOutputFilter(sink.id, 'wood');
    place('conveyor-cell', 8.5, 8.5); logistics.sync();
    expect(logistics.storageOutputFilter(source.id)).toBe('iron-ore'); expect(logistics.storageOutputFilter(sink.id)).toBe('wood');
    tick(500); expect(output.getItemCount('coal')).toBe(1); expect(output.getItemCount('iron-ore')).toBe(5);
    expect(total('coal')).toBe(5); expect(total('iron-ore')).toBe(5);
  });
  it('backpressures at full storage and recovers without losing selected or unselected items', () => {
    const { logistics, source, input, output, tick, total } = setup();
    input.addItem('iron-ore', 12); input.addItem('coal', 12); output.addItem('stone', 800);
    logistics.setStorageOutputFilter(source.id, 'coal'); tick(500);
    expect(output.getItemCount('coal')).toBe(0); expect(total('coal')).toBe(12); expect(total('iron-ore')).toBe(12);
    output.removeItem('stone', 800); tick(500);
    expect(output.getItemCount('coal')).toBe(12); expect(input.getItemCount('iron-ore')).toBe(12); expect(total('coal')).toBe(12);
  });
  it('validates settings atomically, excludes terminals, and forgets demolished containers', () => {
    const { logistics, source, input, buildings, place } = setup();
    const terminal = place('receiving-terminal', 8, 0); logistics.sync();
    logistics.setStorageOutputFilter(source.id, 'coal');
    expect(() => logistics.setStorageOutputFilter(source.id, 'not-an-item')).toThrow();
    expect(() => logistics.setStorageOutputFilter(terminal.id, 'coal')).toThrow();
    expect(() => logistics.storageOutputFilter('unknown')).toThrow();
    expect(logistics.storageOutputFilter(source.id)).toBe('coal');
    input.addItem('wood', 1); expect(buildings.demolish(source.id)).toBe('output not empty');
    input.removeItem('wood', 1); expect(buildings.demolish(source.id)).toBe('removed'); logistics.sync();
    const replacement = place('storage-container', 0, 3); logistics.sync();
    expect(logistics.storageOutputFilter(replacement.id)).toBeNull();
  });
});

it('filters only output, not incoming belts or manual retrieval', () => {
  const { logistics, sink, input, output, tick, total, buildings, items, place } = setup();
  const outgoing = place('conveyor-cell', -.5, -1.5), last = place('storage-container', 0, -3);
  logistics.sync(); expect(logistics.network.get(outgoing.id)!.source?.id).toBe(sink.id);
  logistics.setStorageOutputFilter(sink.id, 'coal');
  input.addItem('iron-ore', 3); input.addItem('coal', 4); tick(600);
  const final = logistics.terminal(last.id)!;
  expect(output.getItemCount('iron-ore')).toBe(3); expect(final.getItemCount('coal')).toBe(4);
  const all = (id: string) => total(id) + final.getItemCount(id);
  expect(all('iron-ore')).toBe(3); expect(all('coal')).toBe(4);
  const player = new Inventory(items, 5); expect(logistics.retrieve(sink.id, player).moved).toBe(3);
  expect(player.getItemCount('iron-ore')).toBe(3); expect(buildings.demolish(sink.id)).toBe('removed');
});
