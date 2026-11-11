import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { MachineManager } from '../../src/machines/MachineManager';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
const terrain: TerrainQuery = { bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, size: 40, resolution: 20, cellSize: 2,
  contains: (x,z) => Math.abs(x) <= 20 && Math.abs(z) <= 20, clampXZ: (x,z) => ({ x,z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const deposit: ResourceDeposit = { id: 'iron', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
function setup(deposits: ResourceDeposit[] = [deposit]) {
  const items = createDefaultItemRegistry(); const inv = new Inventory(items, 5);
  inv.addItem('iron-ore', 20); inv.addItem('stone', 10); inv.addItem('wood', 10);
  const obstacles = deposits.map((d) => ({ id: `${d.id}-collider`, kind: 'prop' as const, x: d.x, y: d.y, z: d.z, radius: d.radius, height: 1.5, yaw: 0, variant: 0 }));
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inv, terrain, obstacles, 1, 19, deposits);
  const machines = new MachineManager(buildings, items, () => deposits);
  return { items, inv, buildings, machines };
}
const player = { x: 5, z: 5, radius: .4 };
describe('miner placement and lifecycle', () => {
  it('binds one deposit, charges cost and refuses demolition until output is empty', () => {
    const { inv, buildings, machines } = setup();
    const preview = buildings.validate('miner-mk1', 0, 0, 0, player);
    expect(preview.reason).toBe('valid'); expect(preview.depositId).toBe('iron');
    const result = buildings.place('miner-mk1', 0, 0, 0, player); expect(result.building?.depositId).toBe('iron');
    expect(inv.getItemCount('iron-ore')).toBe(0); machines.sync(); expect(machines.all()).toHaveLength(1);
    const miner = machines.get(result.building!.id)!; machines.fixedUpdate(2000);
    expect(miner.output.getItemCount('iron-ore')).toBe(1);
    expect(buildings.demolish(result.building!.id)).toBe('output not empty');
    expect(buildings.get(result.building!.id)).toBeDefined();
    expect(miner.retrieve(inv).moved).toBe(1); expect(buildings.demolish(result.building!.id)).toBe('removed');
    machines.sync(); expect(machines.all()).toHaveLength(0); machines.fixedUpdate(60000);
    expect(inv.getItemCount('iron-ore')).toBe(21);
  });
  it('rejects missing, incompatible and duplicate deposits without consuming materials', () => {
    for (const deposits of [[], [{ ...deposit, extractionCompatible: false }], [deposit, { ...deposit, id: 'two' }], [{ ...deposit, itemId: 'unknown' }], [{ ...deposit, productionMultiplier: 0 }]]) {
      const { inv, buildings } = setup(deposits); const before = inv.snapshot();
      expect(buildings.place('miner-mk1', 0, 0, 0, player).reason).not.toBe('valid');
      expect(inv.snapshot()).toEqual(before); expect(buildings.all()).toEqual([]);
    }
  });
  it('rejects non-deposit obstacles and insufficient materials', () => {
    const { inv, buildings } = setup(); inv.removeItem('wood', 1);
    const before = inv.snapshot(); expect(buildings.place('miner-mk1', 0, 0, 0, player).reason).toBe('insufficient materials');
    expect(inv.snapshot()).toEqual(before);
    const items = createDefaultItemRegistry(); const inventory = new Inventory(items, 3);
    const obstacle = { id: 'rock', kind: 'prop' as const, x: 0, y: 0, z: 0, radius: 1, height: 2, yaw: 0, variant: 0 };
    const blocked = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [obstacle], 1, 19, [deposit]);
    expect(blocked.validate('miner-mk1', 0, 0, 0, player).reason).toBe('occupied space');
  });
  it('pauses extraction while modal gameplay is suspended', () => {
    const { buildings, items } = setup(); let paused = true;
    const machines = new MachineManager(buildings, items, () => [deposit], undefined, () => paused);
    const result = buildings.place('miner-mk1', 0, 0, 0, player); machines.fixedUpdate(60000);
    const miner = machines.get(result.building!.id)!; expect(miner.output.usedSlots).toBe(0);
    paused = false; machines.fixedUpdate(60000); expect(miner.output.getItemCount('iron-ore')).toBe(30);
  });
});

it('can place a miner at the generated starting iron deposit with the real terrain and colliders', async () => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { createWorld } = await import('../../src/world/World');
  const config = createGameConfig(), items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
  inventory.addItem('iron-ore', 20); inventory.addItem('stone', 10); inventory.addItem('wood', 10);
  const world = createWorld(config, inventory), iron = world.deposits.find((entry) => entry.itemId === 'iron-ore');
  if (!iron) throw new Error('starting deposit missing');
  const result = world.buildings.validate('miner-mk1', iron.x, iron.z, 0, { x: world.spawn.x, z: world.spawn.z, radius: .4 });
  expect(result.reason).toBe('valid'); expect(result.depositId).toBe(iron.id);
});

it('prevents assigning the same deposit twice and refunds only after output is clear', () => {
  const { buildings, machines, inv } = setup();
  const first = buildings.place('miner-mk1', 0, 0, 0, player);
  inv.addItem('iron-ore', 20); inv.addItem('stone', 10); inv.addItem('wood', 10);
  expect(buildings.validate('miner-mk1', 0, 0, 0, player).reason).toBe('occupied space');
  machines.sync(); machines.fixedUpdate(2000);
  expect(buildings.demolish(first.building!.id)).toBe('output not empty');
  machines.get(first.building!.id)!.retrieve(inv);
  expect(buildings.demolish(first.building!.id)).toBe('removed');
  expect(buildings.validate('miner-mk1', 0, 0, 0, player).reason).toBe('valid');
});
