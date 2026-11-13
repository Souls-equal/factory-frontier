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
    expect(logistics.network.get(conveyor.id)?.state).not.toBe('DISCONNECTED');
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
  expect(logistics.network.get(belt.id)!.state).not.toBe('DISCONNECTED');
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

it('does not spend resources when a miner is placed facing away from a pre-existing belt', () => {
  const { buildings, playerInventory } = setup();
  place(buildings, 'conveyor-straight', 0, -2, 2);
  const before = playerInventory.snapshot();
  expect(buildings.validate('miner-mk1', 0, 0, 0, player).reason).toBe('incompatible connection');
  expect(buildings.place('miner-mk1', 0, 0, 0, player).reason).toBe('incompatible connection');
  expect(playerInventory.snapshot()).toEqual(before);
});

it('preserves a full route and exact in-flight positions across an unrelated topology rebuild', () => {
  const { buildings, machines, logistics } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0), a = place(buildings, 'conveyor-straight', 0, -2);
  const b = place(buildings, 'conveyor-straight', 0, -4), terminal = place(buildings, 'receiving-terminal', 0, -6);
  logistics.sync(); machines.get(miner.id)!.output.addItem('iron-ore', 50); logistics.terminal(terminal.id)!.addItem('iron-ore', 100);
  for (let i = 0; i < 500; i++) logistics.fixedUpdate(50);
  const before = [a, b].map(({ id }) => ({ id, items: logistics.network.get(id)!.items.map(({ id, distance }) => ({ id, distance })),
    nextInputMs: logistics.network.get(id)!.nextInputMs, nextOutputMs: logistics.network.get(id)!.nextOutputMs }));
  expect(before.every((s) => s.items.length > 0)).toBe(true);
  place(buildings, 'conveyor-straight', 10, 0); logistics.sync();
  const after = [a, b].map(({ id }) => ({ id, items: logistics.network.get(id)!.items.map(({ id, distance }) => ({ id, distance })),
    nextInputMs: logistics.network.get(id)!.nextInputMs, nextOutputMs: logistics.network.get(id)!.nextOutputMs }));
  expect(after).toEqual(before); expect(logistics.network.get(a.id)!.output).toBe(b.id);
  logistics.terminal(terminal.id)!.removeItem('iron-ore', 5);
  for (let i = 0; i < 200; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(100);
});

it.each([0, 1, 2, 3])('joins real miner, straight, right curve, incline and terminal at rotation %i', (rotation) => {
  const { buildings, machines, logistics } = setup();
  const forward = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  const right = [{ x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }][rotation]!;
  const miner = place(buildings, 'miner-mk1', 0, 0, rotation);
  const a = place(buildings, 'conveyor-straight', 2 * forward.x, 2 * forward.z, rotation);
  const c = place(buildings, 'conveyor-curve', 4 * forward.x, 4 * forward.z, rotation);
  const inclineRotation = (rotation + 3) % 4;
  const b = place(buildings, 'conveyor-incline', 4 * forward.x + 2 * right.x, 4 * forward.z + 2 * right.z, inclineRotation);
  const terminal = place(buildings, 'receiving-terminal', 4 * forward.x + 4 * right.x, 4 * forward.z + 4 * right.z, inclineRotation);
  logistics.sync();
  expect(logistics.network.get(a.id)!.source?.id).toBe(miner.id);
  expect(logistics.network.get(a.id)!.output).toBe(c.id); expect(logistics.network.get(c.id)!.output).toBe(b.id);
  expect(logistics.network.get(b.id)!.receiver?.id).toBe(terminal.id); expect(terminal.transform.y).toBeCloseTo(1);
  for (let i = 0; i < 400; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBeGreaterThan(0);
});

it('restores a disconnected route with the same in-flight items after repeated removal and replacement', () => {
  const { buildings, machines, logistics } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0), belt = place(buildings, 'conveyor-straight', 0, -2);
  let terminal = place(buildings, 'receiving-terminal', 0, -4); logistics.sync();
  const stock = machines.get(miner.id)!.output; stock.addItem('iron-ore', 10);
  let collected = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    logistics.fixedUpdate(50);
    collected += logistics.terminal(terminal.id)!.removeItem('iron-ore', logistics.terminal(terminal.id)!.getItemCount('iron-ore') || 1).moved;
    const before = logistics.network.get(belt.id)!.items.map(({ id, distance }) => ({ id, distance }));
    expect(before.length).toBeGreaterThan(0);
    expect(buildings.demolish(terminal.id)).toBe('removed'); logistics.sync();
    for (let i = 0; i < 50; i++) logistics.fixedUpdate(50);
    const after = logistics.network.get(belt.id)!.items;
    for (const item of before) { const same = after.find((entry) => entry.id === item.id); expect(same).toBeDefined(); expect(same!.distance).toBeGreaterThanOrEqual(item.distance); }
    expect(stock.getItemCount('iron-ore') + after.length + collected).toBe(10);
    terminal = place(buildings, 'receiving-terminal', 0, -4); logistics.sync();
    expect(logistics.network.get(belt.id)!.receiver?.id).toBe(terminal.id);
  }
  for (let i = 0; i < 250; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBeGreaterThan(0);
  expect(stock.getItemCount('iron-ore') + logistics.network.get(belt.id)!.items.length + logistics.terminal(terminal.id)!.getItemCount('iron-ore') + collected).toBe(10);
});

it('rejects a miner against an elevated pre-existing input without charging', () => {
  const { buildings, playerInventory } = setup();
  place(buildings, 'foundation', 0, -2); place(buildings, 'conveyor-straight', 0, -2);
  const before = playerInventory.snapshot();
  expect(buildings.place('miner-mk1', 0, 0, 0, player).reason).toBe('incompatible connection');
  expect(playerInventory.snapshot()).toEqual(before);
});

it('conserves and spaces stock through curve and incline during sustained blockage and recovery', () => {
  const { buildings, machines, logistics } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0), a = place(buildings, 'conveyor-straight', 0, -2);
  const curve = place(buildings, 'conveyor-curve', 0, -4), slope = place(buildings, 'conveyor-incline', 2, -4, 3);
  const terminal = place(buildings, 'receiving-terminal', 4, -4, 3); logistics.sync();
  const stock = machines.get(miner.id)!.output, sink = logistics.terminal(terminal.id)!;
  stock.addItem('iron-ore', 100); sink.addItem('iron-ore', 100); let collected = 0;
  const ids = [a.id, curve.id, slope.id];
  for (let tick = 0; tick < 6000; tick++) {
    if (tick === 1000 || tick === 3000 || tick === 5000) { collected += sink.removeItem('iron-ore', 25).moved; }
    logistics.fixedUpdate(50);
    const segments = ids.map((id) => logistics.network.get(id)!);
    const allItems = segments.flatMap((segment) => segment.items);
    expect(new Set(allItems.map((item) => item.id)).size).toBe(allItems.length);
    expect(stock.getItemCount('iron-ore') + sink.getItemCount('iron-ore') + allItems.length + collected).toBe(200);
    for (const segment of segments) for (let j = 1; j < segment.items.length; j++) {
      expect(segment.items[j - 1]!.distance - segment.items[j]!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
    }
    for (let i = 0; i < segments.length - 1; i++) {
      const from = segments[i]!, to = segments[i + 1]!;
      if (from.items[0] && to.items.at(-1)) expect(from.path.length - from.items[0].distance + to.items.at(-1)!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
    }
  }
  expect(collected).toBe(75); expect(stock.getItemCount('iron-ore')).toBeLessThan(40);
});

it('connects a compatible pre-existing belt when the miner is placed second', () => {
  const { buildings, logistics } = setup();
  const belt = place(buildings, 'conveyor-straight', 0, -2);
  const preview = buildings.validate('miner-mk1', 0, 0, 0, player);
  expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('connected');
  const miner = place(buildings, 'miner-mk1', 0, 0); logistics.sync();
  expect(logistics.network.get(belt.id)!.source?.id).toBe(miner.id);
});

it('builds a full connected path on the default generated starting deposit at rotation zero', async () => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { createWorld } = await import('../../src/world/World');
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
  inventory.addItem('iron-ore', 20); inventory.addItem('stone', 30); inventory.addItem('wood', 20);
  const world = createWorld(createGameConfig(), inventory), d = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const m = world.buildings.place('miner-mk1', d.x, d.z, 0, far); expect(m.reason).toBe('valid');
  const { x, z } = m.transform;
  for (const [type, px, pz, r] of [
    ['conveyor-straight', x, z - 2, 0], ['conveyor-curve', x, z - 4, 0],
    ['conveyor-incline', x + 2, z - 4, 3], ['receiving-terminal', x + 4, z - 4, 3],
  ] as const) {
    const preview = world.buildings.validate(type, px, pz, r, far);
    expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('connected');
    expect(world.buildings.place(type, px, pz, r, far).reason).toBe('valid');
  }
});

it('keeps two building-backed networks and their inventories independent', () => {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  inventory.addItem('iron-ore', 80); inventory.addItem('stone', 80); inventory.addItem('wood', 40);
  const deposits = [{ ...deposit, id: 'iron-left', x: -8 }, { ...deposit, id: 'iron-right', x: 8 }];
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29, deposits);
  const machines = new MachineManager(buildings, items, () => deposits), logistics = new LogisticsManager(buildings, machines, items);
  const a = place(buildings, 'miner-mk1', -8, 0), b = place(buildings, 'miner-mk1', 8, 0);
  const leftBelt = place(buildings, 'conveyor-straight', -8, -2), rightBelt = place(buildings, 'conveyor-straight', 8, -2);
  const leftSink = place(buildings, 'receiving-terminal', -8, -4), rightSink = place(buildings, 'receiving-terminal', 8, -4);
  logistics.sync();
  expect(logistics.network.get(leftBelt.id)!.source?.id).toBe(a.id); expect(logistics.network.get(leftBelt.id)!.receiver?.id).toBe(leftSink.id);
  expect(logistics.network.get(rightBelt.id)!.source?.id).toBe(b.id); expect(logistics.network.get(rightBelt.id)!.receiver?.id).toBe(rightSink.id);
  machines.get(a.id)!.output.addItem('iron-ore', 6); machines.get(b.id)!.output.addItem('iron-ore', 3);
  for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(leftSink.id)!.getItemCount('iron-ore')).toBe(6);
  expect(logistics.terminal(rightSink.id)!.getItemCount('iron-ore')).toBe(3);
});

it('rejects a connection above the bounded terrain support height without payment', () => {
  const { buildings, playerInventory } = setup();
  place(buildings, 'conveyor-incline', 12, 4); place(buildings, 'conveyor-incline', 12, 2);
  const third = place(buildings, 'conveyor-incline', 12, 0); expect(third.transform.y).toBeCloseTo(2);
  const before = playerInventory.snapshot(), preview = buildings.validate('receiving-terminal', 12, -2, 0, player);
  expect(preview.reason).toBe('unsupported height'); expect(preview.transform.y).toBeCloseTo(3);
  expect(buildings.place('receiving-terminal', 12, -2, 0, player).reason).toBe('unsupported height');
  expect(playerInventory.snapshot()).toEqual(before);
});

it.each([0, 1, 2, 3])('runs a connected Miner and open two-belt route at rotation %s, then resumes into a terminal', (rotation) => {
  const { buildings, machines, logistics } = setup();
  const direction = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  const miner = place(buildings, 'miner-mk1', 0, 0, rotation);
  const a = place(buildings, 'conveyor-straight', direction.x * 2, direction.z * 2, rotation);
  const b = place(buildings, 'conveyor-straight', direction.x * 4, direction.z * 4, rotation);
  logistics.sync(); const stock = machines.get(miner.id)!.output; stock.addItem('iron-ore', 12);
  for (let tick = 0; tick < 350; tick++) {
    logistics.fixedUpdate(50);
    const first = logistics.network.get(a.id)!, last = logistics.network.get(b.id)!;
    const all = [...first.items, ...last.items];
    expect(stock.getItemCount('iron-ore') + all.length).toBe(12);
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    for (const s of [first, last]) for (let j = 1; j < s.items.length; j++) expect(s.items[j - 1]!.distance - s.items[j]!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
    if (first.items[0] && last.items.at(-1)) expect(first.path.length - first.items[0].distance + last.items.at(-1)!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
  }
  expect(logistics.network.get(a.id)!.source?.id).toBe(miner.id);
  expect(logistics.network.get(a.id)!.output).toBe(b.id);
  expect(logistics.network.get(b.id)!.state).toBe('BLOCKED');
  expect(logistics.network.get(b.id)!.items[0]!.distance).toBeCloseTo(logistics.network.get(b.id)!.path.length);
  expect(buildings.demolish(b.id)).toBe('output not empty');
  const terminal = place(buildings, 'receiving-terminal', direction.x * 6, direction.z * 6, rotation);
  logistics.sync(); const sink = logistics.terminal(terminal.id)!;
  for (let tick = 0; tick < 500; tick++) {
    logistics.fixedUpdate(50);
    expect(stock.getItemCount('iron-ore') + sink.getItemCount('iron-ore') + logistics.network.all().reduce((n, s) => n + s.items.length, 0)).toBe(12);
  }
  expect(sink.getItemCount('iron-ore')).toBeGreaterThan(0);
});

it('runs an automatic conveyor chain through a turn and keeps items on a straight extension', () => {
  const { buildings, machines, logistics } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0);
  const a = place(buildings, 'conveyor-auto', 0, -2, 2);
  const turn = place(buildings, 'conveyor-auto', 0, -4, 2);
  const b = place(buildings, 'conveyor-auto', 2, -4, 2);
  const terminal = place(buildings, 'receiving-terminal', 4, -4, 3);
  logistics.sync();
  expect(buildings.get(turn.id)!.autoConveyor?.shape).toBe('curve-right');
  expect(logistics.network.get(a.id)?.source?.id).toBe(miner.id);
  expect(logistics.network.get(a.id)?.output).toBe(turn.id);
  expect(logistics.network.get(turn.id)?.output).toBe(b.id);
  expect(logistics.network.get(b.id)?.receiver?.id).toBe(terminal.id);
  machines.get(miner.id)!.output.addItem('iron-ore', 10);
  for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(10);
});

it.each([0, 1, 2, 3])('turns an occupied, blocked automatic belt to either side at rotation %s', (rotation) => {
  const d = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  for (const side of [-1, 1]) {
    const { buildings, machines, logistics } = setup();
    const miner = place(buildings, 'miner-mk1', 0, 0, rotation), belt = place(buildings, 'conveyor-auto', d.x * 2, d.z * 2);
    logistics.sync(); const stock = machines.get(miner.id)!.output; stock.addItem('iron-ore', 12);
    for (let i = 0; i < 350; i++) logistics.fixedUpdate(50);
    const segment = logistics.network.get(belt.id)!;
    expect(segment.state).toBe('BLOCKED'); expect(segment.items.length).toBeGreaterThan(1);
    const ids = segment.items.map((item) => item.id).sort(), inputClock = segment.nextInputMs, outputClock = segment.nextOutputMs;
    const sideX = -d.z * side, sideZ = d.x * side;
    const x = d.x * 2 + sideX * 2, z = d.z * 2 + sideZ * 2;
    expect(buildings.validate('conveyor-auto', x, z, 0, player).reason).toBe('valid');
    const next = place(buildings, 'conveyor-auto', x, z); logistics.sync();
    const a = logistics.network.get(belt.id)!, b = logistics.network.get(next.id)!;
    expect(a.path.spec.shape).toBe(side === 1 ? 'curve-right' : 'curve-left');
    expect(a.output).toBe(b.id);
    expect([...a.items, ...b.items].map((item) => item.id).sort()).toEqual(ids);
    for (const s of [a, b]) for (const item of s.items) expect(item.previousPosition).toEqual(s.path.point(item.distance));
    expect(a.nextInputMs).toBe(inputClock); expect(a.nextOutputMs).toBe(outputClock);
    for (const s of [a, b]) for (let j = 1; j < s.items.length; j++) expect(s.items[j - 1]!.distance - s.items[j]!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
    if (a.items[0] && b.items.at(-1)) expect(a.path.length - a.items[0].distance + b.items.at(-1)!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
    expect(b.items.length).toBeGreaterThan(0);
    const terminal = place(buildings, 'receiving-terminal', x + sideX * 2, z + sideZ * 2, side === 1 ? (rotation + 3) % 4 : (rotation + 1) % 4);
    logistics.sync();
    for (let i = 0; i < 500; i++) {
      logistics.fixedUpdate(50);
      expect(stock.getItemCount('iron-ore') + logistics.terminal(terminal.id)!.getItemCount('iron-ore') + logistics.network.all().reduce((n, s) => n + s.items.length, 0)).toBe(12);
    }
    expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(12);
  }
});

it('attaches an automatic conveyor at a generated starting iron deposit', async () => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { createWorld } = await import('../../src/world/World');
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
  inventory.addItem('stone', 50); inventory.addItem('wood', 20);
  const world = createWorld(createGameConfig(), inventory), deposit = world.deposits.find((d) => d.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far).building!;
  expect(miner).toBeDefined();
  const result = world.buildings.place('conveyor-auto', miner.transform.x, miner.transform.z - 2, 0, far);
  expect(result.reason).toBe('valid');
  const machines = new MachineManager(world.buildings, items, () => world.deposits);
  const logistics = new LogisticsManager(world.buildings, machines, items); logistics.sync();
  expect(logistics.network.get(result.building!.id)?.source?.id).toBe(miner.id);
});

it('refuses branches before payment and restores topology when empty tiles are demolished', () => {
  const { buildings, logistics, playerInventory } = setup();
  place(buildings, 'miner-mk1', 0, 0);
  const a = place(buildings, 'conveyor-auto', 0, -2), b = place(buildings, 'conveyor-auto', 0, -4);
  const c = place(buildings, 'conveyor-auto', 2, -4);
  const before = playerInventory.snapshot();
  expect(buildings.place('conveyor-auto', -2, -4, 0, player).reason).toBe('incompatible connection');
  expect(playerInventory.snapshot()).toEqual(before);
  expect(buildings.get(b.id)!.autoConveyor?.shape).toBe('curve-right');
  expect(buildings.demolish(c.id)).toBe('removed'); logistics.sync();
  expect(buildings.get(b.id)!.autoConveyor?.shape).toBe('straight');
  expect(logistics.network.get(a.id)!.output).toBe(b.id);
});

it('anchors and previews a terminal at an elevated automatic conveyor outlet', () => {
  const { buildings, logistics } = setup();
  place(buildings, 'foundation', 4, 0);
  const belt = place(buildings, 'conveyor-auto', 4, 0);
  const preview = buildings.validate('receiving-terminal', 4, -2, 0, player);
  expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('connected');
  expect(preview.transform.y).toBeCloseTo(.4);
  const terminal = place(buildings, 'receiving-terminal', 4, -2);
  logistics.sync(); expect(logistics.network.get(belt.id)!.receiver?.id).toBe(terminal.id);
});

it.each([0, 1, 2, 3])('preview and placement turn an isolated conveyor sideways in rotation %s', (rotation) => {
  const d = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  for (const side of [-1, 1]) {
    const { buildings, logistics } = setup();
    const first = place(buildings, 'conveyor-auto', 0, 6, rotation);
    const x = -d.z * side * 2, z = 6 + d.x * side * 2;
    const preview = buildings.validate('conveyor-auto', x, z, (rotation + 2) % 4, player);
    expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('connected');
    const next = place(buildings, 'conveyor-auto', x, z, (rotation + 2) % 4); logistics.sync();
    expect(buildings.get(first.id)!.autoConveyor!.shape).toBe(side === 1 ? 'curve-right' : 'curve-left');
    expect(logistics.network.get(first.id)!.output).toBe(next.id);
    expect(logistics.network.get(next.id)!.path.spec.rotation).toBe(preview.autoConveyor!.rotation);
  }
});

it('reroutes occupied items through a turn that also climbs onto a foundation', () => {
  const { buildings, machines, logistics, playerInventory } = setup();
  playerInventory.addItem('wood', 10);
  const miner = place(buildings, 'miner-mk1', 0, 0);
  const a = place(buildings, 'conveyor-auto', 0, -2);
  place(buildings, 'foundation', 2, -2);
  logistics.sync(); const stock = machines.get(miner.id)!.output; stock.addItem('iron-ore', 8);
  for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
  const ids = logistics.network.get(a.id)!.items.map((x) => x.id).sort();
  const preview = buildings.validate('conveyor-auto', 2, -2, 0, player);
  expect(preview.conveyorPreviewChanges![0]!.autoConveyor!.rise).toBeCloseTo(.4);
  const b = place(buildings, 'conveyor-auto', 2, -2); logistics.sync();
  expect(buildings.get(a.id)!.autoConveyor).toEqual(preview.conveyorPreviewChanges![0]!.autoConveyor);
  const first = logistics.network.get(a.id)!, second = logistics.network.get(b.id)!;
  expect(first.path.spec.shape).toBe('curve-right'); expect(first.path.rise).toBeCloseTo(.4);
  expect(first.path.compatible(second.path)).toBe(true);
  expect([...first.items, ...second.items].map((x) => x.id).sort()).toEqual(ids);
  const terminal = place(buildings, 'receiving-terminal', 4, -2, 3); logistics.sync();
  for (let i = 0; i < 400; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(8);
});

it.each([0, 1, 2, 3])('previews the exact material turn before committing it at rotation %s', (rotation) => {
  const d = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  for (const side of [-1, 1]) {
    const { buildings, machines, logistics, playerInventory } = setup();
    const miner = place(buildings, 'miner-mk1', 0, 0, rotation);
    const a = place(buildings, 'conveyor-auto', d.x * 2, d.z * 2);
    logistics.sync(); machines.get(miner.id)!.output.addItem('iron-ore', 5);
    for (let i = 0; i < 200; i++) logistics.fixedUpdate(50);
    const before = logistics.network.get(a.id)!.items.map((item) => ({ ...item }));
    const beforeStock = playerInventory.snapshot(); const previous = buildings.get(a.id)!;
    const sideX = -d.z * side, sideZ = d.x * side;
    const x = d.x * 2 + sideX * 2, z = d.z * 2 + sideZ * 2;
    const preview = buildings.validate('conveyor-auto', x, z, 0, player);
    expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('connected');
    expect(preview.conveyorPreviewChanges).toHaveLength(1);
    expect(preview.conveyorPreviewChanges![0]!.id).toBe(a.id);
    expect(preview.conveyorPreviewChanges![0]!.autoConveyor!.shape).toBe(side === 1 ? 'curve-right' : 'curve-left');
    expect(buildings.get(a.id)).toEqual(previous); expect(playerInventory.snapshot()).toEqual(beforeStock);
    expect(logistics.network.get(a.id)!.items).toEqual(before);
    const next = place(buildings, 'conveyor-auto', x, z); logistics.sync();
    expect(buildings.get(a.id)!.autoConveyor).toEqual(preview.conveyorPreviewChanges![0]!.autoConveyor);
    expect(next.autoConveyor).toEqual(preview.autoConveyor);
    expect(logistics.network.get(a.id)!.output).toBe(next.id);
    expect(logistics.network.get(a.id)!.path.compatible(logistics.network.get(next.id)!.path)).toBe(true);
    for (let i = 0; i < 200; i++) logistics.fixedUpdate(50);
    expect(logistics.network.get(next.id)!.items.length).toBeGreaterThan(0);
  }
});

it('aligns a partially adjacent belt to the previous tile and previews the resulting bend', () => {
  const { buildings, logistics } = setup();
  const first = place(buildings, 'conveyor-auto', 0, 0, 0);
  // The raw snap is offset by one cell along the contact edge.
  const preview = buildings.validate('conveyor-auto', 2, 1, 0, player);
  expect(preview.reason).toBe('valid'); expect(preview.snappedToConveyor).toBe(true);
  expect(preview.transform.x).toBe(2); expect(preview.transform.z).toBe(0);
  expect(preview.conveyorPreviewChanges![0]!.autoConveyor!.shape).toBe('curve-right');
  const placed = place(buildings, 'conveyor-auto', 2, 1); logistics.sync();
  expect(placed.transform).toEqual(preview.transform);
  expect(buildings.get(first.id)!.autoConveyor).toEqual(preview.conveyorPreviewChanges![0]!.autoConveyor);
  expect(logistics.network.get(first.id)!.output).toBe(placed.id);
});

it('never previews a topology change when the proposed placement cannot be paid for', () => {
  const { buildings, playerInventory } = setup();
  const belt = place(buildings, 'conveyor-auto', 0, 0);
  playerInventory.removeItem('wood', playerInventory.getItemCount('wood'));
  const preview = buildings.validate('conveyor-auto', 2, 0, 0, player);
  expect(preview.reason).toBe('insufficient materials');
  expect(preview.conveyorPreviewChanges).toBeUndefined();
  expect(buildings.get(belt.id)!.autoConveyor!.shape).toBe('straight');
});

it('previews and transports a real turn beside the generated starting Miner', async () => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { createWorld } = await import('../../src/world/World');
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
  inventory.addItem('stone', 100); inventory.addItem('wood', 60);
  const world = createWorld(createGameConfig(), inventory), deposit = world.deposits.find((d) => d.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far).building!;
  expect(miner).toBeDefined();
  const belt = world.buildings.place('conveyor-auto', miner.transform.x, miner.transform.z - 2, 0, far).building!;
  expect(belt).toBeDefined();
  const machines = new MachineManager(world.buildings, items, () => world.deposits);
  const logistics = new LogisticsManager(world.buildings, machines, items); logistics.sync();
  const stock = machines.get(miner.id)!.output; stock.addItem('iron-ore', 4);
  for (let i = 0; i < 160; i++) logistics.fixedUpdate(50);
  const turn = [-1, 1].map((sign) => ({ sign, x: belt.transform.x + sign * 2, z: belt.transform.z }))
    .map((target) => ({ ...target, preview: world.buildings.validate('conveyor-auto', target.x, target.z, 0, far) }))
    .find((target) => target.preview.reason === 'valid');
  expect(turn, 'starting deposit should have at least one valid turn').toBeDefined();
  expect(turn!.preview.conveyorPreviewChanges?.some((b) => b.id === belt.id && b.autoConveyor?.shape.startsWith('curve-'))).toBe(true);
  const placed = world.buildings.place('conveyor-auto', turn!.x, turn!.z, 0, far);
  expect(placed.reason).toBe('valid'); logistics.sync();
  expect(logistics.network.get(belt.id)!.output).toBe(placed.building!.id);
  for (let i = 0; i < 160; i++) logistics.fixedUpdate(50);
  expect(logistics.network.get(placed.building!.id)!.items.length).toBeGreaterThan(0);
  expect(stock.getItemCount('iron-ore') + logistics.network.all().reduce((n, s) => n + s.items.length, 0)).toBe(4);
});

it('previews a turn caused by a side-facing terminal and commits the same geometry', () => {
  const { buildings, logistics } = setup();
  place(buildings, 'miner-mk1', 0, 0);
  const belt = place(buildings, 'conveyor-auto', 0, -2);
  const preview = buildings.validate('receiving-terminal', 2, -2, 3, player);
  expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('connected');
  expect(preview.conveyorPreviewChanges![0]!.autoConveyor!.shape).toBe('curve-right');
  const terminal = place(buildings, 'receiving-terminal', 2, -2, 3); logistics.sync();
  expect(buildings.get(belt.id)!.autoConveyor).toEqual(preview.conveyorPreviewChanges![0]!.autoConveyor);
  expect(logistics.network.get(belt.id)!.receiver?.id).toBe(terminal.id);
});

it('does not snap an overlapping or far-away preview to another belt', () => {
  const { buildings } = setup();
  const belt = place(buildings, 'conveyor-auto', 0, 0);
  const overlap = buildings.validate('conveyor-auto', 1, 1, 0, player);
  expect(overlap.reason).toBe('occupied space');
  expect(overlap.transform.x).toBe(1); expect(overlap.transform.z).toBe(1);
  const far = buildings.validate('conveyor-auto', 5, 5, 0, player);
  expect(far.reason).toBe('valid'); expect(far.snappedToConveyor).toBeUndefined();
  expect(far.conveyorPreviewChanges).toBeUndefined(); expect(buildings.get(belt.id)!.autoConveyor!.shape).toBe('straight');
});

it.each([0, 1, 2, 3])('aligns partially touching left and right turns at rotation %s', (rotation) => {
  const d = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  for (const side of [-1, 1]) for (const offset of [-1, 1]) {
    const { buildings, logistics } = setup();
    const first = place(buildings, 'conveyor-auto', 0, 0, rotation);
    const sideX = -d.z * side, sideZ = d.x * side;
    const x = sideX * 2 + d.x * offset, z = sideZ * 2 + d.z * offset;
    const preview = buildings.validate('conveyor-auto', x, z, 0, player);
    expect(preview.reason).toBe('valid'); expect(preview.snappedToConveyor).toBe(true);
    expect(preview.transform.x).toBeCloseTo(sideX * 2); expect(preview.transform.z).toBeCloseTo(sideZ * 2);
    const next = place(buildings, 'conveyor-auto', x, z); logistics.sync();
    expect(logistics.network.get(first.id)!.output).toBe(next.id);
    expect(buildings.get(first.id)!.autoConveyor!.shape).toBe(side === 1 ? 'curve-right' : 'curve-left');
  }
});

it.each([0, 1, 2, 3])('previewed curve joins the new belt in the renderer and simulation at rotation %s', async (rotation) => {
  const { Vector3 } = await import('three');
  const { BuildingView } = await import('../../src/engine/BuildingView');
  const d = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  for (const side of [-1, 1]) {
    const { buildings, logistics } = setup();
    place(buildings, 'miner-mk1', 0, 0, rotation);
    const belt = place(buildings, 'conveyor-auto', d.x * 2, d.z * 2);
    const x = belt.transform.x - d.z * side * 2, z = belt.transform.z + d.x * side * 2;
    const preview = buildings.validate('conveyor-auto', x, z, 0, player);
    expect(preview.reason).toBe('valid');
    const view = new BuildingView(buildings.registry, buildings.cellSize);
    view.sync(buildings.all()); view.setPreview('conveyor-auto', preview); view.group.updateMatrixWorld(true);
    const turn = view.group.getObjectByName(`building-change-preview:${belt.id}`)!;
    const candidate = view.group.getObjectByName('building-preview')!;
    const output = new Vector3(), input = new Vector3();
    turn.getObjectByName('conveyor-output')!.getWorldPosition(output);
    candidate.getObjectByName('conveyor-input')!.getWorldPosition(input);
    expect(output.distanceTo(input)).toBeLessThan(1e-7);
    const placed = place(buildings, 'conveyor-auto', x, z); logistics.sync();
    view.sync(buildings.all()); view.setPreview(null); view.group.updateMatrixWorld(true);
    const actual = new Vector3(); view.group.getObjectByName(belt.id)!.getObjectByName('conveyor-output')!.getWorldPosition(actual);
    expect(actual.distanceTo(output)).toBeLessThan(1e-7);
    expect(logistics.network.get(belt.id)!.path.compatible(logistics.network.get(placed.id)!.path)).toBe(true);
    view.dispose();
  }
});

it('keeps ambiguous partial contacts on the grid instead of guessing a neighbour', () => {
  const { buildings } = setup();
  place(buildings, 'conveyor-auto', -2, -1);
  place(buildings, 'conveyor-auto', 1, 2);
  const preview = buildings.validate('conveyor-auto', 0, 0, 0, player);
  expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('disconnected');
  expect(preview.snappedToConveyor).toBeUndefined();
  expect(preview.transform.x).toBe(0); expect(preview.transform.z).toBe(0);
  expect(preview.conveyorPreviewChanges).toBeUndefined();
});

it('does not show a turn when the topology safety guard rejects placement', () => {
  const { buildings, playerInventory } = setup();
  const first = place(buildings, 'conveyor-auto', 0, 0);
  buildings.addTopologyGuard(() => false);
  const stock = playerInventory.snapshot();
  const preview = buildings.validate('conveyor-auto', 2, 0, 0, player);
  expect(preview.reason).toBe('conveyor occupied'); expect(preview.conveyorPreviewChanges).toBeUndefined();
  expect(buildings.place('conveyor-auto', 2, 0, 0, player).reason).toBe('conveyor occupied');
  expect(buildings.get(first.id)!.autoConveyor!.shape).toBe('straight'); expect(playerInventory.snapshot()).toEqual(stock);
});

it('previews successive left and right bends and delivers every material through the whole route', () => {
  const { buildings, machines, logistics } = setup();
  const miner = place(buildings, 'miner-mk1', 0, 0), first = place(buildings, 'conveyor-auto', 0, -2);
  logistics.sync(); const stock = machines.get(miner.id)!.output; stock.addItem('iron-ore', 9);
  for (let i = 0; i < 180; i++) logistics.fixedUpdate(50);
  const side = buildings.validate('conveyor-auto', 2, -2, 0, player);
  expect(side.conveyorPreviewChanges?.find((b) => b.id === first.id)?.autoConveyor?.shape).toBe('curve-right');
  const second = place(buildings, 'conveyor-auto', 2, -2); logistics.sync();
  for (let i = 0; i < 100; i++) logistics.fixedUpdate(50);
  const ahead = buildings.validate('conveyor-auto', 2, -4, 0, player);
  expect(ahead.reason).toBe('valid');
  expect(ahead.conveyorPreviewChanges?.find((b) => b.id === second.id)?.autoConveyor?.shape).toBe('curve-left');
  const third = place(buildings, 'conveyor-auto', 2, -4); logistics.sync();
  const right = buildings.validate('conveyor-auto', 4, -4, 0, player);
  expect(right.reason).toBe('valid');
  expect(right.conveyorPreviewChanges?.find((b) => b.id === third.id)?.autoConveyor?.shape).toBe('curve-right');
  const fourth = place(buildings, 'conveyor-auto', 4, -4); logistics.sync();
  const terminal = place(buildings, 'receiving-terminal', 6, -4, 3); logistics.sync();
  expect(logistics.network.get(first.id)!.output).toBe(second.id);
  expect(logistics.network.get(second.id)!.output).toBe(third.id);
  expect(logistics.network.get(third.id)!.output).toBe(fourth.id);
  for (let i = 0; i < 600; i++) {
    logistics.fixedUpdate(50);
    expect(stock.getItemCount('iron-ore') + logistics.terminal(terminal.id)!.getItemCount('iron-ore') + logistics.network.all().reduce((n, s) => n + s.items.length, 0)).toBe(9);
  }
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(9);
});

it('routes miner ore into a smelter and ingots into a terminal with directional cell belts', () => {
  const { buildings, machines, logistics, playerInventory } = setup();
  playerInventory.addItem('wood', 100);
  const miner = place(buildings, 'miner-mk1', 0, 0);
  place(buildings, 'conveyor-cell', -.5, -1.5);
  const smelter = place(buildings, 'smelter', 0, -3);
  place(buildings, 'conveyor-cell', -.5, -4.5);
  const terminal = place(buildings, 'receiving-terminal', 0, -6);
  logistics.sync();
  const s = machines.smelter(smelter.id)!; s.fuel.addItem('coal', 100);
  for (let i = 0; i < 1600; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ingot')).toBeGreaterThan(0);
  const produced = 40;
  const total = machines.get(miner.id)!.output.getItemCount('iron-ore') + s.input.getItemCount('iron-ore') +
    s.output.getItemCount('iron-ingot') + logistics.terminal(terminal.id)!.getItemCount('iron-ingot') +
    logistics.network.all().reduce((sum, segment) => sum + segment.items.length, 0);
  expect(total).toBe(produced);
  expect(buildings.demolish(smelter.id)).toBe('output not empty');
});

it.each([0, 1, 2, 3])('connects a smelter placed between existing input and output belts, rotation %i', (r) => {
  const { buildings, machines, logistics, playerInventory } = setup(); playerInventory.addItem('wood', 100);
  const rotate = (x: number, z: number) => {
    const angle = r * Math.PI / 2;
    return { x: Math.round(x * Math.cos(angle) + z * Math.sin(angle)), z: Math.round(-x * Math.sin(angle) + z * Math.cos(angle)) };
  };
  const a = rotate(-.5 * 2, 1.5 * 2), b = rotate(-.5 * 2, -1.5 * 2);
  const input = place(buildings, 'conveyor-cell', a.x / 2, a.z / 2, r);
  const output = place(buildings, 'conveyor-cell', b.x / 2, b.z / 2, r);
  const result = buildings.place('smelter', 0, 0, r, player); expect(result.reason).toBe('valid'); expect(result.connection).toBe('connected');
  logistics.sync(); const s = machines.smelter(result.building!.id)!;
  expect(logistics.network.get(input.id)!.receiver?.id).toBe(s.id);
  expect(logistics.network.get(output.id)!.source?.id).toBe(s.id);
});

it('filters non-iron input and conserves blocked stock until space is freed', () => {
  const { buildings, machines, logistics, playerInventory } = setup(); playerInventory.addItem('wood', 100);
  const belt = place(buildings, 'conveyor-cell', -.5, 1.5);
  const building = place(buildings, 'smelter', 0, 0); logistics.sync();
  const s = machines.smelter(building.id)!, receiver = logistics.network.get(belt.id)!.receiver!;
  expect(receiver.canAccept('copper-ore')).toBe(false); expect(receiver.accept('copper-ore')).toBe(false);
  s.input.addItem('iron-ore', 100); s.fuel.addItem('coal', 100); s.output.addItem('iron-ingot', 100);
  expect(receiver.canAccept('iron-ore')).toBe(false);
  machines.fixedUpdate(30000); expect(s.input.getItemCount('iron-ore')).toBe(100);
  expect(buildings.demolish(building.id)).toBe('output not empty');
  s.output.removeItem('iron-ingot', 1); machines.fixedUpdate(2000);
  expect(s.input.getItemCount('iron-ore')).toBe(99); expect(s.output.getItemCount('iron-ingot')).toBe(100);
  expect(receiver.canAccept('iron-ore')).toBe(true);
});

it('backs up a full smelter-to-terminal line and resumes without losing material', () => {
  const { buildings, machines, logistics, playerInventory, items } = setup(); playerInventory.addItem('wood', 100);
  const miner = place(buildings, 'miner-mk1', 0, 0);
  place(buildings, 'conveyor-cell', -.5, -1.5); const building = place(buildings, 'smelter', 0, -3);
  place(buildings, 'conveyor-cell', -.5, -4.5); const terminalBuilding = place(buildings, 'receiving-terminal', 0, -6);
  logistics.sync(); const terminal = logistics.terminal(terminalBuilding.id)!, smelter = machines.smelter(building.id)!;
  terminal.addItem('iron-ingot', terminal.capacity * 100); smelter.fuel.addItem('coal', 100);
  for (let i = 0; i < 11000; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  smelter.fuel.addItem('coal', 10);
  for (let i = 0; i < 400; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(smelter.state).toBe('OUTPUT_FULL'); expect(smelter.input.getItemCount('iron-ore')).toBe(100);
  const total = () => machines.get(miner.id)!.output.getItemCount('iron-ore') + smelter.input.getItemCount('iron-ore') +
    smelter.output.getItemCount('iron-ingot') + terminal.getItemCount('iron-ingot') + logistics.network.all().reduce((n, belt) => n + belt.items.length, 0);
  machines.get(miner.id)!.setEnabled(false);
  const before = total(), recovered = new Inventory(items, 10);
  expect(logistics.retrieve(terminalBuilding.id, recovered).moved).toBeGreaterThan(0);
  for (let i = 0; i < 800; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(terminal.getItemCount('iron-ingot')).toBeGreaterThan(0);
  expect(total() + recovered.getItemCount('iron-ingot')).toBe(before);
  expect(smelter.input.getItemCount('iron-ore')).toBeLessThan(100);
});

it('receives ore and coal from two miners on separate lanes and stops when coal runs out', () => {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  inventory.addItem('stone', 300); inventory.addItem('wood', 200);
  const coal: ResourceDeposit = { ...deposit, id: 'coal', itemId: 'coal', x: 3, z: -3 };
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29, [deposit, coal]);
  const machines = new MachineManager(buildings, items, () => [deposit, coal]);
  const logistics = new LogisticsManager(buildings, machines, items);
  const ironMiner = place(buildings, 'miner-mk1', 0, 0);
  const coalMiner = place(buildings, 'miner-mk1', 3, -3, 1);
  const smelterBuilding = place(buildings, 'smelter', 0, -3);
  const oreBelt = place(buildings, 'conveyor-cell', -.5, -1.5);
  place(buildings, 'conveyor-cell', 1.5, -2.5, 2);
  place(buildings, 'conveyor-cell', 1.5, -1.5, 1);
  const coalBelt = place(buildings, 'conveyor-cell', .5, -1.5);
  place(buildings, 'conveyor-cell', -.5, -4.5);
  const terminal = place(buildings, 'receiving-terminal', 0, -6);
  logistics.sync(); const s = machines.smelter(smelterBuilding.id)!;
  expect(logistics.network.get(oreBelt.id)!.receiver?.id).toBe(s.id);
  expect(logistics.network.get(coalBelt.id)!.receiver?.id).toBe(s.id);
  for (let i = 0; i < 2000; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  const ingots = logistics.terminal(terminal.id)!.getItemCount('iron-ingot'); expect(ingots).toBeGreaterThan(0);
  const inTransit = (item: string) => logistics.network.all().reduce((n, b) => n + b.items.filter((entry) => entry.itemId === item).length, 0);
  const producedIngots = ingots + s.output.getItemCount('iron-ingot') + inTransit('iron-ingot');
  expect(producedIngots + s.fuel.getItemCount('coal') + machines.get(coalMiner.id)!.output.getItemCount('coal') + inTransit('coal')).toBe(50);
  expect(producedIngots + s.input.getItemCount('iron-ore') + machines.get(ironMiner.id)!.output.getItemCount('iron-ore') + inTransit('iron-ore')).toBe(50);
  // Stop all input and let in-flight coal drain, then ensure production stops at NO_POWER.
  machines.get(ironMiner.id)!.setEnabled(false); machines.get(coalMiner.id)!.setEnabled(false);
  for (let i = 0; i < 2000; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  s.input.addItem('iron-ore', 5); s.fuel.removeItem('coal', s.fuel.getItemCount('coal') || 1);
  const before = s.output.getItemCount('iron-ingot') + logistics.terminal(terminal.id)!.getItemCount('iron-ingot') +
    logistics.network.all().reduce((n, b) => n + b.items.filter((item) => item.itemId === 'iron-ingot').length, 0);
  for (let i = 0; i < 200; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  const after = s.output.getItemCount('iron-ingot') + logistics.terminal(terminal.id)!.getItemCount('iron-ingot') +
    logistics.network.all().reduce((n, b) => n + b.items.filter((item) => item.itemId === 'iron-ingot').length, 0);
  expect(after).toBe(before); expect(s.state).toBe('NO_POWER');
});

it('protects remaining coal from demolition and rejects unrelated conveyor items', () => {
  const { buildings, machines, logistics, playerInventory, items } = setup(); playerInventory.addItem('wood', 100);
  const belt = place(buildings, 'conveyor-cell', -.5, 1.5);
  const building = place(buildings, 'smelter', 0, 0); logistics.sync();
  const s = machines.smelter(building.id)!, receiver = logistics.network.get(belt.id)!.receiver!;
  expect(receiver.accept('coal')).toBe(true); expect(receiver.accept('copper-ore')).toBe(false);
  expect(s.fuel.getItemCount('coal')).toBe(1); expect(buildings.demolish(building.id)).toBe('output not empty');
  const player = new Inventory(items, 1); expect(s.retrieveFuel(player).moved).toBe(1);
  expect(buildings.demolish(building.id)).toBe('removed');
});

it('extracts coal from a generated deposit using the standard miner', async () => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { createWorld } = await import('../../src/world/World');
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
  inventory.addItem('stone', 100); inventory.addItem('wood', 100);
  const config = createGameConfig(), world = createWorld(config, inventory);
  const coal = world.deposits.find((d) => d.itemId === 'coal'); expect(coal).toBeDefined();
  const result = world.buildings.place('miner-mk1', coal!.x, coal!.z, 0, { x: 80, z: 80, radius: .4 });
  expect(result.reason).toBe('valid');
  const machines = new MachineManager(world.buildings, items, () => world.deposits);
  machines.fixedUpdate(10000); const miner = machines.get(result.building!.id)!;
  expect(miner.output.getItemCount('coal')).toBeGreaterThan(0);
  expect(miner.retrieve(inventory).moved).toBeGreaterThan(0); expect(inventory.getItemCount('coal')).toBeGreaterThan(0);
});

it('independently backpressures coal and ore at the same inlet', () => {
  const { buildings, machines, logistics, playerInventory } = setup(); playerInventory.addItem('wood', 100);
  const a = place(buildings, 'conveyor-cell', -.5, 1.5), b = place(buildings, 'conveyor-cell', .5, 1.5);
  const machine = place(buildings, 'smelter', 0, 0); logistics.sync();
  const s = machines.smelter(machine.id)!, first = logistics.network.get(a.id)!.receiver!, second = logistics.network.get(b.id)!.receiver!;
  expect(first.accept('coal')).toBe(true); expect(second.accept('iron-ore')).toBe(true);
  s.fuel.addItem('coal', 99); expect(first.canAccept('coal')).toBe(false); expect(first.canAccept('iron-ore')).toBe(true);
  s.input.addItem('iron-ore', 99); s.fuel.removeItem('coal', 1);
  expect(second.canAccept('iron-ore')).toBe(false); expect(second.canAccept('coal')).toBe(true);
});

it('protects a creative smelter and its contents even after switching to survival mode', () => {
  const { buildings, machines, logistics, items } = setup(); buildings.setCreativeMode(true);
  const building = place(buildings, 'smelter', 0, -3); logistics.sync();
  const s = machines.smelter(building.id)!; s.fuel.addItem('coal', 1);
  buildings.setCreativeMode(false); expect(buildings.demolish(building.id)).toBe('output not empty');
  const inventory = new Inventory(items, 1); expect(s.retrieveFuel(inventory).moved).toBe(1);
  expect(buildings.demolish(building.id)).toBe('removed'); expect(inventory.getItemCount('stone')).toBe(0);
});

it('runs an automated iron and coal to plate chain with exact conservation', () => {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  const coal: ResourceDeposit = { ...deposit, id: 'coal', itemId: 'coal', x: 3, z: -3 };
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29, [deposit, coal]);
  buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => [deposit, coal]);
  const logistics = new LogisticsManager(buildings, machines, items);
  const ironMiner = place(buildings, 'miner-mk1', 0, 0), coalMiner = place(buildings, 'miner-mk1', 3, -3, 1);
  const smelter = place(buildings, 'smelter', 0, -3), constructor = place(buildings, 'constructor', 0, -6);
  place(buildings, 'conveyor-cell', -.5, -1.5);
  place(buildings, 'conveyor-cell', 1.5, -2.5, 2); place(buildings, 'conveyor-cell', 1.5, -1.5, 1);
  place(buildings, 'conveyor-cell', .5, -1.5);
  const ingotBelt = place(buildings, 'conveyor-cell', -.5, -4.5);
  const plateBelt = place(buildings, 'conveyor-cell', -.5, -7.5);
  const terminal = place(buildings, 'receiving-terminal', 0, -9); logistics.sync();
  const s = machines.smelter(smelter.id)!, c = machines.constructorMachine(constructor.id)!;
  expect(logistics.network.get(ingotBelt.id)!.source?.id).toBe(s.id);
  expect(logistics.network.get(ingotBelt.id)!.receiver?.id).toBe(c.id);
  expect(logistics.network.get(plateBelt.id)!.source?.id).toBe(c.id);
  expect(logistics.network.get(plateBelt.id)!.receiver?.id).toBe(terminal.id);
  expect(logistics.network.get(ingotBelt.id)!.receiver!.accept('coal')).toBe(false);
  for (let i = 0; i < 2000; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  const inTransit = (id: string) => logistics.network.all().reduce((n, belt) => n + belt.items.filter((entry) => entry.itemId === id).length, 0);
  const plates = logistics.terminal(terminal.id)!.getItemCount('iron-plate'); expect(plates).toBeGreaterThan(0);
  const iron = machines.get(ironMiner.id)!.output.getItemCount('iron-ore') + s.input.getItemCount('iron-ore') + inTransit('iron-ore') +
    s.output.getItemCount('iron-ingot') + c.input.getItemCount('iron-ingot') + inTransit('iron-ingot') +
    c.output.getItemCount('iron-plate') + inTransit('iron-plate') + plates;
  expect(iron).toBe(50);
  const transformed = s.output.getItemCount('iron-ingot') + c.input.getItemCount('iron-ingot') + inTransit('iron-ingot') +
    c.output.getItemCount('iron-plate') + inTransit('iron-plate') + plates;
  expect(transformed + s.fuel.getItemCount('coal') + machines.get(coalMiner.id)!.output.getItemCount('coal') + inTransit('coal')).toBe(50);
  expect(buildings.demolish(constructor.id)).toBe('output not empty');
});

it.each([0, 1, 2, 3])('connects constructor to existing input and output lanes at rotation %i', (r) => {
  const { buildings, machines, logistics } = setup(); buildings.setCreativeMode(true);
  const rotate = (x: number, z: number) => { const a = r * Math.PI / 2; return { x: Math.round(x * Math.cos(a) + z * Math.sin(a)) / 2, z: Math.round(-x * Math.sin(a) + z * Math.cos(a)) / 2 }; };
  const a = rotate(-1, 3), b = rotate(-1, -3);
  const input = place(buildings, 'conveyor-cell', a.x, a.z, r), output = place(buildings, 'conveyor-cell', b.x, b.z, r);
  const result = buildings.place('constructor', 0, 0, r, player); expect(result.reason).toBe('valid'); expect(result.connection).toBe('connected');
  logistics.sync(); expect(logistics.network.get(input.id)!.receiver?.id).toBe(result.building!.id);
  expect(logistics.network.get(output.id)!.source?.id).toBe(result.building!.id);
  expect(machines.constructorMachine(result.building!.id)).toBeDefined();
});

it('backs up a full plate terminal and resumes the entire chain without losing iron', () => {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  const coal: ResourceDeposit = { ...deposit, id: 'coal', itemId: 'coal', x: 3, z: -3 };
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29, [deposit, coal]);
  buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => [deposit, coal]), logistics = new LogisticsManager(buildings, machines, items);
  const ironMiner = place(buildings, 'miner-mk1', 0, 0), coalMiner = place(buildings, 'miner-mk1', 3, -3, 1);
  const smelter = place(buildings, 'smelter', 0, -3), constructor = place(buildings, 'constructor', 0, -6);
  place(buildings, 'conveyor-cell', -.5, -1.5); place(buildings, 'conveyor-cell', 1.5, -2.5, 2);
  place(buildings, 'conveyor-cell', 1.5, -1.5, 1); place(buildings, 'conveyor-cell', .5, -1.5);
  place(buildings, 'conveyor-cell', -.5, -4.5); place(buildings, 'conveyor-cell', -.5, -7.5);
  const terminal = place(buildings, 'receiving-terminal', 0, -9); logistics.sync();
  const s = machines.smelter(smelter.id)!, c = machines.constructorMachine(constructor.id)!, storage = logistics.terminal(terminal.id)!;
  storage.addItem('iron-plate', 100);
  for (let i = 0; i < 16000; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(c.state).toBe('OUTPUT_FULL'); expect(c.input.getItemCount('iron-ingot')).toBe(100);
  machines.get(ironMiner.id)!.setEnabled(false); machines.get(coalMiner.id)!.setEnabled(false);
  const ironTotal = () => machines.get(ironMiner.id)!.output.getItemCount('iron-ore') + s.input.getItemCount('iron-ore') +
    s.output.getItemCount('iron-ingot') + c.input.getItemCount('iron-ingot') + c.output.getItemCount('iron-plate') +
    storage.getItemCount('iron-plate') + logistics.network.all().reduce((n, belt) => n + belt.items.filter((item) => item.itemId !== 'coal').length, 0);
  const before = ironTotal(), collected = new Inventory(items, 1);
  expect(logistics.retrieve(terminal.id, collected).moved).toBe(100);
  for (let i = 0; i < 1000; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(storage.getItemCount('iron-plate')).toBeGreaterThan(0);
  expect(ironTotal() + collected.getItemCount('iron-plate')).toBe(before);
});

it('protects both constructor buffers and halts conveyor output when disabled', () => {
  const { buildings, machines, logistics, items } = setup(); buildings.setCreativeMode(true);
  const constructor = place(buildings, 'constructor', 0, 0), belt = place(buildings, 'conveyor-cell', -.5, -1.5);
  logistics.sync(); const c = machines.constructorMachine(constructor.id)!;
  c.input.addItem('iron-ingot', 1); expect(buildings.demolish(constructor.id)).toBe('output not empty');
  c.fixedUpdate(2000); expect(buildings.demolish(constructor.id)).toBe('output not empty');
  c.setEnabled(false); for (let i = 0; i < 100; i++) logistics.fixedUpdate(50);
  expect(c.output.getItemCount('iron-plate')).toBe(1); expect(logistics.network.get(belt.id)!.items).toHaveLength(0);
  const player = new Inventory(items, 1); expect(c.retrieve(player).moved).toBe(1);
  expect(buildings.demolish(constructor.id)).toBe('removed');
});

it.each([0, 1, 2, 3])('connects a storage container in either placement order at rotation %i', (r) => {
  for (const storageFirst of [true, false]) {
    const { buildings, logistics } = setup(); buildings.setCreativeMode(true);
    const rotate = (x: number, z: number) => { const a = r * Math.PI / 2; return { x: Math.round(x * Math.cos(a) + z * Math.sin(a)) / 2, z: Math.round(-x * Math.sin(a) + z * Math.cos(a)) / 2 }; };
    const a = rotate(-1, 3), b = rotate(-1, -3);
    let storage: ReturnType<typeof place>, input: ReturnType<typeof place>, output: ReturnType<typeof place>;
    if (storageFirst) { storage = place(buildings, 'storage-container', 0, 0, r); input = place(buildings, 'conveyor-cell', a.x, a.z, r); output = place(buildings, 'conveyor-cell', b.x, b.z, r); }
    else { input = place(buildings, 'conveyor-cell', a.x, a.z, r); output = place(buildings, 'conveyor-cell', b.x, b.z, r); storage = place(buildings, 'storage-container', 0, 0, r); }
    logistics.sync(); expect(logistics.network.get(input.id)!.receiver?.id).toBe(storage.id);
    expect(logistics.network.get(output.id)!.source?.id).toBe(storage.id);
    expect(logistics.terminal(storage.id)!.capacity).toBe(8);
  }
});

it('stores and forwards mixed items with bounded capacity, backpressure, and conservation', () => {
  const { buildings, logistics } = setup(); buildings.setCreativeMode(true);
  const input = place(buildings, 'conveyor-cell', -.5, 1.5);
  const storage = place(buildings, 'storage-container', 0, 0);
  logistics.sync(); const inventory = logistics.terminal(storage.id)!;
  const receiver = logistics.network.get(input.id)!.receiver!;
  inventory.addItem('iron-ore', 800); expect(receiver.canAccept('iron-ore')).toBe(false);
  expect(receiver.accept('coal')).toBe(false); expect(buildings.demolish(storage.id)).toBe('output not empty');
  inventory.removeItem('iron-ore', 100); expect(receiver.accept('coal')).toBe(true);
  const output = place(buildings, 'conveyor-cell', -.5, -1.5);
  const sinkBuilding = place(buildings, 'receiving-terminal', 0, -3);
  logistics.sync(); const sink = logistics.terminal(sinkBuilding.id)!;
  sink.addItem('stone', 100);
  for (let i = 0; i < 500; i++) logistics.fixedUpdate(50);
  const total = (itemId: string) => inventory.getItemCount(itemId) + sink.getItemCount(itemId) + logistics.network.all().reduce((n, b) => n + b.items.filter((i) => i.itemId === itemId).length, 0);
  expect(total('iron-ore')).toBe(700); expect(total('coal')).toBe(1);
  expect(logistics.network.get(output.id)!.state).toBe('BLOCKED');
  sink.removeItem('stone', 100);
  for (let i = 0; i < 4000; i++) logistics.fixedUpdate(50);
  expect(sink.getItemCount('coal')).toBe(1); expect(total('iron-ore')).toBe(700); expect(total('coal')).toBe(1);
  sink.removeItem('coal', 1);
  for (let i = 0; i < 4000; i++) logistics.fixedUpdate(50);
  expect(sink.getItemCount('iron-ore')).toBe(100); expect(total('iron-ore')).toBe(700); expect(total('coal')).toBe(0);
  expect(buildings.demolish(storage.id)).toBe('output not empty');
});

it('automatically buffers a real miner through storage and forwards every item into the terminal', () => {
  const { buildings, machines, logistics } = setup(); buildings.setCreativeMode(true);
  const miner = place(buildings, 'miner-mk1', 0, 0), input = place(buildings, 'conveyor-cell', -.5, -1.5);
  const storage = place(buildings, 'storage-container', 0, -3), output = place(buildings, 'conveyor-cell', -.5, -4.5);
  const terminal = place(buildings, 'receiving-terminal', 0, -6); logistics.sync();
  expect(logistics.network.get(input.id)!.receiver?.id).toBe(storage.id);
  expect(logistics.network.get(output.id)!.source?.id).toBe(storage.id);
  for (let i = 0; i < 1200; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  const sink = logistics.terminal(terminal.id)!, box = logistics.terminal(storage.id)!;
  expect(sink.getItemCount('iron-ore')).toBeGreaterThan(0);
  const total = machines.get(miner.id)!.output.getItemCount('iron-ore') + box.getItemCount('iron-ore') + sink.getItemCount('iron-ore') + logistics.network.all().reduce((n, b) => n + b.items.length, 0);
  expect(total).toBe(30);
});

it('backs up the miner into a full container and resumes after space is freed', () => {
  const { buildings, machines, logistics } = setup(); buildings.setCreativeMode(true);
  const miner = place(buildings, 'miner-mk1', 0, 0), belt = place(buildings, 'conveyor-cell', -.5, -1.5);
  const storage = place(buildings, 'storage-container', 0, -3); logistics.sync();
  const stock = machines.get(miner.id)!.output, box = logistics.terminal(storage.id)!;
  box.addItem('iron-ore', 800); stock.addItem('iron-ore', 10);
  for (let i = 0; i < 600; i++) logistics.fixedUpdate(50);
  expect(logistics.network.get(belt.id)!.state).toBe('BLOCKED');
  expect(stock.getItemCount('iron-ore') + logistics.network.get(belt.id)!.items.length + box.getItemCount('iron-ore')).toBe(810);
  box.removeItem('iron-ore', 20);
  for (let i = 0; i < 600; i++) logistics.fixedUpdate(50);
  expect(box.getItemCount('iron-ore')).toBe(790);
  expect(stock.getItemCount('iron-ore') + logistics.network.get(belt.id)!.items.length + box.getItemCount('iron-ore')).toBe(790);
  box.removeItem('iron-ore', 790); expect(buildings.demolish(storage.id)).toBe('removed');
});

it.each([0, 1, 2, 3])('connects all splitter ports at rotation %i in either placement order', (r) => {
  for (const first of [true, false]) {
    const { buildings, logistics } = setup(); buildings.setCreativeMode(true);
    const rotate = (x: number, z: number) => { const a = r * Math.PI / 2; return { x: Math.round(x * Math.cos(a) + z * Math.sin(a)) / 2, z: Math.round(-x * Math.sin(a) + z * Math.cos(a)) / 2 }; };
    const cells = [[-1, 3, 0], [-1, -3, 0], [-3, -1, 1], [3, 1, 3]] as const;
    const buildCells = () => cells.map(([x,z,rotation]) => { const p = rotate(x,z); return place(buildings, 'conveyor-cell', p.x, p.z, (rotation+r)%4); });
    let splitter: ReturnType<typeof place>, belts: ReturnType<typeof buildCells>;
    if (first) { splitter = place(buildings, 'splitter', 0, 0, r); belts = buildCells(); }
    else { belts = buildCells(); splitter = place(buildings, 'splitter', 0, 0, r); }
    logistics.sync(); expect(logistics.network.get(belts[0]!.id)!.receiver?.id).toBe(splitter.id);
    for (let i = 0; i < 3; i++) expect(logistics.network.get(belts[i+1]!.id)!.source?.id).toBe(`${splitter.id}:output:${i}`);
  }
});

it('distributes a stored supply fairly across three terminals and preserves all items', () => {
  const { buildings, logistics } = setup(); buildings.setCreativeMode(true);
  const supply = place(buildings, 'storage-container', 0, 3);
  place(buildings, 'conveyor-cell', -.5, 1.5); const splitter = place(buildings, 'splitter', 0, 0);
  place(buildings, 'conveyor-cell', -.5, -1.5); place(buildings, 'conveyor-cell', -1.5, -.5, 1); place(buildings, 'conveyor-cell', 1.5, .5, 3);
  const destinations = [place(buildings, 'receiving-terminal', 0, -3), place(buildings, 'receiving-terminal', -3, 0), place(buildings, 'receiving-terminal', 3, 0)];
  logistics.sync(); logistics.terminal(supply.id)!.addItem('iron-ore', 30);
  const total = () => logistics.terminal(supply.id)!.getItemCount('iron-ore') + (logistics.splitter(splitter.id)!.pending ? 1 : 0) +
    logistics.network.all().reduce((n, belt) => n + belt.items.length, 0) + destinations.reduce((n, b) => n + logistics.terminal(b.id)!.getItemCount('iron-ore'), 0);
  for (let i = 0; i < 1600; i++) { logistics.fixedUpdate(50); expect(total()).toBe(30); }
  expect(destinations.map((b) => logistics.terminal(b.id)!.getItemCount('iron-ore'))).toEqual([10,10,10]);
});

it('bypasses a blocked splitter branch and resumes balanced delivery when it clears', () => {
  const { buildings, logistics } = setup(); buildings.setCreativeMode(true);
  const supply = place(buildings, 'storage-container', 0, 3); place(buildings, 'conveyor-cell', -.5, 1.5);
  const splitter = place(buildings, 'splitter', 0, 0);
  place(buildings, 'conveyor-cell', -.5, -1.5); place(buildings, 'conveyor-cell', -1.5, -.5, 1); place(buildings, 'conveyor-cell', 1.5, .5, 3);
  const ends = [place(buildings, 'receiving-terminal', 0, -3), place(buildings, 'receiving-terminal', -3, 0), place(buildings, 'receiving-terminal', 3, 0)];
  logistics.sync(); const stores = ends.map((b) => logistics.terminal(b.id)!);
  stores[0]!.addItem('stone', 100); logistics.terminal(supply.id)!.addItem('iron-ore', 60);
  for (let i = 0; i < 900; i++) logistics.fixedUpdate(50);
  expect(stores[1]!.getItemCount('iron-ore')).toBeGreaterThan(10); expect(stores[2]!.getItemCount('iron-ore')).toBeGreaterThan(10);
  stores[0]!.removeItem('stone', 100);
  for (let i = 0; i < 1200; i++) logistics.fixedUpdate(50);
  const total = logistics.terminal(supply.id)!.getItemCount('iron-ore') + (logistics.splitter(splitter.id)!.pending ? 1 : 0) + logistics.network.all().reduce((n,b) => n + b.items.length, 0) + stores.reduce((n,s) => n + s.getItemCount('iron-ore'), 0);
  expect(total).toBe(60); expect(stores[0]!.getItemCount('iron-ore')).toBeGreaterThan(0);
});

it('protects and allows recovery of a splitter buffer when all outputs are absent', () => {
  const { buildings, logistics, items } = setup(); buildings.setCreativeMode(true);
  const belt = place(buildings, 'conveyor-cell', -.5, 1.5), splitter = place(buildings, 'splitter', 0, 0);
  logistics.sync(); const receiver = logistics.network.get(belt.id)!.receiver!;
  expect(receiver.canAccept('not-an-item')).toBe(false); expect(receiver.accept('not-an-item')).toBe(false);
  expect(receiver.accept('coal')).toBe(true); expect(receiver.accept('iron-ore')).toBe(false);
  expect(buildings.demolish(splitter.id)).toBe('output not empty');
  const player = new Inventory(items, 1); player.addItem('iron-ore', 100);
  expect(logistics.retrieve(splitter.id, player).moved).toBe(0); expect(logistics.splitter(splitter.id)!.pending).toBe('coal');
  player.removeItem('iron-ore', 100); expect(logistics.retrieve(splitter.id, player).moved).toBe(1);
  expect(buildings.demolish(splitter.id)).toBe('removed');
});

it('rejects two belts competing for a splitter port before charging the player', () => {
  const { buildings, playerInventory } = setup(); buildings.setCreativeMode(true);
  place(buildings, 'splitter', 0, 0); place(buildings, 'conveyor-cell', -.5, 1.5);
  const before = playerInventory.snapshot();
  expect(buildings.place('conveyor-cell', .5, 1.5, 0, player).reason).toBe('incompatible connection');
  expect(playerInventory.snapshot()).toEqual(before);
  place(buildings, 'conveyor-cell', -.5, -1.5);
  expect(buildings.place('conveyor-cell', .5, -1.5, 0, player).reason).toBe('incompatible connection');
});

it('holds items safely when every splitter output is blocked and resumes after one clears', () => {
  const { buildings, logistics } = setup(); buildings.setCreativeMode(true);
  const supply = place(buildings, 'storage-container', 0, 3); place(buildings, 'conveyor-cell', -.5, 1.5);
  const splitter = place(buildings, 'splitter', 0, 0);
  place(buildings, 'conveyor-cell', -.5, -1.5); place(buildings, 'conveyor-cell', -1.5, -.5, 1); place(buildings, 'conveyor-cell', 1.5, .5, 3);
  const ends = [place(buildings, 'receiving-terminal', 0, -3), place(buildings, 'receiving-terminal', -3, 0), place(buildings, 'receiving-terminal', 3, 0)];
  logistics.sync(); const stores = ends.map((b) => logistics.terminal(b.id)!);
  for (const store of stores) store.addItem('stone', 100);
  logistics.terminal(supply.id)!.addItem('iron-ore', 30);
  for (let i = 0; i < 800; i++) logistics.fixedUpdate(50);
  expect(logistics.splitter(splitter.id)!.pending).toBe('iron-ore');
  expect(logistics.terminal(supply.id)!.getItemCount('iron-ore')).toBeGreaterThan(0);
  expect(buildings.demolish(splitter.id)).toBe('output not empty');
  stores[1]!.removeItem('stone', 100);
  for (let i = 0; i < 1600; i++) logistics.fixedUpdate(50);
  expect(stores[1]!.getItemCount('iron-ore')).toBeGreaterThan(20);
  const total = logistics.terminal(supply.id)!.getItemCount('iron-ore') + (logistics.splitter(splitter.id)!.pending ? 1 : 0) +
    logistics.network.all().reduce((n,b) => n + b.items.length, 0) + stores.reduce((n,s) => n + s.getItemCount('iron-ore'), 0);
  expect(total).toBe(30);
});
