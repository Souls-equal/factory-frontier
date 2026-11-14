import { describe, expect, it } from 'vitest';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { createDefaultRecipeRegistry } from '../../src/production/Recipes';
import { ConstructorMachine } from '../../src/machines/ConstructorMachine';
import { Smelter } from '../../src/machines/Smelter';
import { Miner } from '../../src/machines/Miner';
import type { MachineManager } from '../../src/machines/MachineManager';
import { ProductionHistory } from '../../src/statistics/ProductionHistory';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

function setup() {
  const items = createDefaultItemRegistry(), recipes = createDefaultRecipeRegistry(items);
  const constructor = new ConstructorMachine('c', items, recipes.get('iron-plate'), [recipes.get('iron-rod')]);
  const smelter = new Smelter('s', items, recipes.get('iron-ingot'));
  const deposit: ResourceDeposit = { id: 'd', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: 1, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
  const miner = new Miner('m', 'd', 'iron-ore', () => deposit, items);
  let paused = false;
  const constructors = [constructor], smelters = [smelter], miners = [miner];
  const manager = { all: () => miners, allSmelters: () => smelters, allConstructors: () => constructors, allAdvanced: () => [] } as unknown as MachineManager;
  const history = new ProductionHistory(manager, items, () => paused);
  const tick = (ms: number) => { if (!paused) { miner.fixedUpdate(ms); smelter.fixedUpdate(ms); constructor.fixedUpdate(ms); } history.fixedUpdate(ms); };
  return { items, constructor, smelter, miner, constructors, history, tick, pause: (value: boolean) => { paused = value; } };
}

describe('rolling factory production history', () => {
  it('counts completed outputs, committed inputs and extraction once, with startup-scaled rates', () => {
    const s = setup(); s.constructor.input.addItem('iron-ingot', 2); s.smelter.input.addItem('iron-ore', 1); s.smelter.fuel.addItem('coal', 1);
    s.tick(1000); expect(s.history.snapshot()).toEqual([]); s.tick(1000);
    const byId = new Map(s.history.snapshot().map(r => [r.itemId, r]));
    expect(byId.get('iron-plate')).toMatchObject({ produced: 1, producedPerMinute: 30, consumed: 0 });
    expect(byId.get('iron-ingot')).toMatchObject({ produced: 1, consumed: 1, producedPerMinute: 30, consumedPerMinute: 30 });
    expect(byId.get('coal')).toMatchObject({ consumed: 1, consumedPerMinute: 30 });
    expect(byId.get('iron-ore')).toMatchObject({ produced: 1, extracted: 1, consumed: 1, extractedPerMinute: 30 });
    s.tick(100); expect(s.history.snapshot().find(r => r.itemId === 'iron-plate')?.produced).toBe(1);
  });
  it('keeps samples during pause and retains completed history after demolition until it expires', () => {
    const s = setup(); s.constructor.input.addItem('iron-ingot', 1); s.tick(2000);
    s.pause(true); const before = s.history.snapshot(); s.tick(100000); expect(s.history.elapsedMs).toBe(2000); expect(s.history.snapshot()).toEqual(before);
    s.pause(false); s.constructors.splice(0); s.tick(1000); expect(s.history.snapshot().find(r => r.itemId === 'iron-plate')?.produced).toBe(1);
    s.miner.setEnabled(false); s.tick(59000); expect(s.history.snapshot().find(r => r.itemId === 'iron-plate')).toBeUndefined();
    expect(() => s.history.fixedUpdate(-1)).toThrow();
  });
  it('tracks recipe changes and ignores inventory transfers and manual output insertion', () => {
    const s = setup(); s.constructor.input.addItem('iron-ingot', 1); s.tick(2000);
    s.constructor.output.removeItem('iron-plate', 1); expect(s.constructor.selectRecipe('iron-rod')).toBe(true);
    s.constructor.input.addItem('iron-ingot', 1); s.tick(2000);
    s.constructor.output.addItem('iron-rod', 4); s.tick(50);
    expect(s.history.snapshot().find(r => r.itemId === 'iron-plate')?.produced).toBe(1);
    expect(s.history.snapshot().find(r => r.itemId === 'iron-rod')?.produced).toBe(1);
    expect(s.history.snapshot().find(r => r.itemId === 'iron-ingot')?.consumed).toBe(2);
  });
});
