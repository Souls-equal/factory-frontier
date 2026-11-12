import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { ConstructionController } from '../../src/buildings/ConstructionController';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { GroundItems } from '../../src/logistics/GroundItems';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x, z) => ({ x, z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const deposit: ResourceDeposit = { id: 'iron', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
const player = { x: 20, z: 20, radius: .3 };
function setup() {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 20);
  inventory.addItem('stone', 100); inventory.addItem('wood', 100);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 29, [deposit]);
  const machines = new MachineManager(buildings, items, () => [deposit]);
  const ground = new GroundItems(() => 0);
  const logistics = new LogisticsManager(buildings, machines, items, () => false, 1, undefined, ground);
  const place = (type: string, x: number, z: number, r = 0) => {
    const result = buildings.place(type, x, z, r, player); expect(result.reason).toBe('valid'); return result.building!;
  };
  return { buildings, machines, logistics, ground, place, items };
}

describe('one-cell conveyor routing', () => {
  it('fits one grid square and follows the camera for preview and placement', () => {
    const { buildings } = setup(); const controller = new ConstructionController(buildings, terrain, 10); controller.select('conveyor-cell');
    for (let r = 0; r < 4; r++) {
      const yaw = r * Math.PI / 2, view = { position: { x: 0, y: 2, z: 0 }, yaw, pitch: -Math.PI / 3 };
      const preview = controller.preview(view, player)!;
      expect(preview.reason).toBe('valid'); expect(preview.transform.rotation).toBe(r);
      expect(preview.transform.footprint.maxX - preview.transform.footprint.minX).toBe(1);
      expect(preview.transform.footprint.maxZ - preview.transform.footprint.minZ).toBe(1);
      expect(controller.confirm(view, player)!.transform).toEqual(preview.transform);
    }
  });
  it.each([0, 1, 2, 3])('transfers into a directly adjacent belt facing quarter-turn %i', (rotation) => {
    const { place, machines, logistics, ground } = setup();
    const miner = place('miner-mk1', 0, 0), a = place('conveyor-cell', .5, -1.5, 0), b = place('conveyor-cell', .5, -2.5, rotation);
    logistics.sync(); expect(logistics.network.get(a.id)!.source?.id).toBe(miner.id); expect(logistics.network.get(a.id)!.output).toBe(b.id);
    machines.get(miner.id)!.output.addItem('iron-ore', 3);
    let seenB = false;
    for (let i = 0; i < 250; i++) { logistics.fixedUpdate(50); seenB ||= logistics.network.get(b.id)!.items.length > 0; }
    expect(seenB).toBe(true);
    if (rotation === 2) {
      expect(logistics.network.get(b.id)!.output).toBe(a.id);
      expect(ground.all()).toHaveLength(0);
      expect(logistics.network.all().reduce((n, s) => n + s.items.length, 0) + machines.get(miner.id)!.output.getItemCount('iron-ore')).toBe(3);
    } else {
      expect(ground.all()).toHaveLength(3);
      expect(ground.all().every((item) => item.itemId === 'iron-ore')).toBe(true);
    }
  });
  it('routes a source through left and right turns to a machine and blocks rather than dropping into a full receiver', () => {
    const { place, machines, logistics, ground } = setup();
    const miner = place('miner-mk1', 0, 0);
    const a = place('conveyor-cell', .5, -1.5, 0), b = place('conveyor-cell', .5, -2.5, 3), c = place('conveyor-cell', 1.5, -2.5, 0);
    const terminal = place('receiving-terminal', 2, -4, 0); logistics.sync();
    expect(logistics.network.get(a.id)!.output).toBe(b.id); expect(logistics.network.get(b.id)!.output).toBe(c.id);
    expect(logistics.network.get(c.id)!.receiver?.id).toBe(terminal.id);
    const source = machines.get(miner.id)!.output, sink = logistics.terminal(terminal.id)!; source.addItem('iron-ore', 8);
    for (let i = 0; i < 400; i++) logistics.fixedUpdate(50);
    expect(sink.getItemCount('iron-ore')).toBe(8); expect(ground.all()).toHaveLength(0);
    sink.addItem('iron-ore', 92); source.addItem('iron-ore', 4);
    for (let i = 0; i < 200; i++) logistics.fixedUpdate(50);
    expect(logistics.network.get(c.id)!.state).toBe('BLOCKED'); expect(ground.all()).toHaveLength(0);
    sink.removeItem('iron-ore', 4); for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
    expect(sink.getItemCount('iron-ore')).toBe(100); expect(source.getItemCount('iron-ore')).toBe(0);
    expect(logistics.network.all().reduce((n, s) => n + s.items.length, 0)).toBe(0);
  });
});

it.each([0, 1, 2, 3])('connects each Miner port to either one-cell lane at rotation %i', (r) => {
  for (const lane of [-.5, .5]) {
    const { place, machines, logistics, ground } = setup();
    const miner = place('miner-mk1', 0, 0, r);
    const directions = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }];
    const d = directions[r]!;
    const belt = place('conveyor-cell', miner.transform.x + 1.5 * d.x + lane * d.z, miner.transform.z + 1.5 * d.z - lane * d.x, r);
    logistics.sync(); expect(logistics.network.get(belt.id)!.source?.id).toBe(miner.id);
    machines.get(miner.id)!.output.addItem('iron-ore', 1);
    for (let i = 0; i < 80; i++) logistics.fixedUpdate(50);
    expect(ground.all()).toHaveLength(1);
  }
});

it('arbitrates two incoming belts and conserves all items with a blocked target then releases them', async () => {
  const { ConveyorNetwork } = await import('../../src/logistics/ConveyorNetwork');
  const { ConveyorPath } = await import('../../src/logistics/ConveyorPath');
  const { InventorySource, InventoryReceiver } = await import('../../src/logistics/Ports');
  const items = createDefaultItemRegistry(), inv1 = new Inventory(items, 1), inv2 = new Inventory(items, 1), sink = new Inventory(items, 1);
  inv1.addItem('iron-ore', 5); inv2.addItem('iron-ore', 5); sink.addItem('wood', 100);
  const net = new ConveyorNetwork(); const settings = { speed: 1, spacing: .5, throughputPerMinute: 60 };
  const p = (x: number) => new ConveyorPath({ shape: 'straight', x, y: 0, z: 0, rotation: 0, size: 1 });
  for (const [id, x] of [['a', 0], ['b', 1], ['c', 2]] as const) net.addCell(id, p(x), settings);
  net.connectCell('a', 'c', .5); net.connectCell('b', 'c', .5);
  net.attachCellSource('a', new InventorySource('sa', { position: p(0).point(0), direction: p(0).direction('input') }, inv1, 'iron-ore'), 0);
  net.attachCellSource('b', new InventorySource('sb', { position: p(1).point(0), direction: p(1).direction('input') }, inv2, 'iron-ore'), 0);
  net.attachCellReceiver('c', new InventoryReceiver('sink', { position: p(2).point(1), direction: p(2).direction('output') }, sink));
  const total = () => inv1.getItemCount('iron-ore') + inv2.getItemCount('iron-ore') + sink.getItemCount('iron-ore') + net.all().reduce((n, s) => n + s.items.length, 0);
  for (let i = 0; i < 150; i++) { net.fixedUpdate(50); expect(total()).toBe(10); }
  expect(net.get('c')!.state).toBe('BLOCKED'); sink.removeItem('wood', 100);
  for (let i = 0; i < 800; i++) { net.fixedUpdate(50); expect(total()).toBe(10); }
  expect(sink.getItemCount('iron-ore')).toBe(10);
});

it('keeps the rendered conveyor geometry inside its single cell at every rotation', async () => {
  const { BuildingView } = await import('../../src/engine/BuildingView');
  const { Box3 } = await import('three');
  const { buildings, place } = setup(); const view = new BuildingView(buildings.registry, 1);
  for (let r = 0; r < 4; r++) {
    const b = place('conveyor-cell', r * 3 + .5, .5, r); view.sync(buildings.all()); view.group.updateMatrixWorld(true);
    const box = new Box3().setFromObject(view.group.getObjectByName(b.id)!);
    expect(box.min.x).toBeGreaterThanOrEqual(b.transform.footprint.minX - 1e-7);
    expect(box.max.x).toBeLessThanOrEqual(b.transform.footprint.maxX + 1e-7);
    expect(box.min.z).toBeGreaterThanOrEqual(b.transform.footprint.minZ - 1e-7);
    expect(box.max.z).toBeLessThanOrEqual(b.transform.footprint.maxZ + 1e-7);
  }
  view.dispose();
});

it('connects a one-cell belt to the generated starting deposit and drops real mined ore', async () => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { createWorld } = await import('../../src/world/World');
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
  inventory.addItem('stone', 100); inventory.addItem('wood', 100);
  const config = createGameConfig(), world = createWorld(config, inventory), deposit = world.deposits.find((d) => d.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far).building!; expect(miner).toBeDefined();
  const possibilities = [-.5, .5].map((lane) => world.buildings.validate('conveyor-cell', miner.transform.x + lane, miner.transform.z - 1.5, 0, far));
  const candidate = possibilities.find((result) => result.reason === 'valid'); expect(candidate).toBeDefined();
  const placed = world.buildings.place('conveyor-cell', candidate!.transform.x, candidate!.transform.z, 0, far); expect(placed.reason).toBe('valid');
  const ground = new GroundItems((x, z) => world.terrain.heightAt(x, z));
  const machines = new MachineManager(world.buildings, items, () => world.deposits, config.miner);
  const logistics = new LogisticsManager(world.buildings, machines, items, () => false, 1, undefined, ground);
  logistics.sync(); expect(logistics.network.get(placed.building!.id)!.source?.id).toBe(miner.id);
  for (let i = 0; i < 200; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
  expect(ground.all().length).toBeGreaterThan(0);
});

it('preserves moving items when a perpendicular neighbour is built after production starts', () => {
  const { place, machines, logistics, ground } = setup();
  const miner = place('miner-mk1', 0, 0), a = place('conveyor-cell', .5, -1.5, 0); logistics.sync();
  const source = machines.get(miner.id)!.output; source.addItem('iron-ore', 5);
  for (let i = 0; i < 20; i++) logistics.fixedUpdate(50);
  expect(logistics.network.get(a.id)!.items.length).toBeGreaterThan(0);
  const b = place('conveyor-cell', .5, -2.5, 3); logistics.sync();
  expect(logistics.network.get(a.id)!.output).toBe(b.id);
  for (let i = 0; i < 300; i++) {
    logistics.fixedUpdate(50);
    expect(source.getItemCount('iron-ore') + logistics.network.all().reduce((n, s) => n + s.items.length, 0) + ground.all().length).toBe(5);
  }
  expect(ground.all()).toHaveLength(5);
});

it.each([0, 1, 2, 3].flatMap((side) => [0, 1, 2, 3].flatMap((orientation) => [-.5, .5].flatMap((lane) => [true, false].map((terminalFirst) => [side, orientation, lane, terminalFirst] as const)))))
('terminal accepts from side %i with terminal rotation %i lane %s first %s', async (side, orientation, lane, terminalFirst) => {
  const { InventorySource } = await import('../../src/logistics/Ports');
  const { place, logistics, items, ground } = setup();
  const dirs = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }], d = dirs[side]!;
  const bx = -1.5 * d.x + lane * d.z, bz = -1.5 * d.z - lane * d.x;
  let terminal, belt;
  if (terminalFirst) { terminal = place('receiving-terminal', 0, 0, orientation); belt = place('conveyor-cell', bx, bz, side); }
  else { belt = place('conveyor-cell', bx, bz, side); terminal = place('receiving-terminal', 0, 0, orientation); }
  logistics.sync(); const segment = logistics.network.get(belt.id)!;
  expect(segment.receiver?.id).toBe(terminal.id);
  const source = new Inventory(items, 1); source.addItem('iron-ore', 1);
  logistics.network.attachCellSource(belt.id, new InventorySource('test-source', { position: segment.path.point(0), direction: segment.path.direction('input') }, source, 'iron-ore'), 0);
  for (let i = 0; i < 50; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(1);
  expect(ground.all()).toHaveLength(0);
});

it('picks up the authoritative moving item once, and keeps it if inventory is full', () => {
  const { place, machines, logistics, items } = setup();
  const miner = place('miner-mk1', 0, 0), a = place('conveyor-cell', .5, -1.5, 0), b = place('conveyor-cell', .5, -2.5, 3);
  logistics.sync(); machines.get(miner.id)!.output.addItem('iron-ore', 1);
  for (let i = 0; i < 30 && !logistics.network.get(b.id)!.items.length; i++) logistics.fixedUpdate(50);
  const item = logistics.network.get(b.id)!.items[0]!;
  expect(item).toBeDefined();
  const before = logistics.network.findItem(item.id)!.position;
  logistics.fixedUpdate(50); expect(logistics.network.findItem(item.id)!.position).not.toEqual(before);
  const inventory = new Inventory(items, 1); inventory.addItem('stone', 100);
  expect(logistics.network.pickup(item.id, inventory)).toBe(false);
  expect(logistics.network.findItem(item.id)).toBeDefined();
  inventory.removeItem('stone', 100);
  expect(logistics.network.pickup(item.id, inventory)).toBe(true);
  expect(inventory.getItemCount('iron-ore')).toBe(1);
  expect(logistics.network.findItem(item.id)).toBeUndefined();
  expect(logistics.network.pickup(item.id, inventory)).toBe(false);
  expect(logistics.network.get(a.id)!.items).toHaveLength(0);
});

it.each([1, 3])('shows a turn guide and opens the incoming rail for rotation %i', async (rotation) => {
  const { BuildingView } = await import('../../src/engine/BuildingView');
  const { place, buildings } = setup();
  const a = place('conveyor-cell', .5, .5, 0), b = place('conveyor-cell', .5, -.5, rotation);
  const view = new BuildingView(buildings.registry, 1); view.sync(buildings.all());
  const tile = view.group.getObjectByName(b.id)!;
  let guides = 0, rails = 0;
  tile.traverse((o) => { if (o.name === 'conveyor-turn-guide') guides++; if (o.name === 'conveyor-rail') rails++; });
  expect(guides).toBe(10); expect(rails).toBe(1);
  const straight = view.group.getObjectByName(a.id)!;
  expect(straight.getObjectByName('conveyor-turn-guide')).toBeUndefined(); view.dispose();
});

it('collects items covered by a newly placed terminal without losing full or incompatible leftovers', () => {
  const { place, ground, logistics } = setup();
  for (let i = 0; i < 102; i++) ground.drop(`ore-${i}`, 'iron-ore', { x: .2, y: .15, z: .2 });
  ground.drop('coal', 'coal', { x: .2, y: .15, z: .2 });
  ground.drop('outside', 'stone', { x: 2, y: .15, z: 0 });
  ground.drop('above', 'stone', { x: 0, y: 5, z: 0 });
  const terminal = place('receiving-terminal', 0, 0); logistics.fixedUpdate(50);
  const inv = logistics.terminal(terminal.id)!;
  expect(inv.getItemCount('iron-ore')).toBe(100);
  expect(ground.all().map((i) => i.id)).toEqual(['ore-100', 'ore-101', 'coal', 'outside', 'above']);
  inv.removeItem('iron-ore', 2); logistics.fixedUpdate(50);
  expect(inv.getItemCount('iron-ore')).toBe(100);
  expect(ground.get('coal')).toBeDefined(); expect(ground.get('outside')).toBeDefined();
});

it.each([0, 1, 2, 3])('captures a pile on a newly placed conveyor and prioritizes it over upstream, rotation %i', (rotation) => {
  const { place, ground, logistics } = setup();
  const d = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
  const a = place('conveyor-cell', .5, .5, rotation); logistics.sync();
  expect(logistics.network.insertDropped('upstream', 'coal', a.id)).toBe(true);
  for (let i = 0; i < 100; i++) { logistics.fixedUpdate(50); if (ground.get('upstream')) break; }
  expect(ground.get('upstream')).toBeDefined();
  for (let i = 0; i < 4; i++) ground.drop(`pile-${i}`, 'iron-ore', { x: .5 + d.x, y: .15, z: .5 + d.z });
  const b = place('conveyor-cell', .5 + d.x, .5 + d.z, rotation);
  logistics.fixedUpdate(50);
  expect(logistics.network.findItem('upstream')).toBeDefined();
  expect(logistics.network.findItem('upstream')!.item.itemId).toBe('coal');
  let groundPriority = 4, held = false;
  for (let i = 0; i < 400; i++) {
    logistics.fixedUpdate(50);
    const remaining = ground.all().filter((item) => item.id.startsWith('pile-') && Math.hypot(item.position.x - b.transform.x, item.position.z - b.transform.z) < .1).length;
    if (remaining > 0) {
      groundPriority = remaining;
      // Incoming new source items do not consume the target's insertion opportunity.
      held = true;
    }
    if (remaining === 0) break;
  }
  expect(held).toBe(true); expect(groundPriority).toBeGreaterThan(0);
  expect(ground.all().filter((item) => item.id.startsWith('pile-') && Math.hypot(item.position.x - b.transform.x, item.position.z - b.transform.z) < .1)).toHaveLength(0);
  const ids = [...ground.all().map((i) => i.id), ...logistics.network.all().flatMap((s) => s.items.map((i) => i.id))];
  expect(new Set(ids).size).toBe(5); expect(ids.length).toBe(5);
});

it('leaves drops in place while paused and respects unrelated height layers', () => {
  const items = createDefaultItemRegistry(), bag = new Inventory(items, 4); bag.addItem('stone', 20); bag.addItem('wood', 20);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), bag, terrain, [], 1, 29, [deposit]);
  const ground = new GroundItems(() => 0), machines = new MachineManager(buildings, items, () => [deposit]); let paused = true;
  const logistics = new LogisticsManager(buildings, machines, items, () => paused, 1, undefined, ground);
  const foundation = buildings.place('foundation', 2, 2, 0, player); expect(foundation.reason).toBe('valid');
  const belt = buildings.place('conveyor-cell', 2.5, 2.5, 0, player); expect(belt.reason).toBe('valid');
  ground.drop('under', 'iron-ore', { x: 2.5, y: .15, z: 2.5 });
  ground.drop('on', 'stone', { x: 2.5, y: belt.transform.y + .15, z: 2.5 });
  logistics.fixedUpdate(50); expect(ground.all()).toHaveLength(2);
  paused = false; logistics.fixedUpdate(0); expect(ground.all()).toHaveLength(2);
  logistics.fixedUpdate(50); expect(ground.get('under')).toBeDefined(); expect(ground.get('on')).toBeUndefined();
  expect(logistics.network.findItem('on')).toBeDefined();
});

it('serves covered drops before live upstream input, then resumes the line', async () => {
  const { InventorySource } = await import('../../src/logistics/Ports');
  const { place, logistics, ground, items } = setup();
  const a = place('conveyor-cell', .5, 1.5, 0), b = place('conveyor-cell', .5, .5, 0);
  logistics.sync(); const source = new Inventory(items, 1); source.addItem('coal', 5);
  const path = logistics.network.get(a.id)!.path;
  logistics.network.attachCellSource(a.id, new InventorySource('source', { position: path.point(0), direction: path.direction('input') }, source, 'coal'), 0);
  for (let i = 0; i < 5; i++) ground.drop(`covered-${i}`, 'iron-ore', { x: .5, y: .15, z: .5 });
  let sawWaitingUpstream = false;
  for (let i = 0; i < 180; i++) {
    const pending = ground.all().some((item) => item.id.startsWith('covered-') && item.position.z === .5);
    logistics.fixedUpdate(50);
    if (pending) {
      expect(logistics.network.get(b.id)!.items.every((item) => item.itemId === 'iron-ore')).toBe(true);
      sawWaitingUpstream ||= logistics.network.get(a.id)!.state === 'BLOCKED';
    }
  }
  expect(sawWaitingUpstream).toBe(true);
  expect(ground.all().filter((item) => item.id.startsWith('covered-') && item.position.z === .5)).toHaveLength(0);
  expect(ground.all().some((item) => item.itemId === 'coal')).toBe(true);
  const count = source.getItemCount('coal') + ground.all().length + logistics.network.all().reduce((n, s) => n + s.items.length, 0);
  expect(count).toBe(10);
});

it('keeps unaccepted drops visible above a full terminal until space becomes available', async () => {
  const { BuildingTerrain } = await import('../../src/buildings/BuildingTerrain');
  const items = createDefaultItemRegistry(), bag = new Inventory(items, 5); bag.addItem('stone', 20); bag.addItem('wood', 20);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), bag, terrain, [], 1, 29);
  const surface = new BuildingTerrain(terrain, buildings);
  const ground = new GroundItems((x, z, y) => surface.groundBelow(x, z, y, 0));
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items, () => false, 1, undefined, ground);
  ground.drop('ore', 'iron-ore', { x: 0, y: .15, z: 0 }); ground.drop('coal', 'coal', { x: .2, y: .15, z: .2 });
  const placed = buildings.place('receiving-terminal', 0, 0, 0, player); expect(placed.reason).toBe('valid');
  for (let i = 0; i < 100; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(placed.building!.id)!.getItemCount('iron-ore')).toBe(1);
  expect(ground.get('coal')!.position.y).toBeGreaterThanOrEqual(placed.transform.y + 1.2 + .15 - 1e-6);
  logistics.terminal(placed.building!.id)!.removeItem('iron-ore', 1);
  logistics.fixedUpdate(50); expect(ground.get('coal')).toBeUndefined();
  expect(logistics.terminal(placed.building!.id)!.getItemCount('coal')).toBe(1);
});
