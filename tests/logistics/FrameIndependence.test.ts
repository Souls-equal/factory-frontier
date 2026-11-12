import { expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { Game } from '../../src/core/Game';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { ConveyorNetwork } from '../../src/logistics/ConveyorNetwork';
import { ConveyorPath } from '../../src/logistics/ConveyorPath';
import { InventoryReceiver, InventorySource } from '../../src/logistics/Ports';
import { MockScheduler } from '../helpers/MockScheduler';
import { FakeEngine } from '../helpers/FakeEngine';

async function scenario(frame: number) {
  const registry = createDefaultItemRegistry(), source = new Inventory(registry, 1), sink = new Inventory(registry, 1);
  source.addItem('iron-ore', 40);
  const net = new ConveyorNetwork(); net.add('one', new ConveyorPath({ shape: 'straight', x: 0, y: 0, z: 0, rotation: 0, size: 2 }));
  net.attachSource('one', new InventorySource('source', { position: net.get('one')!.path.point(0), direction: net.get('one')!.path.direction('input') }, source, 'iron-ore')); net.attachReceiver('one', new InventoryReceiver('sink', { position: net.get('one')!.path.point(2), direction: net.get('one')!.path.direction('output') }, sink));
  const scheduler = new MockScheduler(), game = new Game({ config: createGameConfig(), engine: new FakeEngine(), scheduler });
  game.registerSystem(net); await game.init(); game.start(); scheduler.advance(frame); scheduler.advanceFrames(30000 / frame, frame);
  const result = { received: sink.getItemCount('iron-ore'), source: source.getItemCount('iron-ore'), items: net.get('one')!.items.map((item) => item.distance) };
  game.dispose(); return result;
}
it('has identical logical results under different render partitions', async () => {
  expect(await scenario(25)).toEqual(await scenario(100));
});

async function buildingScenario(frame: number) {
  const { BuildingSystem } = await import('../../src/buildings/BuildingSystem');
  const { createDefaultBuildingRegistry } = await import('../../src/buildings/BuildingRegistry');
  const { MachineManager } = await import('../../src/machines/MachineManager');
  const { LogisticsManager } = await import('../../src/logistics/LogisticsManager');
  const terrain: import('../../src/world/terrain/TerrainHeightfield').TerrainQuery = {
    bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
    contains: () => true, clampXZ: (x, z) => ({ x, z }), heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }),
  };
  const deposit = { id: 'iron', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal' as const, productionMultiplier: 1, extractionCompatible: true };
  const registry = createDefaultItemRegistry(), inventory = new Inventory(registry, 5);
  inventory.addItem('iron-ore', 20); inventory.addItem('stone', 50); inventory.addItem('wood', 30);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(registry), inventory, terrain, [], 1, 29, [deposit]);
  const far = { x: 10, z: 10, radius: .4 };
  const miner = buildings.place('miner-mk1', 0, 0, 0, far).building!;
  buildings.place('conveyor-straight', 0, -2, 0, far); buildings.place('conveyor-curve', 0, -4, 0, far);
  buildings.place('conveyor-incline', 2, -4, 3, far); const terminal = buildings.place('receiving-terminal', 4, -4, 3, far).building!;
  const machines = new MachineManager(buildings, registry, () => [deposit]), logistics = new LogisticsManager(buildings, machines, registry);
  const scheduler = new MockScheduler(), game = new Game({ config: createGameConfig(), engine: new FakeEngine(), scheduler });
  game.registerSystem(machines); game.registerSystem(logistics); await game.init(); game.start();
  scheduler.advance(frame); scheduler.advanceFrames(30000 / frame, frame);
  const result = { stock: machines.get(miner.id)!.output.snapshot(), terminal: logistics.terminal(terminal.id)!.snapshot(),
    items: logistics.network.all().map((s) => s.items.map(({ id, distance }) => ({ id, distance }))) };
  game.dispose(); return result;
}
it('keeps the building-backed miner, curve, incline and terminal deterministic across game frame partitions', async () => {
  const a = await buildingScenario(25), b = await buildingScenario(100);
  expect(a).toEqual(b); expect(a.terminal.some((slot) => (slot?.quantity ?? 0) > 0)).toBe(true);
});
