import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import { machinePort, splitterPort } from '../../src/logistics/ConveyorDefinitions';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x,z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({x,z}),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const far = { x: 20, z: 20, radius: .4 };
function setup() {
  const items = createDefaultItemRegistry(), player = new Inventory(items, 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 29); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const place = (type: string, x: number, z: number, r = 0, offset?: number) => {
    const result = buildings.place(type, x, z, r, far, offset); expect(result.reason).toBe('valid'); return result.building!;
  };
  const tick = (n: number) => { for (let i = 0; i < n; i++) logistics.fixedUpdate(50); };
  return { items, buildings, logistics, place, tick };
}

describe('filtered splitter network', () => {
  it('sorts a mixed stream through one lift and two belts without losing items', () => {
    const { buildings, logistics, place, tick } = setup();
    const supply = place('storage-container', 0, 3); place('conveyor-cell', -.5, 1.5); const junction = place('splitter', 0, 0);
    const lift = place('lift-up-1.3', 0, -2); place('foundation', 0, -4, 0, .9); const front = place('storage-container', 0, -4);
    place('conveyor-cell', -1.5, -.5, 1); place('conveyor-cell', 1.5, .5, 3);
    const left = place('receiving-terminal', -3, 0), right = place('receiving-terminal', 3, 0);
    logistics.sync(); const splitter = logistics.splitter(junction.id)!;
    splitter.setOutputFilter(0, 'iron-ore'); splitter.setOutputFilter(1, 'coal'); splitter.configure('filtered', 0);
    const src = logistics.terminal(supply.id)!, destinations = [front,left,right].map((b) => logistics.terminal(b.id)!);
    const types = ['iron-ore','coal','wood']; types.forEach((id) => src.addItem(id, 15));
    for (let i = 0; i < 1500; i++) {
      tick(1);
      for (const id of types) {
        const count = src.getItemCount(id) + destinations.reduce((n, inv) => n + inv.getItemCount(id), 0) +
          Number(splitter.pending === id) + logistics.network.all().reduce((n, s) => n + s.items.filter((item) => item.itemId === id).length, 0);
        expect(count).toBe(15);
      }
    }
    expect(destinations.map((inv) => types.map((id) => inv.getItemCount(id)))).toEqual([[15,0,0],[0,15,0],[0,0,15]]);
    expect(logistics.network.flowStats(lift.id)!.total).toBe(15);
    place('foundation', 10, 10); logistics.sync(); expect(logistics.splitter(junction.id)).toBe(splitter);
    expect(splitter.mode).toBe('filtered'); expect(splitter.filters).toEqual(['iron-ore','coal',null]);
    expect(buildings.demolish(junction.id)).toBe('removed'); logistics.sync();
    const replacement = place('splitter', 0, 0); logistics.sync();
    expect(logistics.splitter(replacement.id)!.mode).toBe('balanced'); expect(logistics.splitter(replacement.id)!.filters).toEqual([null,null,null]);
  });
  it('waits for an assigned blocked output, never leaks to unmatched, and resumes safely', () => {
    const { buildings, logistics, place, tick } = setup();
    const supply = place('storage-container', 0, 3); place('conveyor-cell', -.5, 1.5); const junction = place('splitter', 0, 0);
    place('conveyor-cell', -.5, -1.5); const front = place('storage-container', 0, -3);
    place('conveyor-cell', -1.5, -.5, 1); const other = place('storage-container', -3, 0, 1);
    logistics.sync(); const s = logistics.splitter(junction.id)!; s.setOutputFilter(0, 'coal'); s.configure('filtered', 0);
    const src = logistics.terminal(supply.id)!, blocked = logistics.terminal(front.id)!, fallback = logistics.terminal(other.id)!;
    blocked.addItem('stone', 800); src.addItem('coal', 25); tick(800);
    expect(s.pending).toBe('coal'); expect(fallback.getItemCount('coal')).toBe(0); expect(buildings.demolish(junction.id)).toBe('output not empty');
    expect(src.getItemCount('coal') + Number(s.pending === 'coal') + logistics.network.all().reduce((n, belt) => n + belt.items.filter((item) => item.itemId === 'coal').length, 0)).toBe(25);
    blocked.removeItem('stone', 800); tick(1000);
    expect(blocked.getItemCount('coal')).toBe(25); expect(fallback.getItemCount('coal')).toBe(0); expect(s.pending).toBeNull();
  });
  it('holds unassigned items if all outputs are assigned and reconfiguration releases the buffer', () => {
    const { logistics, place, tick } = setup(); const junction = place('splitter', 0, 0);
    place('conveyor-cell', -.5, -1.5); const sink = place('receiving-terminal', 0, -3); logistics.sync();
    const s = logistics.splitter(junction.id)!; ['coal', 'iron-ore', 'stone'].forEach((id, i) => s.setOutputFilter(i,id)); s.configure('filtered',0);
    expect(s.receiver(machinePort(junction,1,'receiver')).accept('wood')).toBe(true); tick(150);
    expect(s.pending).toBe('wood'); expect(logistics.terminal(sink.id)!.getItemCount('wood')).toBe(0);
    s.setOutputFilter(0, null); tick(150); expect(s.pending).toBeNull(); expect(logistics.terminal(sink.id)!.getItemCount('wood')).toBe(1);
  });
});

it('merges two active streams and sorts them into separate lines', () => {
  const { logistics, place, tick } = setup();
  const supplyA = place('storage-container', 0, 6); place('conveyor-cell', -.5, 4.5);
  const supplyB = place('storage-container', 3, 3, 1); place('conveyor-cell', 1.5, 3.5, 1);
  const merge = place('merger', 0, 3); place('conveyor-cell', -.5, 1.5); const split = place('splitter', 0, 0);
  place('conveyor-cell', -.5, -1.5); const sinkA = place('receiving-terminal', 0, -3);
  place('conveyor-cell', -1.5, -.5, 1); const sinkB = place('receiving-terminal', -3, 0);
  logistics.sync(); const s = logistics.splitter(split.id)!, m = logistics.merger(merge.id)!;
  s.setOutputFilter(0, 'iron-ore'); s.setOutputFilter(1, 'coal'); s.configure('filtered', 0);
  const a = logistics.terminal(supplyA.id)!, b = logistics.terminal(supplyB.id)!, outA = logistics.terminal(sinkA.id)!, outB = logistics.terminal(sinkB.id)!;
  a.addItem('iron-ore', 30); b.addItem('coal', 30);
  for (let i = 0; i < 1800; i++) {
    tick(1);
    for (const id of ['iron-ore', 'coal']) {
      const total = [a,b,outA,outB].reduce((n, inv) => n + inv.getItemCount(id), 0) +
        m.pending.filter((item) => item === id).length + Number(s.pending === id) +
        logistics.network.all().reduce((n, belt) => n + belt.items.filter((item) => item.itemId === id).length, 0);
      expect(total).toBe(30);
    }
    if (i === 500) { expect(outA.getItemCount('iron-ore')).toBeGreaterThan(0); expect(outB.getItemCount('coal')).toBeGreaterThan(0); }
  }
  expect([outA.getItemCount('iron-ore'), outA.getItemCount('coal'), outB.getItemCount('iron-ore'), outB.getItemCount('coal')]).toEqual([30,0,0,30]);
});

it('leaves items already on a branch there when its filter changes', () => {
  const { logistics, place, tick } = setup(); const split = place('splitter', 0, 0);
  const lift = place('lift-up-1', 0, -2); place('foundation', 0, -4, 0, .6); const sink = place('storage-container', 0, -4);
  logistics.sync(); const s = logistics.splitter(split.id)!;
  s.setOutputFilter(0, 'coal'); s.configure('filtered', 0); s.receiver(machinePort(split,1,'receiver')).accept('coal');
  tick(1); expect(logistics.network.get(lift.id)!.items).toHaveLength(1);
  s.setOutputFilter(0, 'iron-ore'); tick(200); expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(1);
});


it.each([0,1,2,3])('sorts via each direct lift port at splitter rotation %i', (rotation) => {
  for (const index of [0,1,2]) {
    const { logistics, place, tick } = setup(); const junction = place('splitter', 0, 0, rotation);
    const port = splitterPort(junction, 1, index), x = port.position.x + port.direction.x, z = port.position.z + port.direction.z;
    const turn = (rotation + [0,1,3][index]!) % 4;
    const lift = place('lift-up-1.1', x, z, turn);
    const tx = x + 2 * port.direction.x, tz = z + 2 * port.direction.z;
    place('foundation', tx, tz, 0, .7); const sink = place('storage-container', tx, tz, turn);
    logistics.sync(); const s = logistics.splitter(junction.id)!; s.setOutputFilter(index, 'coal'); s.configure('filtered', 0);
    expect(s.receiver(machinePort(junction,1,'receiver')).accept('coal')).toBe(true); tick(250);
    expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(1);
    expect(logistics.network.flowStats(lift.id)!.total).toBe(1);
  }
});

it('holds an assigned item when its port is missing and releases it when connected later', () => {
  const { logistics, buildings, place, tick } = setup(); const junction = place('splitter', 0, 0);
  place('conveyor-cell', -1.5, -.5, 1); const other = place('receiving-terminal', -3, 0); logistics.sync();
  const s = logistics.splitter(junction.id)!; s.setOutputFilter(0, 'coal'); s.configure('filtered', 0);
  s.receiver(machinePort(junction, 1, 'receiver')).accept('coal'); tick(100);
  expect(s.pending).toBe('coal'); expect(logistics.terminal(other.id)!.getItemCount('coal')).toBe(0);
  expect(buildings.demolish(junction.id)).toBe('output not empty');
  place('conveyor-cell', -.5, -1.5); const sink = place('receiving-terminal', 0, -3); logistics.sync(); tick(150);
  expect(s.pending).toBeNull(); expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(1);
  expect(logistics.terminal(other.id)!.getItemCount('coal')).toBe(0);
});

it('shares duplicate item filters fairly between live output belts', () => {
  const { logistics, place, tick } = setup(); const supply = place('storage-container', 0, 3);
  place('conveyor-cell', -.5, 1.5); const junction = place('splitter', 0, 0);
  place('conveyor-cell', -.5, -1.5); const a = place('receiving-terminal', 0, -3);
  place('conveyor-cell', -1.5, -.5, 1); const b = place('receiving-terminal', -3, 0);
  place('conveyor-cell', 1.5, .5, 3); const other = place('receiving-terminal', 3, 0);
  logistics.sync(); const s = logistics.splitter(junction.id)!;
  s.setOutputFilter(0, 'coal'); s.setOutputFilter(1, 'coal'); s.configure('filtered', 0);
  logistics.terminal(supply.id)!.addItem('coal', 20); tick(900);
  expect([a,b,other].map((entry) => logistics.terminal(entry.id)!.getItemCount('coal'))).toEqual([10,10,0]);
});
