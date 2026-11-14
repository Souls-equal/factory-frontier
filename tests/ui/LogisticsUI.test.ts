// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
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


it('configures a storage output filter through the actual page and preserves manual transfers', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry(), player = new Inventory(items, 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 19); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const far = { x: 8, z: 8, radius: .4 };
  const storage = buildings.place('storage-container', 0, 3, 0, far).building!;
  const belt = buildings.place('conveyor-cell', -.5, 1.5, 0, far).building!;
  const sink = buildings.place('storage-container', 0, 0, 0, far).building!;
  const terminal = buildings.place('receiving-terminal', 6, 0, 0, far).building!;
  logistics.sync(); const contents = logistics.terminal(storage.id)!; contents.addItem('iron-ore', 3); contents.addItem('coal', 2);
  const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(storage.id);
  const settings = root.querySelector<HTMLElement>('[data-storage-settings]')!, filter = root.querySelector<HTMLSelectElement>('[data-storage-filter]')!;
  expect(settings.hidden).toBe(false); expect(filter.value).toBe(''); expect(filter.options.length).toBe(items.all().length + 1);
  filter.value = 'coal'; filter.dispatchEvent(new Event('change')); expect(logistics.storageOutputFilter(storage.id)).toBe('coal');
  ui.closePanel(); for (let i = 0; i < 300; i++) logistics.fixedUpdate(50);
  expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(2); expect(contents.getItemCount('iron-ore')).toBe(3);
  expect(logistics.network.get(belt.id)!.items).toHaveLength(0);
  ui.open(storage.id); expect(filter.value).toBe('coal');
  root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.click(); expect(player.getItemCount('iron-ore')).toBe(3);
  filter.value = ''; filter.dispatchEvent(new Event('change')); expect(logistics.storageOutputFilter(storage.id)).toBeNull();
  ui.open(terminal.id); expect(settings.hidden).toBe(true);
  ui.open(sink.id); expect(settings.hidden).toBe(false); expect(filter.value).toBe(''); ui.dispose();
});

it('configures independent splitter item filters through the actual page', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry(), player = new Inventory(items, 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 19); buildings.setCreativeMode(true);
  const logistics = new LogisticsManager(buildings, new MachineManager(buildings, items, () => []), items);
  const far = { x: 8, z: 8, radius: .4 }, first = buildings.place('splitter', 0, 0, 0, far).building!, second = buildings.place('splitter', 4, 0, 0, far).building!;
  logistics.sync(); const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(first.id);
  const mode = root.querySelector<HTMLSelectElement>('[data-splitter-mode]')!, priority = root.querySelector<HTMLSelectElement>('[data-splitter-priority]')!;
  const box = root.querySelector<HTMLElement>('[data-splitter-filters]')!, selects = [...root.querySelectorAll<HTMLSelectElement>('[data-splitter-filter]')];
  expect(box.hidden).toBe(true); expect(selects).toHaveLength(3); expect(selects[0]!.options.length).toBe(items.all().length + 1);
  mode.value = 'filtered'; mode.dispatchEvent(new Event('change')); expect(box.hidden).toBe(false); expect(priority.disabled).toBe(true);
  selects[0]!.value = 'coal'; selects[0]!.dispatchEvent(new Event('change')); selects[1]!.value = 'iron-ore'; selects[1]!.dispatchEvent(new Event('change'));
  expect(logistics.splitter(first.id)!.filters).toEqual(['coal','iron-ore',null]);
  mode.value = 'overflow'; mode.dispatchEvent(new Event('change')); expect(box.hidden).toBe(true); expect(priority.disabled).toBe(false);
  mode.value = 'filtered'; mode.dispatchEvent(new Event('change')); expect(selects.map((s) => s.value)).toEqual(['coal','iron-ore','']);
  ui.open(second.id); expect(box.hidden).toBe(true); expect(mode.value).toBe('balanced');
  ui.open(first.id); expect(box.hidden).toBe(false); expect(selects.map((s) => s.value)).toEqual(['coal','iron-ore','']);
  ui.closePanel(); selects[0]!.value = 'wood'; selects[0]!.dispatchEvent(new Event('change'));
  expect(logistics.splitter(first.id)!.filters[0]).toBe('coal'); ui.dispose();
});

it('retrieves only the selected storage stack and respects partial capacity', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry(), player = new Inventory(items, 1);
  player.addItem('iron-ore', 85);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), new Inventory(items, 5), terrain, [], 1, 19); buildings.setCreativeMode(true);
  const logistics = new LogisticsManager(buildings, new MachineManager(buildings, items, () => []), items);
  const storage = buildings.place('storage-container', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!; logistics.sync();
  const contents = logistics.terminal(storage.id)!; contents.addItem('iron-ore', 150); contents.addItem('coal', 7);
  const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(storage.id);
  const button = root.querySelector<HTMLButtonElement>('[data-logistics-retrieve-selected]')!;
  const slot = (i: number) => root.querySelector<HTMLButtonElement>(`[data-logistics-grid] [data-slot="${i}"]`)!;
  expect(button.hidden).toBe(false); expect(button.disabled).toBe(true); slot(1).click(); expect(button.disabled).toBe(false);
  button.click(); expect(contents.snapshot().map((v) => v?.quantity ?? 0).slice(0,3)).toEqual([100,35,7]);
  expect(player.getItemCount('iron-ore')).toBe(100); expect(root.textContent).toContain('Transferred 15; 35 remain in the selected stack.');
  expect(button.disabled).toBe(true); slot(1).click(); button.click(); expect(root.textContent).toContain('Transferred 0; 35 remain');
  expect(contents.getItemCount('iron-ore')).toBe(135); player.removeItem('iron-ore', 100); ui.update();
  expect(button.disabled).toBe(false); button.click(); expect(player.getItemCount('iron-ore')).toBe(35);
  expect(contents.snapshot()[0]?.quantity).toBe(100); expect(contents.snapshot()[1]).toBeNull(); expect(contents.getItemCount('coal')).toBe(7);
  expect(root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.hidden).toBe(false); ui.dispose();
});

it('stores exactly the selected player stack and rejects stale selections in either pane', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry(), player = new Inventory(items, 3);
  player.addItem('iron-ore', 130); player.addItem('coal', 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), new Inventory(items, 5), terrain, [], 1, 19); buildings.setCreativeMode(true);
  const logistics = new LogisticsManager(buildings, new MachineManager(buildings, items, () => []), items);
  const storage = buildings.place('storage-container', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!; logistics.sync();
  const contents = logistics.terminal(storage.id)!; contents.addItem('iron-ore', 790);
  const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(storage.id);
  const slot = (name: string, i: number) => root.querySelector<HTMLButtonElement>(`[data-logistics-${name}-grid] [data-slot="${i}"]`)!;
  const deposit = root.querySelector<HTMLButtonElement>('[data-logistics-deposit]')!, selected = root.querySelector<HTMLButtonElement>('[data-logistics-retrieve-selected]')!;
  slot('player',1).click(); deposit.click();
  expect(player.snapshot().map((v) => v?.quantity)).toEqual([100,20,5]); expect(contents.getItemCount('iron-ore')).toBe(800);
  expect(root.textContent).toContain('Stored 10; 20 remain in inventory.');
  slot('player',1).click(); player.swapSlots(1,2); deposit.click(); expect(root.textContent).toContain('Inventory changed; select a stack again.');
  expect(player.snapshot().map((v) => v?.quantity)).toEqual([100,5,20]);
  contents.removeItem('iron-ore', 100); contents.addItem('coal', 4); ui.update();
  root.querySelector<HTMLButtonElement>('[data-logistics-grid] [data-slot="0"]')!.click();
  expect(selected.disabled).toBe(false); contents.swapSlots(0, 1); selected.click();
  expect(root.textContent).toContain('Storage changed; select a stack again.'); expect(selected.disabled).toBe(true);
  expect(player.getItemCount('coal')).toBe(5); expect(contents.getItemCount('coal')).toBe(4);
  ui.dispose();
});

it('shows selected retrieval for terminals but never for splitters or conveyors', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry(), player = new Inventory(items, 3);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), new Inventory(items, 5), terrain, [], 1, 19); buildings.setCreativeMode(true);
  const logistics = new LogisticsManager(buildings, new MachineManager(buildings, items, () => []), items);
  const far = { x: 8, z: 8, radius: .4 }, terminal = buildings.place('receiving-terminal', 0, 0, 0, far).building!,
    splitter = buildings.place('splitter', 5, 0, 0, far).building!, belt = buildings.place('conveyor-cell', .5, 5.5, 0, far).building!;
  logistics.sync(); logistics.terminal(terminal.id)!.addItem('coal', 6);
  const ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(terminal.id);
  const take = root.querySelector<HTMLButtonElement>('[data-logistics-retrieve-selected]')!, deposit = root.querySelector<HTMLButtonElement>('[data-logistics-deposit]')!;
  expect(take.hidden).toBe(false); expect(deposit.hidden).toBe(true);
  root.querySelector<HTMLButtonElement>('[data-logistics-grid] [data-slot="0"]')!.click(); take.click();
  expect(player.getItemCount('coal')).toBe(6); expect(logistics.terminal(terminal.id)!.usedSlots).toBe(0);
  ui.open(splitter.id); expect(take.hidden).toBe(true); expect(deposit.hidden).toBe(true);
  ui.open(belt.id); expect(take.hidden).toBe(true); expect(root.querySelector<HTMLButtonElement>('[data-logistics-retrieve]')!.hidden).toBe(true);
  ui.closePanel(); take.dispatchEvent(new MouseEvent('click', { bubbles: true })); expect(player.getItemCount('coal')).toBe(6); ui.dispose();
});

it('resumes conveyor transport after selected retrieval without losing in-flight items', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry(), player = new Inventory(items, 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), new Inventory(items, 5), terrain, [], 1, 19); buildings.setCreativeMode(true);
  let ui: LogisticsUI | undefined;
  const logistics = new LogisticsManager(buildings, new MachineManager(buildings, items, () => []), items, () => !!ui?.isOpen);
  const far = { x: 8, z: 8, radius: .4 }, source = buildings.place('storage-container', 0, 3, 0, far).building!,
    belt = buildings.place('conveyor-cell', -.5, 1.5, 0, far).building!, sink = buildings.place('storage-container', 0, 0, 0, far).building!;
  logistics.sync(); const input = logistics.terminal(source.id)!, output = logistics.terminal(sink.id)!;
  input.addItem('coal', 8); logistics.fixedUpdate(50); expect(logistics.network.get(belt.id)!.items).toHaveLength(1);
  ui = new LogisticsUI(root, logistics, player, vi.fn()); ui.open(source.id); logistics.fixedUpdate(1000);
  root.querySelector<HTMLButtonElement>('[data-logistics-grid] [data-slot="0"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-logistics-retrieve-selected]')!.click();
  expect(player.getItemCount('coal')).toBe(7); expect(logistics.network.get(belt.id)!.items).toHaveLength(1);
  ui.closePanel(); for (let i = 0; i < 150; i++) logistics.fixedUpdate(50);
  expect(output.getItemCount('coal')).toBe(1); expect(player.getItemCount('coal') + output.getItemCount('coal') + input.getItemCount('coal')).toBe(8);
  ui.dispose();
});

it('transfers chosen quantities in both directions, validates input and resets stale selection', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry(), player = new Inventory(items, 2);
  player.addItem('iron-ore', 150);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), new Inventory(items, 5), terrain, [], 1, 19); buildings.setCreativeMode(true);
  const logistics = new LogisticsManager(buildings, new MachineManager(buildings, items, () => []), items);
  const storage = buildings.place('storage-container', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  const terminal = buildings.place('receiving-terminal', 5, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  logistics.sync(); const contents = logistics.terminal(storage.id)!; contents.addItem('iron-ore', 790);
  const close = vi.fn(), ui = new LogisticsUI(root, logistics, player, close); ui.open(storage.id);
  const input = (direction: string) => root.querySelector<HTMLInputElement>(`[data-logistics-${direction}-quantity]`)!;
  const group = (direction: string) => root.querySelector<HTMLElement>(`[data-logistics-${direction}-quantity-group]`)!;
  const deposit = root.querySelector<HTMLButtonElement>('[data-logistics-deposit]')!;
  const retrieve = root.querySelector<HTMLButtonElement>('[data-logistics-retrieve-selected]')!;
  const playerSlot = (i: number) => root.querySelector<HTMLButtonElement>(`[data-logistics-player-grid] [data-slot="${i}"]`)!;
  const storageSlot = (i: number) => root.querySelector<HTMLButtonElement>(`[data-logistics-grid] [data-slot="${i}"]`)!;
  expect(group('deposit').hidden).toBe(false); expect(group('retrieve').hidden).toBe(false);
  expect(input('deposit').disabled).toBe(true); playerSlot(1).click(); expect(input('deposit').disabled).toBe(false);
  for (const invalid of ['0', '-1', '1.5', '51']) {
    input('deposit').value = invalid; deposit.click();
    expect(root.textContent).toContain('Choose a whole number from 1 to 50');
    expect(player.snapshot()[1]?.quantity).toBe(50); expect(contents.getItemCount('iron-ore')).toBe(790);
  }
  input('deposit').value = '20'; deposit.click(); // only 10 fit
  expect(player.snapshot()[0]?.quantity).toBe(100); expect(player.snapshot()[1]?.quantity).toBe(40);
  expect(contents.getItemCount('iron-ore')).toBe(800); expect(root.textContent).toContain('Stored 10; 40 remain');
  expect(input('deposit').disabled).toBe(true); expect(input('deposit').value).toBe('');
  storageSlot(7).click(); input('retrieve').value = '12'; retrieve.click();
  expect(contents.snapshot()[7]?.quantity).toBe(88); expect(player.snapshot()[1]?.quantity).toBe(52);
  expect(root.textContent).toContain('Transferred 12; 88 remain');
  storageSlot(7).click(); input('retrieve').value = '7'; contents.removeItem('iron-ore', 1); retrieve.click();
  expect(root.textContent).toContain('Storage changed; select a stack again.'); expect(input('retrieve').value).toBe('');
  playerSlot(1).click(); input('deposit').value = '3'; player.removeItem('iron-ore', 1); deposit.click();
  expect(root.textContent).toContain('Inventory changed; select a stack again.'); expect(input('deposit').value).toBe('');
  storageSlot(7).click(); input('retrieve').value = '1'; storageSlot(0).click(); expect(input('retrieve').value).toBe('');
  ui.open(terminal.id); expect(group('deposit').hidden).toBe(true); expect(group('retrieve').hidden).toBe(false);
  logistics.terminal(terminal.id)!.addItem('coal', 8); ui.update(); storageSlot(0).click(); input('retrieve').value = '3'; retrieve.click();
  expect(logistics.terminal(terminal.id)!.getItemCount('coal')).toBe(8); // player has no free coal slot
  player.removeItem('iron-ore', 100); ui.update(); expect(retrieve.disabled).toBe(false); input('retrieve').value = '3'; retrieve.click();
  expect(logistics.terminal(terminal.id)!.getItemCount('coal')).toBe(5); expect(player.getItemCount('coal')).toBe(3);
  storageSlot(0).click(); input('retrieve').dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); expect(close).toHaveBeenCalledOnce();
  ui.closePanel(); ui.open(storage.id); expect(input('retrieve').value).toBe(''); expect(input('deposit').value).toBe(''); ui.dispose();
});

it('closes the logistics modal with Escape from selectors, quantity inputs and buttons without leaking the key', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1]!;
  const root = document.querySelector<HTMLElement>('[data-ui="logistics"]')!, items = createDefaultItemRegistry();
  const player = new Inventory(items, 5), buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 19);
  buildings.setCreativeMode(true);
  const logistics = new LogisticsManager(buildings, new MachineManager(buildings, items, () => []), items);
  const storage = buildings.place('storage-container', 0, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  const splitter = buildings.place('splitter', 5, 0, 0, { x: 8, z: 8, radius: .4 }).building!;
  logistics.sync(); logistics.terminal(storage.id)!.addItem('coal', 3); player.addItem('wood', 3);
  const close = vi.fn(), listener = vi.fn(), ui = new LogisticsUI(root, logistics, player, close);
  window.addEventListener('keydown', listener);
  for (const selector of ['[data-storage-filter]', '[data-logistics-deposit-quantity]', '[data-logistics-retrieve-quantity]', '[data-logistics-close]']) {
    ui.open(storage.id);
    const event = new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true });
    root.querySelector<HTMLElement>(selector)!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  ui.open(splitter.id);
  for (const selector of ['[data-splitter-mode]', '[data-splitter-priority]', '[data-splitter-filter="0"]']) {
    root.querySelector<HTMLElement>(selector)!.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
  }
  expect(close).toHaveBeenCalledTimes(7); expect(listener).not.toHaveBeenCalled();
  root.querySelector<HTMLElement>('[data-splitter-mode]')!.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, repeat: true, cancelable: true }));
  expect(close).toHaveBeenCalledTimes(7); expect(listener).not.toHaveBeenCalled();
  ui.closePanel(); ui.dispose(); window.removeEventListener('keydown', listener);
});
