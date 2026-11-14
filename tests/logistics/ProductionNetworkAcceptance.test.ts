import { expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { GroundItems } from '../../src/logistics/GroundItems';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = {
  bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x, z) => ({ x, z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }),
};
const far = { x: 20, z: 20, radius: .4 };

it('conserves real production through merged miners, blocked splitter outputs, a lift and recovery', () => {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  const iron: ResourceDeposit = { id: 'iron', itemId: 'iron-ore', x: 0, y: 0, z: 3, radius: .8, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
  const coal: ResourceDeposit = { ...iron, id: 'coal', itemId: 'coal', x: 3, z: 0 };
  const deposits = [iron, coal];
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29, deposits);
  buildings.setCreativeMode(true);
  let paused = false;
  const machines = new MachineManager(buildings, items, () => deposits, undefined, () => paused), ground = new GroundItems(() => 0);
  const logistics = new LogisticsManager(buildings, machines, items, () => paused, 1, undefined, ground);
  const place = (type: string, x: number, z: number, rotation = 0, offset?: number) => {
    const result = buildings.place(type, x, z, rotation, far, offset);
    expect(result.reason, `${type} at ${x}, ${z}`).toBe('valid');
    return result.building!;
  };
  const ironMiner = place('miner-mk1', 0, 3), coalMiner = place('miner-mk1', 3, 0, 1);
  place('conveyor-cell', -.5, 1.5); place('conveyor-cell', 1.5, .5, 1);
  const merger = place('merger', 0, 0); place('conveyor-cell', -.5, -1.5);
  const smelterBuilding = place('smelter', 0, -3); place('conveyor-cell', -.5, -4.5);
  const constructorBuilding = place('constructor', 0, -6); place('conveyor-cell', -.5, -7.5);
  const splitterBuilding = place('splitter', 0, -9);
  const lift = place('lift-up-1', 0, -11);
  place('foundation', 0, -13, 0, .6); const elevated = place('storage-container', 0, -13);
  place('conveyor-cell', -1.5, -9.5, 1); const side = place('receiving-terminal', -3, -9);
  logistics.sync();
  const s = machines.smelter(smelterBuilding.id)!, c = machines.constructorMachine(constructorBuilding.id)!;
  const m = logistics.merger(merger.id)!, splitter = logistics.splitter(splitterBuilding.id)!;
  const outA = logistics.terminal(elevated.id)!, outB = logistics.terminal(side.id)!;
  const ironSource = machines.get(ironMiner.id)!, coalSource = machines.get(coalMiner.id)!;
  // Fill the downstream buffers before advancing the simulation.
  c.input.addItem('iron-ingot', 100); c.output.addItem('iron-plate', 100);
  outA.addItem('stone', 800); outB.addItem('stone', 100);
  const inTransit = (id: string) => logistics.network.all().reduce((n, b) => n + b.items.filter(item => item.itemId === id).length, 0);
  const held = (id: string) => m.pending.filter(item => item === id).length + Number(splitter.pending === id);
  const processed = () => s.output.getItemCount('iron-ingot') + c.input.getItemCount('iron-ingot') +
    c.output.getItemCount('iron-plate') + outA.getItemCount('iron-plate') + outB.getItemCount('iron-plate') + inventory.getItemCount('iron-plate') +
    inTransit('iron-ingot') + inTransit('iron-plate') + held('iron-ingot') + held('iron-plate');
  const accounting = (mined: number) => {
    expect(ironSource.output.getItemCount('iron-ore') + s.input.getItemCount('iron-ore') + inTransit('iron-ore') + held('iron-ore') + processed()).toBe(200 + mined);
    expect(coalSource.output.getItemCount('coal') + s.fuel.getItemCount('coal') + inTransit('coal') + held('coal') + processed() - 200).toBe(mined);
    expect(ground.all()).toHaveLength(0);
  };
  let expectedMined: number | null = null;
  const ticks = (n: number) => {
    for (let i = 0; i < n; i++) {
      machines.fixedUpdate(50); logistics.fixedUpdate(50);
      if (expectedMined !== null && i % 100 === 0) accounting(expectedMined);
    }
  };
  ticks(2400); // 120 seconds: each miner extracts 60 units
  // Simulate deposits becoming unavailable while retaining the miners' queued output.
  deposits.splice(0);
  expect(ironSource.state).toBe('MISSING_INPUT'); expect(coalSource.state).toBe('MISSING_INPUT');
  expectedMined = 60; accounting(60);
  expect(c.state).toBe('OUTPUT_FULL'); expect(splitter.pending).toBe('iron-plate');
  expect(outA.getItemCount('iron-plate') + outB.getItemCount('iron-plate')).toBe(0);
  expect(buildings.demolish(splitterBuilding.id)).toBe('output not empty');
  const snapshot = () => ({
    inventories: [ironSource.output, coalSource.output, s.input, s.fuel, s.output, c.input, c.output, outA, outB].map(inv => inv.snapshot()),
    belts: logistics.network.all().map(b => b.items.map(item => ({ ...item }))),
    merger: m.pending, splitter: splitter.pending, progress: [s.progress, c.progress],
  });
  const beforePause = snapshot(); paused = true; ticks(200); expect(snapshot()).toEqual(beforePause); paused = false;
  // Clear only the belt branch. Balanced routing skips the full lift branch.
  outB.removeItem('stone', 100); ticks(2200); accounting(60);
  expect(outB.getItemCount('iron-plate')).toBeGreaterThan(30);
  expect(outA.getItemCount('iron-plate')).toBe(0);
  // Clear the elevated outlet and keep advancing the network.
  outA.removeItem('stone', 800); ticks(8000); accounting(60);
  expect(outA.getItemCount('iron-plate')).toBeGreaterThan(0);
  // The full side terminal still blocks items already committed to its belt;
  // balanced routing cannot pull them back onto the newly opened lift branch.
  expect(outB.getItemCount('iron-plate')).toBe(100);
  expect(inTransit('iron-plate')).toBeGreaterThan(0);
  expect(logistics.retrieve(side.id, inventory).moved).toBe(100);
  ticks(400); accounting(60);
  expect(outA.getItemCount('iron-plate') + outB.getItemCount('iron-plate') + inventory.getItemCount('iron-plate')).toBe(260);
  expect(logistics.network.flowStats(lift.id)!.total).toBeGreaterThan(0);
  expect(ironSource.output.usedSlots + coalSource.output.usedSlots + s.input.usedSlots + s.fuel.usedSlots + s.output.usedSlots + c.input.usedSlots + c.output.usedSlots).toBe(0);
  expect(m.occupied).toBe(false); expect(splitter.pending).toBeNull();
  expect(logistics.network.all().reduce((n, b) => n + b.items.length, 0)).toBe(0);
});
