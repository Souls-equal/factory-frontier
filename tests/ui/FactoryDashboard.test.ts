// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
import { MachineManager } from '../../src/machines/MachineManager';
import { PowerManager } from '../../src/power/PowerManager';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { ProductionHistory } from '../../src/statistics/ProductionHistory';
import { FactoryDashboard } from '../../src/ui/FactoryDashboard';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

it('renders authoritative production, power and concrete blocked states without mutating the simulation', () => {
  document.body.innerHTML = '<section hidden><button data-factory-close>Close</button><p data-factory-summary></p><p data-factory-power></p><ul data-factory-networks></ul><table><tbody data-factory-rows></tbody></table><ul data-factory-diagnostics></ul></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), player = new Inventory(items, 12);
  const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
    contains: () => true, clampXZ: (x,z) => ({x,z}), heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({x:0,y:1,z:0}) };
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 29, []); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), power = new PowerManager(buildings, machines, items), logistics = new LogisticsManager(buildings, machines, items, () => false, 1, undefined, undefined, power);
  const place = (id: string, x: number, z: number) => { const r = buildings.place(id, x, z, 0, {x:20,z:20,radius:.4}); expect(r.reason).toBe('valid'); return r.building!; };
  const constructor = place('constructor', 0, 0), belt = place('conveyor-cell', -.5, 1.5);
  place('power-pole', 3, 0); const generator = place('biomass-generator', 5, 0); logistics.sync();
  const m = machines.constructorMachine(constructor.id)!; m.input.addItem('iron-ingot', 1); power.generator(generator.id)!.fuel.addItem('wood', 2);
  expect(logistics.network.insertDropped('invalid-cargo', 'wood', belt.id)).toBe(true);
  const history = new ProductionHistory(machines, items);
  for (let i = 0; i < 80; i++) { power.fixedUpdate(50); logistics.fixedUpdate(50); history.fixedUpdate(50); }
  const close = vi.fn(), ui = new FactoryDashboard(root, buildings, machines, logistics, power, history, items, close);
  const before = { fuel: power.generator(generator.id)!.fuelTimeMs, elapsed: history.elapsedMs, production: m.produced('iron-plate') };
  ui.open(); expect(ui.isOpen).toBe(true); expect(document.activeElement).toBe(root.querySelector('[data-factory-close]'));
  expect(root.querySelector('[data-factory-summary]')!.textContent).toContain('1 blocked belts');
  expect(root.querySelector('[data-factory-power]')!.textContent).toContain('supplied 10.0 kW');
  expect(root.querySelector('[data-factory-networks]')!.textContent).toContain('online');
  expect(root.querySelector('[data-factory-rows]')!.textContent).toContain('Iron Plate');
  expect(root.querySelector('[data-factory-rows]')!.textContent).toContain('15.0');
  expect(root.querySelector('[data-factory-diagnostics]')!.textContent).toContain('missing input: Iron Ingot');
  expect(root.querySelector('[data-factory-diagnostics]')!.textContent).toContain('conveyor output blocked');
  ui.update(); expect({ fuel: power.generator(generator.id)!.fuelTimeMs, elapsed: history.elapsedMs, production: m.produced('iron-plate') }).toEqual(before);
  root.querySelector<HTMLButtonElement>('[data-factory-close]')!.click(); expect(close).toHaveBeenCalledOnce(); ui.closePanel(); expect(ui.isOpen).toBe(false); ui.dispose();
});
