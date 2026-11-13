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
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><button data-logistics-close>close</button><p data-logistics-details></p><div data-logistics-grid hidden></div><p data-logistics-slot-detail></p><div data-logistics-player-pane><div data-logistics-player-grid></div><p data-logistics-player-capacity></p><p data-logistics-player-detail></p></div><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
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
  ui.open(terminal.id); expect(root.querySelector('[data-logistics-grid]')!.textContent).toContain('Iron Ore ×10');
  expect(root.querySelector('[data-logistics-player-grid]')!.textContent).toContain('Iron Ore ×97');
  expect(root.querySelector('[data-logistics-player-capacity]')!.textContent).toContain('1 / 1');
  root.querySelector<HTMLButtonElement>('[data-logistics-player-grid] [data-slot="0"]')!.click();
  expect(root.querySelector('[data-logistics-player-detail]')!.textContent).toContain('97 / 100');
  root.querySelector<HTMLButtonElement>('[data-logistics-grid] [data-slot="0"]')!.click();
  expect(root.querySelector('[data-logistics-slot-detail]')!.textContent).toContain('10 / 100');
  root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.click();
  expect(root.textContent).toContain('Transferred 3; 7 remain.');
  expect(logistics.terminal(terminal.id)!.getItemCount('iron-ore')).toBe(7);
  expect(playerInventory.getItemCount('iron-ore')).toBe(100);
  expect(root.querySelector('[data-logistics-player-grid]')!.textContent).toContain('Iron Ore ×100');
  playerInventory.removeItem('iron-ore', 100); ui.update();
  expect(root.querySelector('[data-logistics-player-grid] [data-slot]')!.getAttribute('aria-label')).toBe('Empty slot 1');
  expect(root.querySelector('[data-logistics-player-capacity]')!.textContent).toContain('0 / 1');
  root.querySelector<HTMLButtonElement>('[data-logistics-close]')!.click(); expect(close).toHaveBeenCalledOnce();
  ui.closePanel(); expect(ui.isOpen).toBe(false); ui.dispose();
});

it('explains an open end and reports BLOCKED rather than disconnected when a source is connected', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><button data-logistics-close>close</button><p data-logistics-details></p><div data-logistics-grid hidden></div><p data-logistics-slot-detail></p><div data-logistics-player-pane><div data-logistics-player-grid></div><p data-logistics-player-capacity></p><p data-logistics-player-detail></p></div><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
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

it('renders all configurable terminal slots, updates and preserves partial transfer', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><button data-logistics-close>close</button><p data-logistics-details></p><div data-logistics-grid hidden></div><p data-logistics-slot-detail></p><div data-logistics-player-pane><div data-logistics-player-grid></div><p data-logistics-player-capacity></p><p data-logistics-player-detail></p></div><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), builder = new Inventory(items, 5);
  builder.addItem('stone', 10); builder.addItem('wood', 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), builder, terrain, [], 1, 19);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items, () => false, 3);
  const terminal = buildings.place('receiving-terminal', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  logistics.sync(); const receiver = logistics.terminal(terminal.id)!;
  receiver.addItem('iron-ore', 105); receiver.addItem('coal', 2);
  const player = new Inventory(items, 1); player.addItem('iron-ore', 97);
  const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(terminal.id);
  const slots = () => [...root.querySelectorAll<HTMLButtonElement>('[data-logistics-grid] [data-slot]')];
  expect(slots()).toHaveLength(3); expect(slots().map((s) => s.getAttribute('aria-label'))).toEqual(['Iron Ore, 100 of 100', 'Iron Ore, 5 of 100', 'Coal, 2 of 100']);
  expect(slots()[2]!.getAttribute('aria-label')).toBe('Coal, 2 of 100'); slots()[2]!.click();
  expect(root.textContent).toContain('Carbon-rich fuel');
  const first = slots()[0]; ui.update(); expect(slots()[0]).toBe(first); // no rebuilding every frame
  root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.click();
  expect(player.getItemCount('iron-ore')).toBe(100); expect(receiver.getItemCount('iron-ore')).toBe(102);
  expect(receiver.getItemCount('coal')).toBe(2); expect(root.textContent).toContain('Transferred 3; 104 remain.');
  receiver.removeItem('coal', 2); ui.update(); expect(slots()[2]!.getAttribute('aria-label')).toBe('Empty slot 3');
  expect(root.querySelector('[data-logistics-slot-detail]')!.textContent).not.toContain('Carbon-rich');
  ui.closePanel(); ui.open(terminal.id); expect(slots()).toHaveLength(3); ui.dispose();
});

it('shows storage capacity and transfers only what fits in either direction', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><span data-logistics-storage-heading></span><span data-logistics-storage-badge></span><button data-logistics-close>close</button><p data-logistics-details></p><div data-logistics-grid hidden></div><p data-logistics-slot-detail></p><div data-logistics-player-pane><div data-logistics-player-grid></div><p data-logistics-player-capacity></p><p data-logistics-player-detail></p></div><button data-logistics-deposit>store</button><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), builder = new Inventory(items, 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), builder, terrain, [], 1, 19); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const storage = buildings.place('storage-container', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  logistics.sync(); const inventory = logistics.terminal(storage.id)!;
  inventory.addItem('iron-ore', 799);
  const player = new Inventory(items, 1); player.addItem('iron-ore', 5);
  const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(storage.id);
  expect(root.querySelector('[data-logistics-title]')!.textContent).toBe('Storage Container');
  expect(root.querySelectorAll('[data-logistics-grid] [data-slot]')).toHaveLength(8);
  const store = root.querySelector<HTMLButtonElement>('[data-logistics-deposit]')!; expect(store.disabled).toBe(true);
  root.querySelector<HTMLButtonElement>('[data-logistics-player-grid] [data-slot="0"]')!.click(); expect(store.disabled).toBe(false); store.click();
  expect(inventory.getItemCount('iron-ore')).toBe(800); expect(player.getItemCount('iron-ore')).toBe(4);
  expect(root.textContent).toContain('Stored 1; 4 remain in inventory.');
  root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.click();
  expect(player.getItemCount('iron-ore')).toBe(100); expect(inventory.getItemCount('iron-ore')).toBe(704);
  expect(root.textContent).toContain('Transferred 96; 704 remain.'); ui.dispose();
});

it('inspects and recovers the buffered splitter item without discarding it on a full player', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><button data-logistics-close>close</button><p data-logistics-details></p><div data-logistics-grid hidden></div><p data-logistics-slot-detail></p><div data-logistics-player-pane><div data-logistics-player-grid></div><p data-logistics-player-capacity></p><p data-logistics-player-detail></p></div><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), builder = new Inventory(items, 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), builder, terrain, [], 1, 19); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const splitter = buildings.place('splitter', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  logistics.sync(); const junction = logistics.splitter(splitter.id)!;
  const pose = { position: { x: 0, y: .5, z: 1 }, direction: { x: 0, y: 0, z: -1 } };
  junction.receiver(pose).accept('coal');
  const player = new Inventory(items, 1); player.addItem('stone', 100);
  const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(splitter.id);
  expect(root.querySelector('[data-logistics-title]')!.textContent).toBe('Splitter'); expect(root.textContent).toContain('Buffered: Coal');
  const retrieve = root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!; retrieve.click();
  expect(junction.pending).toBe('coal'); expect(root.textContent).toContain('Transferred 0; 1 remain.');
  player.removeItem('stone', 100); retrieve.click(); expect(junction.pending).toBeNull(); expect(player.getItemCount('coal')).toBe(1);
  expect(retrieve.disabled).toBe(true); ui.dispose();
});

it('configures splitter routing and inspects the merger buffer', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><button data-logistics-close>close</button><p data-logistics-details></p><div data-splitter-settings hidden><select data-splitter-mode><option value="balanced">Balanced</option><option value="overflow">Overflow</option><option value="priority">Priority</option></select><select data-splitter-priority><option value="0">Front</option><option value="1">Left</option><option value="2">Right</option></select></div><div data-logistics-grid hidden></div><p data-logistics-slot-detail></p><div data-logistics-player-pane><div data-logistics-player-grid></div><p data-logistics-player-capacity></p><p data-logistics-player-detail></p></div><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), player = new Inventory(items, 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 19); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const splitter = buildings.place('splitter', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  const merger = buildings.place('merger', 4, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  logistics.sync(); const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(splitter.id);
  const mode = root.querySelector<HTMLSelectElement>('[data-splitter-mode]')!, priority = root.querySelector<HTMLSelectElement>('[data-splitter-priority]')!;
  expect(priority.disabled).toBe(true); mode.value = 'overflow'; mode.dispatchEvent(new Event('change'));
  expect(priority.disabled).toBe(false); priority.value = '2'; priority.dispatchEvent(new Event('change'));
  expect(logistics.splitter(splitter.id)!.mode).toBe('overflow'); expect(logistics.splitter(splitter.id)!.priority).toBe(2);
  const pose = { position: { x: 0, y: .5, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
  logistics.merger(merger.id)!.receiver(0, pose).accept('coal'); ui.open(merger.id);
  expect(root.querySelector<HTMLElement>('[data-splitter-settings]')!.hidden).toBe(true);
  expect(root.textContent).toContain('Merger'); expect(root.textContent).toContain('Coal');
  root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.click();
  expect(player.getItemCount('coal')).toBe(1); expect(logistics.merger(merger.id)!.occupied).toBe(false); ui.dispose();
});

it('shows lift flow, physical throughput cap, and resets the panel when reopening storage', () => {
  document.body.innerHTML = '<section hidden><h2 data-logistics-title></h2><span data-logistics-storage-heading></span><span data-logistics-storage-badge></span><button data-logistics-close>close</button><p data-logistics-details></p><div data-logistics-grid hidden></div><p data-logistics-slot-detail></p><div data-logistics-player-pane><div data-logistics-player-grid></div><p data-logistics-player-capacity></p><p data-logistics-player-detail></p></div><button data-logistics-deposit>store</button><button data-logistics-retrieve>retrieve</button><p data-logistics-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 19); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items, () => false, 1, { speed: .5, spacing: .5, throughputPerMinute: 100 });
  const lift = buildings.place('lift-up-3', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  const storage = buildings.place('storage-container', 5, 5, 0, { x: 8, z: 8, radius: .4 }).building!;
  logistics.sync(); const ui = new LogisticsUI(root, logistics, inventory, vi.fn()); ui.open(lift.id);
  expect(root.textContent).toContain('Maximum throughput: 100 items/min'); expect(root.textContent).toContain('Theoretical limit: 60 items/min');
  expect(root.textContent).toContain('Observed outputs (up to 60 s, 1 s bins): 0 items / 60 s'); expect(root.textContent).toContain('Total sent: 0');
  expect(root.querySelector('[data-logistics-storage-badge]')!.textContent).toBe('FLOW');
  ui.open(storage.id); expect(root.querySelector('[data-logistics-storage-heading]')!.textContent).toBe('Container');
  expect(root.querySelector('[data-logistics-storage-badge]')!.textContent).not.toBe('FLOW'); ui.dispose();
});
