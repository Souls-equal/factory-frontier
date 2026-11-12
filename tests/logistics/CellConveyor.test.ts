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
  return { buildings, machines, logistics, ground, place };
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
