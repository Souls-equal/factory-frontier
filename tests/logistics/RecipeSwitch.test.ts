import { expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import { PowerManager } from '../../src/power/PowerManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x, z) => ({ x, z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
it('switches the live output port without dropping items already in transit', () => {
  const items = createDefaultItemRegistry(), player = new Inventory(items, 4);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 29); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), power = new PowerManager(buildings, machines, items);
  const logistics = new LogisticsManager(buildings, machines, items, () => false, 2);
  const place = (id: string, x: number, z: number) => {
    const result = buildings.place(id, x, z, 0, { x: 20, z: 20, radius: .4 }); expect(result.reason).toBe('valid'); return result.building!;
  };
  const c = place('constructor', 0, 0), belt = place('conveyor-cell', -.5, -1.5);
  place('conveyor-cell', -.5, -2.5); const terminal = place('receiving-terminal', 0, -4);
  place('power-pole', 3, 0); const gen = place('biomass-generator', 5, 0);
  power.sync(); logistics.sync(); power.generator(gen.id)!.fuel.addItem('wood', 2);
  const machine = machines.constructorMachine(c.id)!;
  machine.input.addItem('iron-ingot', 1);
  const tick = () => { power.fixedUpdate(50); logistics.fixedUpdate(50); };
  for (let i = 0; i < 100 && !logistics.network.get(belt.id)!.items.length; i++) tick();
  expect(logistics.network.get(belt.id)!.items.some(item => item.itemId === 'iron-plate')).toBe(true);
  expect(machine.input.usedSlots + machine.output.usedSlots).toBe(0);
  expect(machine.selectRecipe('iron-rod')).toBe(true);
  machine.input.addItem('iron-ingot', 2); for (let i = 0; i < 200; i++) tick();
  const receiver = logistics.terminal(terminal.id)!;
  expect(receiver.getItemCount('iron-plate')).toBe(1); expect(receiver.getItemCount('iron-rod')).toBe(2);
  expect(machine.input.usedSlots + machine.output.usedSlots).toBe(0);
});
