import { describe, expect, it } from 'vitest';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { createDefaultRecipeRegistry } from '../../src/production/Recipes';
import { ConstructorMachine } from '../../src/machines/ConstructorMachine';
import { Smelter } from '../../src/machines/Smelter';
import { Miner } from '../../src/machines/Miner';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

describe('machine lifetime production statistics', () => {
  it('counts actual work and inputs, including partial work and idle time, independent of tick size', () => {
    const items = createDefaultItemRegistry(), r = createDefaultRecipeRegistry(items);
    const a = new ConstructorMachine('a', items, r.get('iron-plate'));
    const b = new ConstructorMachine('b', items, r.get('iron-plate'));
    for (const m of [a,b]) m.input.addItem('iron-ingot', 2);
    a.fixedUpdate(10000); for (let i=0; i<100; i++) b.fixedUpdate(100);
    for (const m of [a,b]) {
      expect(m.elapsedMs).toBe(10000); expect(m.produced('iron-plate')).toBe(2); expect(m.consumed('iron-ingot')).toBe(2);
      expect(m.productionRate('iron-plate')).toBe(12); expect(m.consumptionRate('iron-ingot')).toBe(12); expect(m.utilization).toBeCloseTo(.4);
      m.setPowered(false); m.input.addItem('iron-ingot', 1); m.fixedUpdate(10000); expect(m.utilization).toBeCloseTo(.2);
    }
  });
  it('counts smelter coal only on a committed cycle', () => {
    const items = createDefaultItemRegistry(), m = new Smelter('s', items, createDefaultRecipeRegistry(items).get('iron-ingot'));
    m.input.addItem('iron-ore', 1); m.fuel.addItem('coal', 1); m.fixedUpdate(1000);
    expect(m.consumed('coal')).toBe(0); m.fixedUpdate(1000);
    expect(m.consumed('coal')).toBe(1); expect(m.consumed('iron-ore')).toBe(1); expect(m.produced('iron-ingot')).toBe(1);
  });
  it('tracks mining extraction and exact full-output utilization', () => {
    const items = createDefaultItemRegistry();
    const deposit: ResourceDeposit = { id:'d', itemId:'iron-ore', x:0,y:0,z:0,radius:1,purity:'normal',productionMultiplier:1,extractionCompatible:true };
    const m = new Miner('m','d','iron-ore',() => deposit, items); m.output.addItem('iron-ore', 99);
    m.fixedUpdate(10000); expect(m.produced).toBe(1); expect(m.productionRate).toBe(6); expect(m.utilization).toBeCloseTo(.2);
    m.fixedUpdate(10000); expect(m.produced).toBe(1); expect(m.utilization).toBeCloseTo(.1);
  });
});
