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
  const b = place(buildings, 'conveyor-auto', 2, -2); logistics.sync();
  const first = logistics.network.get(a.id)!, second = logistics.network.get(b.id)!;
  expect(first.path.spec.shape).toBe('curve-right'); expect(first.path.rise).toBeCloseTo(.4);
  expect(first.path.compatible(second.path)).toBe(true);
  expect([...first.items, ...second.items].map((x) => x.id).sort()).toEqual(ids);
  const terminal = place(buildings, 'receiving-terminal', 4, -2, 3); logistics.sync();
  for (let i = 0; i < 400; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(8);
});
