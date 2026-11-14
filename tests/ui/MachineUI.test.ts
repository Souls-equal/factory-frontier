// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MachineUI } from '../../src/ui/MachineUI';
import { Miner } from '../../src/machines/Miner';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

describe('machine inspection UI', () => {
  it('shows actual state, transfers only what fits, disables and closes without losing state', () => {
    document.body.innerHTML = '<section hidden><div data-machine-details></div><button data-machine-close>Close</button><button data-machine-toggle></button><button data-machine-retrieve></button><p data-machine-notice></p></section>';
    const root = document.querySelector('section')!, items = createDefaultItemRegistry();
    const deposit: ResourceDeposit = { id: 'd', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'pure', productionMultiplier: 2, extractionCompatible: true };
    const miner = new Miner('m', 'd', 'iron-ore', () => deposit, items); miner.fixedUpdate(10000);
    const player = new Inventory(items, 1); player.addItem('iron-ore', 95);
    const close = vi.fn(); const ui = new MachineUI(root, player, close); ui.open(miner);
    expect(root.textContent).toContain('RUNNING'); expect(root.textContent).toContain('pure'); expect(root.textContent).toContain('60 items/min');
    expect(root.textContent).toContain('Output: 10 / 100');
    root.querySelector<HTMLButtonElement>('[data-machine-retrieve]')!.click();
    expect(root.textContent).toContain('Transferred 5; 5 remain');
    expect(miner.output.getItemCount('iron-ore')).toBe(5); expect(player.getItemCount('iron-ore')).toBe(100);
    root.querySelector<HTMLButtonElement>('[data-machine-toggle]')!.click(); expect(miner.state).toBe('DISABLED');
    expect(root.textContent).toContain('DISABLED'); root.querySelector<HTMLButtonElement>('[data-machine-close]')!.click(); expect(close).toHaveBeenCalledOnce();
    ui.closePanel(); expect(miner.output.getItemCount('iron-ore')).toBe(5); expect(ui.isOpen).toBe(false); ui.dispose();
  });
});

it('inspects a smelter and safely feeds and retrieves both buffers', async () => {
  const { Smelter } = await import('../../src/machines/Smelter');
  const { createDefaultRecipeRegistry } = await import('../../src/production/Recipes');
  document.body.innerHTML = '<section hidden><h2 data-machine-title></h2><div data-machine-details></div><button data-machine-close>Close</button><div><button data-machine-toggle></button><button data-machine-retrieve></button></div><p data-machine-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), player = new Inventory(items, 3);
  const s = new Smelter('s', items, createDefaultRecipeRegistry(items).get('iron-ingot'));
  player.addItem('iron-ore', 10); player.addItem('coal', 2); const ui = new MachineUI(root, player, vi.fn()); ui.open(s);
  expect(root.querySelector('[data-machine-title]')!.textContent).toBe('Smelter');
  expect(root.textContent).toContain('Iron Ore + 1 Coal → 1 Iron Ingot');
  root.querySelector<HTMLButtonElement>('[data-machine-feed]')!.click(); expect(s.input.getItemCount('iron-ore')).toBe(10);
  expect(root.textContent).toContain('NO_POWER');
  root.querySelector<HTMLButtonElement>('[data-machine-feed-fuel]')!.click(); expect(s.fuel.getItemCount('coal')).toBe(2);
  s.fixedUpdate(2000); ui.update(); root.querySelector<HTMLButtonElement>('[data-machine-retrieve]')!.click();
  expect(player.getItemCount('iron-ingot')).toBe(1);
  root.querySelector<HTMLButtonElement>('[data-machine-retrieve-input]')!.click(); expect(player.getItemCount('iron-ore')).toBe(9);
  root.querySelector<HTMLButtonElement>('[data-machine-retrieve-fuel]')!.click(); expect(player.getItemCount('coal')).toBe(1);
  ui.dispose();
});

it('inspects a constructor, shows its recipe, and transfers input and plates', async () => {
  const { ConstructorMachine } = await import('../../src/machines/ConstructorMachine');
  const { createDefaultRecipeRegistry } = await import('../../src/production/Recipes');
  document.body.innerHTML = '<section hidden><h2 data-machine-title></h2><div data-machine-details></div><button data-machine-close>Close</button><div><button data-machine-toggle></button><button data-machine-retrieve></button></div><p data-machine-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), player = new Inventory(items, 3);
  const m = new ConstructorMachine('c', items, createDefaultRecipeRegistry(items).get('iron-plate'));
  player.addItem('iron-ingot', 3); const ui = new MachineUI(root, player, vi.fn()); ui.open(m);
  expect(root.querySelector('[data-machine-title]')!.textContent).toBe('Constructor');
  expect(root.textContent).toContain('1 Iron Ingot → 1 Iron Plate');
  expect(root.textContent).toContain('Produced by this machine (Iron Plate): 0');
  expect(root.querySelector<HTMLButtonElement>('[data-machine-feed-fuel]')!.hidden).toBe(true);
  expect(root.querySelector('[data-machine-feed]')!.textContent).toBe('Add Iron Ingot');
  root.querySelector<HTMLButtonElement>('[data-machine-feed]')!.click(); m.fixedUpdate(2000); ui.update();
  expect(root.textContent).toContain('Produced by this machine (Iron Plate): 1');
  root.querySelector<HTMLButtonElement>('[data-machine-retrieve]')!.click(); expect(player.getItemCount('iron-plate')).toBe(1);
  root.querySelector<HTMLButtonElement>('[data-machine-retrieve-input]')!.click(); expect(player.getItemCount('iron-ingot')).toBe(2);
  ui.dispose();
});

it('inspects a generator and pole, transfers wood and shows live network statistics', async () => {
  const { BiomassGenerator } = await import('../../src/power/BiomassGenerator');
  document.body.innerHTML = '<section hidden><h2 data-machine-title></h2><div data-machine-details></div><button data-machine-close>Close</button><div><button data-machine-toggle></button><button data-machine-retrieve></button></div><p data-machine-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), player = new Inventory(items, 2);
  const generator = new BiomassGenerator('g', items); player.addItem('wood', 3);
  const network = vi.fn(() => ({ id: 'p', poles: ['p'], generators: ['g'], consumers: ['m'], capacityWatts: 30000,
    availableWatts: generator.ready ? 30000 : 0, demandWatts: 10000, suppliedWatts: generator.ready ? 10000 : 0,
    shortfallWatts: generator.ready ? 0 : 10000, status: generator.ready ? 'online' as const : 'offline' as const }));
  const ui = new MachineUI(root, player, vi.fn(), network); ui.openPower('g', generator);
  expect(root.textContent).toContain('Biomass Generator'); expect(root.textContent).toContain('Network: offline');
  expect(root.textContent).toContain('Cyan rear input accepts wood');
  root.querySelector<HTMLButtonElement>('[data-machine-feed-fuel]')!.click();
  expect(generator.fuel.getItemCount('wood')).toBe(3); expect(root.textContent).toContain('Network: online');
  expect(root.textContent).toContain('Supply: 10 kW'); expect(root.textContent).toContain('Demand: 10 kW');
  root.querySelector<HTMLButtonElement>('[data-machine-toggle]')!.click(); expect(root.textContent).toContain('Network: offline');
  root.querySelector<HTMLButtonElement>('[data-machine-retrieve-fuel]')!.click(); expect(player.getItemCount('wood')).toBe(3);
  ui.openPower('p'); expect(root.textContent).toContain('Power Pole'); expect(root.textContent).toContain('nearest pole');
  expect(root.querySelector<HTMLButtonElement>('[data-machine-feed-fuel]')!.hidden).toBe(true);
  expect(root.querySelector<HTMLButtonElement>('[data-machine-toggle]')!.hidden).toBe(true);
  ui.dispose();
});

it('changes constructor recipes only after buffers are empty, without discarding items', async () => {
  const { ConstructorMachine } = await import('../../src/machines/ConstructorMachine');
  const { createDefaultRecipeRegistry } = await import('../../src/production/Recipes');
  document.body.innerHTML = '<section hidden><h2 data-machine-title></h2><div data-machine-details></div><button data-machine-close>Close</button><div><button data-machine-toggle></button><button data-machine-retrieve></button></div><p data-machine-notice></p></section>';
  const root = document.querySelector('section')!, items = createDefaultItemRegistry(), player = new Inventory(items, 3);
  const recipes = createDefaultRecipeRegistry(items), machine = new ConstructorMachine('c', items, recipes.get('iron-plate'), [recipes.get('iron-rod')]);
  const ui = new MachineUI(root, player, vi.fn()); ui.open(machine);
  const selector = root.querySelector<HTMLSelectElement>('[data-machine-recipe]')!;
  expect(selector.value).toBe('iron-plate'); expect(selector.options).toHaveLength(2);
  machine.input.addItem('iron-ingot', 1); machine.fixedUpdate(1000);
  selector.value = 'iron-rod'; selector.dispatchEvent(new Event('change'));
  expect(selector.value).toBe('iron-plate'); expect(root.textContent).toContain('Empty both input and output');
  expect(machine.input.getItemCount('iron-ingot')).toBe(1); expect(machine.progress).toBe(.5);
  root.querySelector<HTMLButtonElement>('[data-machine-retrieve-input]')!.click();
  selector.value = 'iron-rod'; selector.dispatchEvent(new Event('change'));
  expect(machine.recipe.id).toBe('iron-rod'); expect(machine.progress).toBe(0); expect(root.textContent).toContain('Iron Rod');
  root.querySelector<HTMLButtonElement>('[data-machine-feed]')!.click(); machine.fixedUpdate(2000); ui.update();
  root.querySelector<HTMLButtonElement>('[data-machine-retrieve]')!.click(); expect(player.getItemCount('iron-rod')).toBe(1);
  ui.dispose();
});
