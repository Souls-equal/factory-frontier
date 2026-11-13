import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
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


describe('fractional height lifts', () => {
  it.each([0, 1, 2, 3])('connects and moves through both directions at rotation %i in both build orders', (r) => {
    for (const direction of ['up', 'down']) for (const liftFirst of [true, false]) {
      const { logistics, buildings, place, tick } = setup(); const height = 2.3;
      const vector = [[0,-1],[-1,0],[0,1],[1,0]][r]!;
      const dx = vector[0]!, dz = vector[1]!;
      const sx = -2 * dx, sz = -2 * dz, tx = 2 * dx, tz = 2 * dz;
      place('foundation', direction === 'up' ? tx : sx, direction === 'up' ? tz : sz, 0, height - .4);
      const type = `lift-${direction}-${height}`;
      let source, sink, lift;
      if (liftFirst) { lift = place(type, 0, 0, r); source = place('storage-container', sx, sz, r); sink = place('storage-container', tx, tz, r); }
      else {
        source = place('storage-container', sx, sz, r); sink = place('storage-container', tx, tz, r);
        expect(buildings.validate(type, 0, 0, r, far)).toMatchObject({ reason: 'valid', connection: 'connected' });
        lift = place(type, 0, 0, r);
      }
      logistics.sync(); const seg = logistics.network.get(lift.id)!;
      expect(seg.source?.id).toBe(source.id); expect(seg.receiver?.id).toBe(sink.id);
      const src = logistics.terminal(source.id)!, dst = logistics.terminal(sink.id)!;
      src.addItem('coal', 25); dst.addItem('stone', 800); tick(450);
      expect(seg.state).toBe('BLOCKED'); expect(buildings.demolish(lift.id)).toBe('output not empty');
      expect(src.getItemCount('coal') + dst.getItemCount('coal') + seg.items.length).toBe(25);
      dst.removeItem('stone', 800); tick(900);
      expect(dst.getItemCount('coal')).toBe(25); expect(logistics.network.flowStats(lift.id)!.total).toBe(25);
    }
  });
  it.each([1.1, 2.3, 7.9])('joins fractional %f m lifts directly and transfers items', (height) => {
    const { logistics, place, tick } = setup();
    const source = place('storage-container', 0, 2), a = place(`lift-up-${height}`, 0, 0), b = place(`lift-down-${height}`, 0, -2), sink = place('storage-container', 0, -4);
    logistics.sync(); expect(logistics.network.get(a.id)!.output).toBe(b.id);
    logistics.terminal(source.id)!.addItem('coal', 12); tick(1000);
    expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(12);
    expect(logistics.network.flowStats(a.id)!.total).toBe(12); expect(logistics.network.flowStats(b.id)!.total).toBe(12);
  });
  it('connects fractional lifts through a supported one-cell belt', () => {
    const { logistics, place, tick } = setup();
    const source = place('storage-container', 0, 3); place('conveyor-cell', -.5, 1.5);
    const up = place('lift-up-2.3', 0, 0); place('foundation', 0, -2, 0, 1.9);
    const belt = place('conveyor-cell', -.5, -1.5); expect(belt.transform.y).toBeCloseTo(2.3);
    const belt2 = place('conveyor-cell', -.5, -2.5); const down = place('lift-down-2.3', 0, -4); place('conveyor-cell', -.5, -5.5); const sink = place('receiving-terminal', 0, -7);
    logistics.sync(); expect(logistics.network.get(up.id)!.output).toBe(belt.id); expect(logistics.network.get(belt.id)!.output).toBe(belt2.id); expect(logistics.network.get(belt2.id)!.output).toBe(down.id);
    logistics.terminal(source.id)!.addItem('coal', 12); tick(1000);
    expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(12);
  });
  it.each(['splitter', 'merger'])('connects a fractional lift directly to a raised %s', (type) => {
    const { logistics, place, tick } = setup();
    const source = place('storage-container', 0, 2), lift = place('lift-up-2.3', 0, 0);
    place('foundation', 0, -2, 0, 1.9); const junction = place(type, 0, -2); logistics.sync();
    expect(logistics.network.get(lift.id)!.receiver?.id).toBe(type === 'merger' ? `${junction.id}:input:0` : junction.id);
    logistics.terminal(source.id)!.addItem('coal', 1); tick(200);
    expect(type === 'merger' ? logistics.merger(junction.id)!.pending[0] : logistics.splitter(junction.id)!.pending).toBe('coal');
  });
});
