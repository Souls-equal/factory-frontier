import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { ConstructionController } from '../../src/buildings/ConstructionController';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { GroundItems } from '../../src/logistics/GroundItems';
import { MachineManager } from '../../src/machines/MachineManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({x,z}),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const far = { x: 20, z: 20, radius: .4 };
const deposit: ResourceDeposit = { id: 'ore', itemId: 'iron-ore', x: 0, y: 0, z: 2, radius: .8, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
function setup(deposits: ResourceDeposit[] = []) {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 12);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29, deposits); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => deposits), logistics = new LogisticsManager(buildings, machines, items);
  const place = (type: string, x: number, z: number, r = 0, offset?: number) => {
    const result = buildings.place(type, x, z, r, far, offset); expect(result.reason).toBe('valid'); return result.building!;
  };
  const tick = (n: number) => { for (let i = 0; i < n; i++) logistics.fixedUpdate(50); };
  return { items, buildings, machines, logistics, place, tick };
}
const rotated = (z: number, r: number) => ({ x: Math.round(z * Math.sin(r * Math.PI / 2)), z: Math.round(z * Math.cos(r * Math.PI / 2)) });

describe('direct machine to lift connections', () => {
  it.each([0,1,2,3])('connects both ports in either placement order, up and down, rotation %i', (r) => {
    for (const direction of ['up', 'down'] as const) for (const liftFirst of [false, true]) {
      const { buildings, logistics, place, tick } = setup();
      const sourcePoint = rotated(2, r), sinkPoint = rotated(-2, r), high = direction === 'up' ? sinkPoint : sourcePoint;
      place('foundation', high.x, high.z, 0, .6);
      let lift, source, sink;
      if (liftFirst) {
        lift = place(`lift-${direction}-1`, 0, 0, r);
        const preview = buildings.validate('storage-container', sourcePoint.x, sourcePoint.z, r, far); expect(preview.connection).toBe('connected');
        source = place('storage-container', sourcePoint.x, sourcePoint.z, r);
        expect(buildings.validate('storage-container', sinkPoint.x, sinkPoint.z, r, far).connection).toBe('connected');
        sink = place('storage-container', sinkPoint.x, sinkPoint.z, r);
      } else {
        source = place('storage-container', sourcePoint.x, sourcePoint.z, r); sink = place('storage-container', sinkPoint.x, sinkPoint.z, r);
        expect(buildings.validate(`lift-${direction}-1`, 0, 0, r, far).connection).toBe('connected');
        lift = place(`lift-${direction}-1`, 0, 0, r);
      }
      logistics.sync(); const segment = logistics.network.get(lift.id)!;
      expect(segment.source?.id).toBe(source.id); expect(segment.receiver?.id).toBe(sink.id);
      expect(segment.path.point(0).y).toBeCloseTo(source.transform.y + .5);
      expect(segment.path.point(segment.path.length).y).toBeCloseTo(sink.transform.y + .5);
      const from = logistics.terminal(source.id)!, to = logistics.terminal(sink.id)!;
      from.addItem('iron-ore', 12); from.addItem('coal', 5); logistics.setStorageOutputFilter(source.id, 'coal');
      for (let n = 0; n < 500; n++) {
        tick(1); expect(from.getItemCount('coal') + to.getItemCount('coal') + segment.items.filter((v) => v.itemId === 'coal').length).toBe(5);
      }
      expect(to.getItemCount('coal')).toBe(5); expect(from.getItemCount('iron-ore')).toBe(12);
      expect(logistics.network.flowStats(lift.id)!.total).toBe(5);
    }
  });
  it('holds safely at a full direct receiver, resumes, and protects occupied lifts', () => {
    const { logistics, buildings, place, tick } = setup();
    const source = place('storage-container', 0, 2), lift = place('lift-up-1', 0, 0);
    place('foundation', 0, -2, 0, .6); const sink = place('storage-container', 0, -2); logistics.sync();
    const from = logistics.terminal(source.id)!, to = logistics.terminal(sink.id)!; from.addItem('coal', 15); to.addItem('stone', 800);
    tick(500); const segment = logistics.network.get(lift.id)!; expect(segment.state).toBe('BLOCKED');
    expect(buildings.demolish(lift.id)).toBe('output not empty'); expect(to.getItemCount('coal')).toBe(0);
    expect(from.getItemCount('coal') + segment.items.length).toBe(15);
    to.removeItem('stone', 800); tick(800); expect(to.getItemCount('coal')).toBe(15); expect(segment.items.length).toBe(0);
  });
  it('does not connect misaligned direction, height or unimplemented junction ports', () => {
    const { logistics, buildings, place } = setup();
    const lift = place('lift-up-1', 0, 0), wrong = place('storage-container', 0, 2, 2), low = place('storage-container', 0, -2, 0);
    logistics.sync(); expect(logistics.network.get(lift.id)!.source).toBeNull(); expect(logistics.network.get(lift.id)!.receiver).toBeNull();
    expect(logistics.network.isOutputBlocked(lift.id)).toBe(true); expect(wrong.transform.y).toBe(0); expect(low.transform.y).toBe(0);
    expect(buildings.demolish(wrong.id)).toBe('removed'); place('splitter', 0, 2); logistics.sync();
    expect(logistics.network.get(lift.id)!.source).toBeNull();
  });
  it('connects a miner directly and respects enabled state', () => {
    const { machines, logistics, place, tick } = setup([deposit]);
    const miner = place('miner-mk1', 0, 2), lift = place('lift-up-1', 0, 0); logistics.sync();
    expect(logistics.network.get(lift.id)!.source?.id).toBe(miner.id);
    const m = machines.get(miner.id)!; m.output.addItem('iron-ore', 2); m.setEnabled(false); tick(100);
    expect(m.output.getItemCount('iron-ore')).toBe(2); m.setEnabled(true); tick(100);
    expect(m.output.getItemCount('iron-ore')).toBe(0); expect(logistics.network.get(lift.id)!.items.length).toBe(2);
  });
  it.each(['smelter', 'constructor'])('connects %s output directly into a lift', (type) => {
    const { machines, logistics, place, tick } = setup();
    const source = place(type, 0, 2), lift = place('lift-up-1', 0, 0); logistics.sync();
    const machine = machines.smelter(source.id) ?? machines.constructorMachine(source.id)!;
    machine.output.addItem(machine.recipe.output.itemId, 3); machine.setEnabled(false); tick(100);
    expect(machine.output.getItemCount(machine.recipe.output.itemId)).toBe(3);
    machine.setEnabled(true); tick(100); expect(machine.output.getItemCount(machine.recipe.output.itemId)).toBe(0);
    expect(logistics.network.get(lift.id)!.items.length).toBe(3);
  });
  it.each(['smelter', 'constructor'])('delivers accepted items directly to a %s input', (type) => {
    const { machines, logistics, place, tick } = setup();
    const source = place('storage-container', 0, 2), lift = place('lift-up-1', 0, 0);
    place('foundation', 0, -2, 0, .6); const sink = place(type, 0, -2); logistics.sync();
    const machine = machines.smelter(sink.id) ?? machines.constructorMachine(sink.id)!;
    const item = machine.recipe.input.itemId; logistics.terminal(source.id)!.addItem(item, 4); tick(300);
    expect(machine.input.getItemCount(item)).toBe(4); expect(logistics.network.get(lift.id)!.receiver?.id).toBe(sink.id);
  });
  it('connects the direct lift output to any receiving terminal face', () => {
    const { logistics, place, tick } = setup();
    const source = place('storage-container', 0, 2), lift = place('lift-up-1', 0, 0);
    place('foundation', 0, -2, 0, .6); const sink = place('receiving-terminal', 0, -2, 2); logistics.sync();
    logistics.terminal(source.id)!.addItem('coal', 2); tick(250);
    expect(logistics.network.get(lift.id)!.receiver?.id).toBe(sink.id); expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(2);
  });
});


it('connects a late receiver to an occupied 8m lift without losing its items', () => {
  const { logistics, place, tick } = setup();
  const source = place('storage-container', 0, 2), lift = place('lift-up-8', 0, 0); logistics.sync();
  logistics.terminal(source.id)!.addItem('iron-ore', 6); tick(500);
  const segment = logistics.network.get(lift.id)!; expect(segment.state).toBe('BLOCKED'); expect(segment.items.length).toBe(6);
  place('foundation', 0, -2, 0, 7.6); const sink = place('receiving-terminal', 0, -2); logistics.sync();
  expect(segment.receiver?.id).toBe(sink.id); expect(logistics.network.isOutputBlocked(lift.id)).toBe(false);
  tick(500); expect(logistics.terminal(sink.id)!.getItemCount('iron-ore')).toBe(6); expect(segment.items.length).toBe(0);
});

it('places directly connected structures with the actual construction controller', () => {
  const { buildings, logistics, tick, place } = setup();
  const controller = new ConstructionController(buildings, terrain);
  const view = (z: number, y = 3) => ({ position: { x: 0, y, z }, yaw: 0, pitch: -Math.PI / 2 });
  controller.select('storage-container'); const source = controller.confirm(view(2), far)!.building!;
  controller.select('lift-up-1'); const preview = controller.preview(view(0), far)!;
  expect(preview.reason).toBe('valid'); expect(preview.connection).toBe('connected');
  const lift = controller.confirm(view(0), far)!.building!;
  place('foundation', 0, -2, 0, .6);
  controller.select('storage-container'); const sinkPreview = controller.preview(view(-2), far)!;
  expect(sinkPreview.reason).toBe('valid'); expect(sinkPreview.connection).toBe('connected');
  const sink = controller.confirm(view(-2), far)!.building!; logistics.sync();
  logistics.terminal(source.id)!.addItem('coal', 2); tick(200);
  expect(logistics.network.get(lift.id)!.source?.id).toBe(source.id); expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(2);
});


it('does not spill a blocked direct lift and recovers from an incompatible processor input', () => {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10), ground = new GroundItems(() => 0);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items, () => false, 1, undefined, ground);
  const place = (type: string, z: number, offset?: number) => {
    const result = buildings.place(type, 0, z, 0, far, offset); expect(result.reason).toBe('valid'); return result.building!;
  };
  const source = place('storage-container', 2), lift = place('lift-up-1', 0);
  place('foundation', -2, .6); const sink = place('constructor', -2); logistics.sync();
  logistics.terminal(source.id)!.addItem('coal', 2); for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
  const segment = logistics.network.get(lift.id)!; expect(segment.state).toBe('BLOCKED'); expect(segment.items.length).toBe(2);
  expect(ground.all()).toHaveLength(0); expect(machines.constructorMachine(sink.id)!.input.usedSlots).toBe(0);
  const player = new Inventory(items, 3); for (const item of [...segment.items]) expect(logistics.network.pickup(item.id, player)).toBe(true);
  expect(player.getItemCount('coal')).toBe(2);
  logistics.terminal(source.id)!.addItem('iron-ingot', 2); for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
  expect(machines.constructorMachine(sink.id)!.input.getItemCount('iron-ingot')).toBe(2); expect(ground.all()).toHaveLength(0);
});
