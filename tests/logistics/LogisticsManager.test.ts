import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({x,z}),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const deposit: ResourceDeposit = { id: 'iron', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
const player = { x: 10, z: 10, radius: .4 };
function setup() {
  const items = createDefaultItemRegistry(), registry = createDefaultBuildingRegistry(items), playerInventory = new Inventory(items, 10);
  playerInventory.addItem('iron-ore', 30); playerInventory.addItem('stone', 100); playerInventory.addItem('wood', 20);
  const buildings = new BuildingSystem(registry, playerInventory, terrain, [], 1, 29, [deposit]);
  const machines = new MachineManager(buildings, items, () => [deposit]);
  const logistics = new LogisticsManager(buildings, machines, items);
  return { items, buildings, machines, logistics, playerInventory };
}
function place(buildings: BuildingSystem, type: string, x: number, z: number, r = 0) {
  const result = buildings.place(type, x, z, r, player); expect(result.reason).toBe('valid'); return result.building!;
}
describe('building-to-logistics lifecycle', () => {
  it('feeds a real miner into a receiver and protects both inventoried locations', () => {
    const { buildings, machines, logistics, playerInventory } = setup();
    const miner = place(buildings, 'miner-mk1', 0, 0), conveyor = place(buildings, 'conveyor-straight', 0, -2);
    const terminal = place(buildings, 'receiving-terminal', 0, -4); logistics.sync();
    expect(logistics.network.get(conveyor.id)?.source?.id).toBe(miner.id);
    expect(logistics.network.get(conveyor.id)?.receiver?.id).toBe(terminal.id);
    for (let i = 0; i < 300; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
    const inTerminal = logistics.terminal(terminal.id)!.getItemCount('iron-ore'); expect(inTerminal).toBeGreaterThan(0);
    const inBelt = logistics.network.get(conveyor.id)!.items.length;
    expect(inTerminal + inBelt + machines.get(miner.id)!.output.getItemCount('iron-ore')).toBe(7);
    expect(buildings.demolish(terminal.id)).toBe('output not empty');
    if (inBelt) expect(buildings.demolish(conveyor.id)).toBe('output not empty');
    const result = logistics.retrieve(terminal.id, playerInventory); expect(result.moved).toBe(inTerminal);
    expect(buildings.demolish(terminal.id)).toBe('removed'); logistics.sync();
    expect(logistics.network.get(conveyor.id)?.state).toBe('DISCONNECTED');
    expect(logistics.network.get(conveyor.id)!.items.length).toBe(inBelt);
  });
  it('honors orientation and refuses to draw from disconnected or disabled miners', () => {
    const { buildings, machines, logistics, playerInventory } = setup();
    const miner = place(buildings, 'miner-mk1', 0, 0);
    const before = playerInventory.snapshot();
    expect(buildings.place('conveyor-straight', 0, -2, 2, player).reason).toBe('incompatible connection');
    expect(playerInventory.snapshot()).toEqual(before);
    const belt = place(buildings, 'conveyor-straight', 4, -2, 2);
    logistics.sync();
    expect(logistics.network.get(belt.id)?.source).toBeNull();
    for (let i = 0; i < 100; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
    expect(machines.get(miner.id)!.output.getItemCount('iron-ore')).toBe(2);
  });
  it('preserves source and receiver guards when both systems share a registry', () => {
    const { buildings, machines, logistics } = setup();
    const miner = place(buildings, 'miner-mk1', 0, 0); logistics.sync(); machines.fixedUpdate(2000);
    expect(buildings.demolish(miner.id)).toBe('output not empty');
  });
});

it('constructs and runs the real chain through straight, curve and incline with exact height joins', () => {
  const { buildings, machines, logistics } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0);
  const straight = place(buildings, 'conveyor-straight', 0, -2);
  const curve = place(buildings, 'conveyor-curve', 0, -4);
  const incline = place(buildings, 'conveyor-incline', 2, -4, 3);
  const terminal = place(buildings, 'receiving-terminal', 4, -4, 3);
  expect(terminal.transform.y).toBeCloseTo(1);
  logistics.sync();
  expect(logistics.network.get(straight.id)?.output).toBe(curve.id);
  expect(logistics.network.get(curve.id)?.output).toBe(incline.id);
  expect(logistics.network.get(incline.id)?.receiver?.id).toBe(terminal.id);
  for (let i = 0; i < 1200; i++) {
    machines.fixedUpdate(50); logistics.fixedUpdate(50);
    const output = machines.get(miner.id)!.output.getItemCount('iron-ore');
    const transported = logistics.network.all().reduce((n, s) => n + s.items.length, 0);
    expect(output + transported + logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(Math.floor((i + 1) / 40));
  }
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBeGreaterThan(0);
});

it('supports a belt on a foundation and rejects removing its support', () => {
  const { buildings } = setup();
  const foundation = place(buildings, 'foundation', 5, 0);
  const belt = place(buildings, 'conveyor-straight', 5, 0);
  expect(belt.transform.y).toBeCloseTo(foundation.transform.y + .4);
  expect(buildings.demolish(foundation.id)).toBe('building supports another');
  expect(buildings.demolish(belt.id)).toBe('removed');
  expect(buildings.demolish(foundation.id)).toBe('removed');
});

it('pauses transfer on disabled miner without deleting stock and resumes on enable', () => {
  const { buildings, machines, logistics } = setup();
  const minerBuilding = place(buildings, 'miner-mk1', 0, 0);
  const belt = place(buildings, 'conveyor-straight', 0, -2); place(buildings, 'receiving-terminal', 0, -4);
  logistics.sync(); const miner = machines.get(minerBuilding.id)!; miner.output.addItem('iron-ore', 5); miner.setEnabled(false);
  for (let i = 0; i < 100; i++) logistics.fixedUpdate(50);
  expect(miner.output.getItemCount('iron-ore')).toBe(5); expect(logistics.network.get(belt.id)!.items).toHaveLength(0);
  miner.setEnabled(true); for (let i = 0; i < 100; i++) logistics.fixedUpdate(50);
  expect(miner.output.getItemCount('iron-ore')).toBeLessThan(5);
});

it('can attach at least one straight belt to the generated starting iron deposit', async () => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { createWorld } = await import('../../src/world/World');
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
  inventory.addItem('iron-ore', 20); inventory.addItem('stone', 50); inventory.addItem('wood', 20);
  const config = createGameConfig(), world = createWorld(config, inventory), deposit = world.deposits.find((d) => d.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far).building!;
  expect(miner).toBeDefined();
  const result = world.buildings.validate('conveyor-straight', miner.transform.x, miner.transform.z - 2, 0, far);
  expect(result.reason).toBe('valid');
});

it('propagates a full terminal upstream and resumes after partial retrieval, conserving inventory', () => {
  const { buildings, machines, logistics, items } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0), a = place(buildings, 'conveyor-straight', 0, -2);
  const b = place(buildings, 'conveyor-straight', 0, -4), terminal = place(buildings, 'receiving-terminal', 0, -6);
  logistics.sync(); const source = machines.get(miner.id)!.output, sink = logistics.terminal(terminal.id)!;
  source.addItem('iron-ore', 30); sink.addItem('iron-ore', 100);
  const total = () => source.getItemCount('iron-ore') + sink.getItemCount('iron-ore') + logistics.network.all().reduce((sum, s) => sum + s.items.length, 0);
  for (let i = 0; i < 500; i++) { logistics.fixedUpdate(50); expect(total()).toBe(130); }
  expect(logistics.network.get(b.id)!.state).toBe('BLOCKED'); expect(logistics.network.get(a.id)!.state).toBe('BLOCKED');
  expect(buildings.demolish(a.id)).toBe('output not empty');
  const player = new Inventory(items, 1); player.addItem('iron-ore', 95);
  expect(logistics.retrieve(terminal.id, player)).toEqual({ requested: 100, moved: 5, remainder: 95 });
  for (let i = 0; i < 200; i++) { logistics.fixedUpdate(50); expect(total() + player.getItemCount('iron-ore')).toBe(225); }
  expect(sink.getItemCount('iron-ore')).toBe(100);
});

it('updates routes when an empty receiver is removed and preserves all in-transit items', () => {
  const { buildings, machines, logistics } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0), belt = place(buildings, 'conveyor-straight', 0, -2);
  const terminal = place(buildings, 'receiving-terminal', 0, -4); logistics.sync();
  const source = machines.get(miner.id)!.output; source.addItem('iron-ore', 10); logistics.fixedUpdate(50);
  expect(logistics.network.get(belt.id)!.items).toHaveLength(1);
  expect(buildings.demolish(terminal.id)).toBe('removed'); logistics.sync();
  expect(logistics.network.get(belt.id)!.state).toBe('DISCONNECTED');
  for (let i = 0; i < 100; i++) logistics.fixedUpdate(50);
  expect(source.getItemCount('iron-ore') + logistics.network.get(belt.id)!.items.length).toBe(10);
  expect(buildings.demolish(belt.id)).toBe('output not empty');
});


it('rejects a closed conveyor loop before payment instead of silently dropping a link', () => {
  const { buildings, playerInventory } = setup();
  place(buildings, 'conveyor-curve', 0, 4, 0);
  place(buildings, 'conveyor-curve', 2, 4, 3);
  place(buildings, 'conveyor-curve', 2, 6, 2);
  const before = playerInventory.snapshot();
  expect(buildings.place('conveyor-curve', 0, 6, 1, player).reason).toBe('incompatible connection');
  expect(playerInventory.snapshot()).toEqual(before);
});

it('pauses both real production and transport while a gameplay modal is open', () => {
  const { buildings, items } = setup(); let modal = false;
  const machines = new MachineManager(buildings, items, () => [deposit], undefined, () => modal);
  const logistics = new LogisticsManager(buildings, machines, items, () => modal);
  const miner = place(buildings, 'miner-mk1', 0, 0), belt = place(buildings, 'conveyor-straight', 0, -2);
  const terminal = place(buildings, 'receiving-terminal', 0, -4); logistics.sync();
  for (let i = 0; i < 60; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  const snapshot = () => ({ source: machines.get(miner.id)!.output.snapshot(),
    belt: logistics.network.get(belt.id)!.items.map((item) => ({ id: item.id, distance: item.distance })),
    terminal: logistics.terminal(terminal.id)!.snapshot(), progress: machines.get(miner.id)!.progress });
  const before = snapshot(); modal = true;
  for (let i = 0; i < 200; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(snapshot()).toEqual(before);
  modal = false; for (let i = 0; i < 100; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(snapshot()).not.toEqual(before);
});
