import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
import { MachineManager } from '../../src/machines/MachineManager';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { VoxelTerrain } from '../../src/world/terrain/VoxelTerrain';

describe('generated voxel world', () => {
  it('builds voxel geometry from the exact world occupancy', () => {
    const world = createWorld(createGameConfig());
    expect(world.terrain).toBeInstanceOf(VoxelTerrain);
    const mesh = world.terrain.getRenderData();
    expect(mesh.faceCount).toBeGreaterThan(0);
    expect(mesh.positions.length).toBe(mesh.faceCount * 12);
    expect(world.terrain.blockSize).toBe(1);
    const x = world.spawn.x, z = world.spawn.z;
    const column = world.terrain.columnAt(x, z)!;
    const top = world.terrain.topLevel(column.x, column.z)!;
    expect(world.terrain.heightAt(x, z)).toBe(top);
    expect(world.terrain.isSolid(column.x, top - 1, column.z)).toBe(true);
    expect(world.terrain.isSolid(column.x, top, column.z)).toBe(false);
  });
  it('runs the Miner-to-terminal chain on the generated voxel world', () => {
    const config = createGameConfig(), items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
    inventory.addItem('iron-ore', 20); inventory.addItem('stone', 40); inventory.addItem('wood', 20);
    const world = createWorld(config, inventory), deposit = world.deposits.find((d) => d.itemId === 'iron-ore')!;
    const far = { x: 100, z: 100, radius: .4 };
    const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far);
    expect(miner.reason).toBe('valid');
    const { x, z } = miner.transform;
    let terminalId = '';
    for (const [type, px, pz, rotation] of [
      ['conveyor-straight', x, z - 2, 0], ['conveyor-curve', x, z - 4, 0],
      ['conveyor-incline', x + 2, z - 4, 3], ['receiving-terminal', x + 4, z - 4, 3],
    ] as const) {
      const placed = world.buildings.place(type, px, pz, rotation, far);
      expect(placed.reason, type).toBe('valid'); expect(placed.connection).toBe('connected');
      if (type === 'receiving-terminal') terminalId = placed.building!.id;
    }
    const machines = new MachineManager(world.buildings, items, () => world.deposits);
    const logistics = new LogisticsManager(world.buildings, machines, items);
    for (let i = 0; i < 1200; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
    expect(logistics.terminal(terminalId)!.getItemCount('iron-ore')).toBeGreaterThan(0);
  });
  it('keeps generated deposits suitable for Miner placement across representative seeds', () => {
    for (const seed of [1, 2, 3, 4, 5, 777, 1234, 20261111]) {
      const config = createGameConfig({ world: { seed } });
      const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
      inventory.addItem('iron-ore', 100); inventory.addItem('stone', 100); inventory.addItem('wood', 100);
      const world = createWorld(config, inventory);
      for (const deposit of world.deposits) {
        const result = world.buildings.validate('miner-mk1', deposit.x, deposit.z, 0, { x: 1000, z: 1000, radius: .4 });
        expect(result.reason, `seed ${seed}, ${deposit.id}`).toBe('valid');
      }
    }
  });
});

describe('configured voxel world limits', () => {
  it('renders a large world with valid high terrain settings without exceeding mesh limits', () => {
    const config = createGameConfig({ world: { sizeMeters: 2000, resolution: 8, heightScale: 200, rimHeight: 200, obstacleCount: 0 } });
    const world = createWorld(config);
    const surface = world.terrain.getRenderData();
    expect(surface.faceCount).toBeGreaterThan(0);
    expect(surface.faceCount).toBeLessThanOrEqual(500_000);
    expect(world.terrain.blockSize).toBeGreaterThan(1);
  }, 30000);
});

it.each([40, 60, 240, 2000])('keeps valid high-amplitude world size %s constructible', (sizeMeters) => {
  const world = createWorld(createGameConfig({ world: { sizeMeters, resolution: 8, heightScale: 200, rimHeight: 200, obstacleCount: 0 } }));
  expect(world.terrain.getSurfaceFaceCount()).toBeLessThanOrEqual(500_000);
  expect(Number.isFinite(world.spawn.y)).toBe(true);
}, 30000);
