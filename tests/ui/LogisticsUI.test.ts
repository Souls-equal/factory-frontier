// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import { LogisticsUI } from '../../src/ui/LogisticsUI';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, size: 40, resolution: 20, cellSize: 2,
  contains: () => true, clampXZ: (x,z) => ({x,z}), heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
it('inspects real segment state and retrieves only what fits from a terminal', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><button data-logistics-close>close</button><p data-logistics-details></p><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), builder = new Inventory(items, 5);
  builder.addItem('stone', 20); builder.addItem('wood', 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), builder, terrain, [], 1, 19);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const player = { x: 8, z: 8, radius: .4 };
  const belt = buildings.place('conveyor-straight', 0, 0, 0, player).building!;
  const terminal = buildings.place('receiving-terminal', 0, -2, 0, player).building!; logistics.sync();
  logistics.terminal(terminal.id)!.addItem('iron-ore', 10);
  const playerInventory = new Inventory(items, 1); playerInventory.addItem('iron-ore', 97);
  const close = vi.fn(), ui = new LogisticsUI(root, logistics, playerInventory, close); ui.open(belt.id);
  expect(root.textContent).toContain('DISCONNECTED'); expect(root.textContent).toContain(terminal.id); expect(root.textContent).toContain('60 items/min');
  expect(root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.hidden).toBe(true);
  ui.open(terminal.id); expect(root.textContent).toContain('Iron Ore: 10');
  root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.click();
  expect(root.textContent).toContain('Transferred 3; 7 remain.');
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(7);
  expect(playerInventory.getItemCount('iron-ore')).toBe(100);
  root.querySelector<HTMLButtonElement>('[data-logistics-close]')!.click(); expect(close).toHaveBeenCalledOnce();
  ui.closePanel(); expect(ui.isOpen).toBe(false); ui.dispose();
});

it('explains an open end and reports BLOCKED rather than disconnected when a source is connected', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><button data-logistics-close>close</button><p data-logistics-details></p><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), builder = new Inventory(items, 5);
  builder.addItem('stone', 30); builder.addItem('wood', 20);
  const deposit = { id: 'ore', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal' as const, productionMultiplier: 1, extractionCompatible: true };
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), builder, terrain, [], 1, 19, [deposit]);
  const machines = new MachineManager(buildings, items, () => [deposit]), logistics = new LogisticsManager(buildings, machines, items);
  const player = { x: 8, z: 8, radius: .4 };
  const miner = buildings.place('miner-mk1', 0, 0, 0, player).building!;
  const belt = buildings.place('conveyor-straight', 0, -2, 0, player).building!; logistics.sync();
  const ui = new LogisticsUI(root, logistics, builder, vi.fn()); ui.open(belt.id);
  expect(root.textContent).toContain('IDLE'); expect(root.textContent).toContain('Open end: items will stop here.');
  machines.get(miner.id)!.output.addItem('iron-ore', 1);
  for (let i = 0; i < 100; i++) logistics.fixedUpdate(50);
  ui.update(); expect(root.textContent).toContain('BLOCKED'); expect(root.textContent).toContain('Open end: connect another belt or a receiver.');
  expect(root.textContent).not.toContain('DISCONNECTED'); ui.dispose();
});
