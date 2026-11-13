import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { ConstructionController } from '../../src/buildings/ConstructionController';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import { splitterPort, mergerPort, machinePort } from '../../src/logistics/ConveyorDefinitions';
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
const angles = [0,1,3];

describe('direct junction-lift ports', () => {
  it.each([0, 1, 2, 3])('connects every splitter output in both placement orders at rotation %i', (r) => {
    for (const index of [0,1,2]) for (const liftFirst of [false,true]) {
      const { buildings, logistics, place, tick } = setup();
      // Generate the expected port from an independently constructed junction fixture.
      const fixture = setup().place('splitter', 0, 0, r), pose = splitterPort(fixture, 1, index);
      const x = pose.position.x + pose.direction.x, z = pose.position.z + pose.direction.z, turn = (r + angles[index]!) % 4;
      let splitter, lift;
      if (liftFirst) { lift = place('lift-up-1', x, z, turn); expect(buildings.validate('splitter', 0, 0, r, far).connection).toBe('connected'); splitter = place('splitter', 0, 0, r); }
      else { splitter = place('splitter', 0, 0, r); expect(buildings.validate('lift-up-1', x, z, turn, far).connection).toBe('connected'); lift = place('lift-up-1', x, z, turn); }
      logistics.sync(); expect(logistics.network.get(lift.id)!.source?.id).toBe(`${splitter.id}:output:${index}`);
      expect(logistics.splitter(splitter.id)!.receiver(machinePort(splitter, 1, 'receiver')).accept('coal')).toBe(true);
      tick(20); expect(logistics.network.get(lift.id)!.items.map((v) => v.itemId)).toEqual(['coal']);
    }
  });
  it.each([0, 1, 2, 3])('connects every merger input in both placement orders at rotation %i', (r) => {
    for (const index of [0,1,2]) for (const liftFirst of [false,true]) {
      const { buildings, logistics, place, tick } = setup();
      const fixture = setup().place('merger', 0, 0, r), pose = mergerPort(fixture, 1, index);
      const x = pose.position.x - pose.direction.x, z = pose.position.z - pose.direction.z, turn = (r + angles[index]!) % 4;
      let merger, lift;
      if (liftFirst) { lift = place('lift-down-1', x, z, turn); expect(buildings.validate('merger', 0, 0, r, far).connection).toBe('connected'); merger = place('merger', 0, 0, r); }
      else { merger = place('merger', 0, 0, r); expect(buildings.validate('lift-down-1', x, z, turn, far).connection).toBe('connected'); lift = place('lift-down-1', x, z, turn); }
      logistics.sync(); expect(logistics.network.get(lift.id)!.receiver?.id).toBe(`${merger.id}:input:${index}`);
      expect(logistics.network.insertDropped('test', 'coal', lift.id)).toBe(true); tick(100);
      expect(logistics.merger(merger.id)!.pending[index]).toBe('coal');
    }
  });
  it.each(['splitter', 'merger'])('connects the remaining %s port and preserves wrong-height disconnection', (type) => {
    const { logistics, place, tick } = setup(); const junction = place(type, 0, 0);
    const lift = type === 'splitter' ? place('lift-down-1', 0, 2) : place('lift-up-1', 0, -2);
    logistics.sync(); const segment = logistics.network.get(lift.id)!;
    if (type === 'splitter') {
      expect(segment.receiver?.id).toBe(junction.id); expect(logistics.network.insertDropped('test', 'coal', lift.id)).toBe(true); tick(100);
      expect(logistics.splitter(junction.id)!.pending).toBe('coal');
    } else {
      expect(segment.source?.id).toBe(junction.id);
      expect(logistics.merger(junction.id)!.receiver(0, mergerPort(junction, 1, 0)).accept('coal')).toBe(true); tick(20);
      expect(segment.items[0]?.itemId).toBe('coal');
    }
  });
  it('does not connect wrong rotation or height', () => {
    const { logistics, place } = setup();
    place('splitter', 0, 0); const wrongDirection = place('lift-up-1', 0, -2, 2), wrongHeight = place('lift-down-1', 2, 0, 3);
    logistics.sync(); expect(logistics.network.get(wrongDirection.id)!.source).toBeNull(); expect(logistics.network.get(wrongHeight.id)!.source).toBeNull();
  });
  it('connects correctly through construction controller preview and placement', () => {
    const { buildings, logistics, place } = setup(); const splitter = place('splitter', 0, 0);
    const controller = new ConstructionController(buildings, terrain); controller.select('lift-up-1');
    const view = { position: { x: 0, y: 3, z: -2 }, yaw: 0, pitch: -Math.PI / 2 };
    expect(controller.preview(view, far)).toMatchObject({ reason: 'valid', connection: 'connected' });
    const lift = controller.confirm(view, far)!.building!; logistics.sync();
    expect(logistics.network.get(lift.id)!.source?.id).toBe(`${splitter.id}:output:0`);
  });
});

it('balances a direct lift and belt branch, with conservation and blocked recovery', () => {
  const { logistics, buildings, place, tick } = setup();
  const supply = place('storage-container', 0, 3); place('conveyor-cell', -.5, 1.5); const junction = place('splitter', 0, 0);
  const lift = place('lift-up-1', 0, -2); place('foundation', 0, -4, 0, .6); const high = place('receiving-terminal', 0, -4);
  place('conveyor-cell', -1.5, -.5, 1); const side = place('receiving-terminal', -3, 0);
  logistics.sync(); const source = logistics.terminal(supply.id)!, a = logistics.terminal(high.id)!, b = logistics.terminal(side.id)!;
  source.addItem('iron-ore', 30); const total = () => source.getItemCount('iron-ore') + a.getItemCount('iron-ore') + b.getItemCount('iron-ore') +
    Number(logistics.splitter(junction.id)!.pending === 'iron-ore') + logistics.network.all().reduce((n,s) => n + s.items.filter((v) => v.itemId === 'iron-ore').length, 0);
  for (let i=0; i<1300; i++) { tick(1); expect(total()).toBe(30); }
  expect(a.getItemCount('iron-ore')).toBe(15); expect(b.getItemCount('iron-ore')).toBe(15);
  expect(logistics.network.flowStats(lift.id)!.total).toBe(15);
  const splitter = logistics.splitter(junction.id)!; splitter.configure('priority', 0); a.addItem('iron-ore', 85); source.addItem('iron-ore', 30);
  tick(700); expect(b.getItemCount('iron-ore')).toBe(15); expect(splitter.pending).toBe('iron-ore');
  expect(buildings.demolish(junction.id)).toBe('output not empty'); splitter.configure('overflow', 0); tick(600);
  expect(b.getItemCount('iron-ore')).toBeGreaterThan(15); a.removeItem('iron-ore', 100); tick(700);
  expect(source.getItemCount('iron-ore') + a.getItemCount('iron-ore') + b.getItemCount('iron-ore') + Number(splitter.pending === 'iron-ore') + logistics.network.all().reduce((n,s) => n + s.items.filter((v) => v.itemId === 'iron-ore').length,0)).toBe(45);
});

it('merges a direct lift input with a belt input and sends the mixed stream through an output lift', () => {
  const { logistics, place, tick } = setup();
  place('foundation', 0, 4, 0, .6); const fromHigh = place('storage-container', 0, 4);
  const inputLift = place('lift-down-1', 0, 2), junction = place('merger', 0, 0);
  const fromSide = place('storage-container', 3, 0, 1); place('conveyor-cell', 1.5, .5, 1);
  const outputLift = place('lift-up-1', 0, -2); place('foundation', 0, -4, 0, .6); const destination = place('storage-container', 0, -4);
  logistics.sync(); expect(logistics.network.get(inputLift.id)!.receiver?.id).toBe(`${junction.id}:input:0`);
  expect(logistics.network.get(outputLift.id)!.source?.id).toBe(junction.id);
  const a = logistics.terminal(fromHigh.id)!, b = logistics.terminal(fromSide.id)!, sink = logistics.terminal(destination.id)!;
  a.addItem('coal', 20); b.addItem('iron-ore', 20); sink.addItem('stone', 800); tick(600);
  expect(logistics.merger(junction.id)!.occupied).toBe(true); expect(sink.getItemCount('coal')).toBe(0);
  const total = (id: string) => a.getItemCount(id) + b.getItemCount(id) + sink.getItemCount(id) + logistics.merger(junction.id)!.pending.filter((v) => v === id).length +
    logistics.network.all().reduce((n,s) => n + s.items.filter((v) => v.itemId === id).length, 0);
  expect(total('coal')).toBe(20); expect(total('iron-ore')).toBe(20);
  sink.removeItem('stone', 800); tick(500); expect(sink.getItemCount('coal')).toBeGreaterThan(2); expect(sink.getItemCount('iron-ore')).toBeGreaterThan(2);
  tick(1400); expect(sink.getItemCount('coal')).toBe(20); expect(sink.getItemCount('iron-ore')).toBe(20);
  expect(total('coal')).toBe(20); expect(total('iron-ore')).toBe(20);
});

it.each(['splitter', 'merger'])('feeds a high supported %s input directly from an 8m lift', (type) => {
  const { logistics, buildings, place, tick } = setup();
  const source = place('storage-container', 0, 2), lift = place('lift-up-8', 0, 0);
  place('foundation', 0, -2, 0, 7.6);
  const preview = buildings.validate(type, 0, -2, 0, far); expect(preview.connection).toBe('connected');
  const junction = place(type, 0, -2); logistics.sync();
  expect(logistics.network.get(lift.id)!.receiver?.id).toBe(type === 'merger' ? `${junction.id}:input:0` : junction.id);
  logistics.terminal(source.id)!.addItem('coal', 2); tick(400);
  expect(type === 'splitter' ? logistics.splitter(junction.id)!.pending : logistics.merger(junction.id)!.pending[0]).toBe('coal');
  expect(logistics.network.get(lift.id)!.items).toHaveLength(1);
});

it.each(['splitter', 'merger'])('feeds an 8m downward lift from a supported %s output', (type) => {
  const { logistics, buildings, place, tick } = setup();
  place('lift-down-8', 0, 0); place('foundation', 0, 2, 0, 7.6);
  const preview = buildings.validate(type, 0, 2, 0, far); expect(preview.connection).toBe('connected');
  const junction = place(type, 0, 2), sink = place('receiving-terminal', 0, -2); logistics.sync();
  const source = type === 'splitter' ? logistics.splitter(junction.id)!.receiver(machinePort(junction, 1, 'receiver')) : logistics.merger(junction.id)!.receiver(0, mergerPort(junction, 1, 0));
  expect(source.accept('coal')).toBe(true); tick(350); expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(1);
});

it.each(['splitter', 'merger'])('does not allow an occupied direct %s port to gain a competing belt', (type) => {
  const { buildings, place } = setup();
  place(type, 0, 0); place(type === 'splitter' ? 'lift-up-1' : 'lift-down-1', 0, type === 'splitter' ? -2 : 2);
  const result = buildings.validate('conveyor-cell', -.5, type === 'splitter' ? -1.5 : 1.5, 0, far);
  expect(result.reason).not.toBe('valid');
});

it('balances three simultaneous direct lift outputs without confusing port identities', () => {
  const { logistics, place, tick } = setup();
  const supply = place('storage-container', 0, 3); place('conveyor-cell', -.5, 1.5); const junction = place('splitter', 0, 0);
  const specs = [[0,-2,0,0,-4],[-2,0,1,-4,0],[2,0,3,4,0]] as const;
  const lifts = specs.map(([x,z,r]) => place('lift-up-1', x,z,r));
  const sinks = specs.map(([, , ,x,z]) => { place('foundation',x,z,0,.6); return place('receiving-terminal',x,z); });
  logistics.sync(); lifts.forEach((lift,i) => expect(logistics.network.get(lift.id)!.source?.id).toBe(`${junction.id}:output:${i}`));
  logistics.terminal(supply.id)!.addItem('iron-ore', 30); tick(1400);
  expect(sinks.map((sink) => logistics.terminal(sink.id)!.getItemCount('iron-ore'))).toEqual([10,10,10]);
  expect(logistics.network.all().reduce((n,s) => n + s.items.length, 0)).toBe(0);
});

it('fairly combines three simultaneous direct lift inputs with independent buffers', () => {
  const { logistics, place, tick } = setup(); const junction = place('merger', 0, 0);
  const specs = [[0,2,0,0,4],[2,0,1,4,0],[-2,0,3,-4,0]] as const;
  const lifts = specs.map(([x,z,r]) => place('lift-down-1',x,z,r));
  const sources = specs.map(([, , r,x,z]) => { place('foundation',x,z,0,.6); return place('storage-container',x,z,r); });
  place('conveyor-cell', -.5, -1.5); const sink = place('storage-container', 0, -3); logistics.sync();
  lifts.forEach((lift,i) => expect(logistics.network.get(lift.id)!.receiver?.id).toBe(`${junction.id}:input:${i}`));
  const ids = ['coal','iron-ore','wood']; sources.forEach((source,i) => logistics.terminal(source.id)!.addItem(ids[i]!, 15));
  tick(500); ids.forEach((id) => expect(logistics.terminal(sink.id)!.getItemCount(id)).toBeGreaterThan(2));
  tick(1400); ids.forEach((id) => expect(logistics.terminal(sink.id)!.getItemCount(id)).toBe(15));
  expect(logistics.network.all().reduce((n,s) => n + s.items.length, 0)).toBe(0); expect(logistics.merger(junction.id)!.occupied).toBe(false);
});
