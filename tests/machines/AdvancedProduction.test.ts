import { describe, expect, it } from 'vitest';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { createDefaultRecipeRegistry, RecipeRegistry } from '../../src/production/Recipes';
import { Processor } from '../../src/machines/Processor';
import { ConstructorMachine } from '../../src/machines/ConstructorMachine';
import { BiomassGenerator } from '../../src/power/BiomassGenerator';
import { PowerSimulation } from '../../src/power/PowerSimulation';

describe('phase 9 production primitives', () => {
  it('validates, copies and freezes all extra ingredients', () => {
    const items = createDefaultItemRegistry(), registry = new RecipeRegistry(items);
    const recipe = { id: 'x', name: 'X', input: { itemId: 'iron-plate', quantity: 1 }, additionalInputs: [{ itemId: 'iron-rod', quantity: 2 }], output: { itemId: 'reinforced-component', quantity: 1 }, durationMs: 4000 };
    registry.register(recipe); recipe.additionalInputs[0]!.quantity = 5;
    expect(registry.get('x').additionalInputs![0]!.quantity).toBe(2);
    expect(Object.isFrozen(registry.get('x').additionalInputs)).toBe(true);
    expect(Object.isFrozen(registry.get('x').additionalInputs![0])).toBe(true);
    expect(() => registry.register({ ...recipe, id: 'duplicate', additionalInputs: [{ itemId: 'iron-plate', quantity: 1 }] })).toThrow();
    expect(() => registry.register({ ...recipe, id: 'invalid', additionalInputs: [{ itemId: 'iron-rod', quantity: 0 }] })).toThrow();
    expect(() => registry.register({ ...recipe, id: 'unknown', additionalInputs: [{ itemId: 'not-an-item', quantity: 1 }] })).toThrow();
  });
  it('requires all ingredients and preserves them across blocking and power loss', () => {
    const items = createDefaultItemRegistry(), recipe = createDefaultRecipeRegistry(items).get('reinforced-component');
    const m = new Processor('a', items, recipe);
    m.input.addItem('iron-plate', 2); m.fixedUpdate(10000);
    expect(m.state).toBe('MISSING_INPUT'); expect(m.input.getItemCount('iron-plate')).toBe(2); expect(m.progress).toBe(0);
    m.input.addItem('iron-rod', 2); m.fixedUpdate(2000); expect(m.progress).toBe(.5);
    m.setPowered(false); m.fixedUpdate(9000); expect(m.progress).toBe(.5); expect(m.input.getItemCount('iron-rod')).toBe(2);
    m.setPowered(true); m.output.addItem('reinforced-component', 100); m.fixedUpdate(9000);
    expect(m.state).toBe('OUTPUT_FULL'); expect(m.progress).toBe(.5); expect(m.input.getItemCount('iron-plate')).toBe(2);
    m.output.removeItem('reinforced-component', 100); m.fixedUpdate(6000);
    expect(m.output.getItemCount('reinforced-component')).toBe(2); expect(m.input.usedSlots).toBe(0); expect(m.progress).toBe(0);
  });
  it('splits a multi-input production tick exactly at biomass exhaustion', () => {
    const items = createDefaultItemRegistry(), sim = new PowerSimulation(10), generator = new BiomassGenerator('g', items);
    const m = new Processor('m', items, createDefaultRecipeRegistry(items).get('reinforced-component'));
    m.input.addItem('iron-plate', 10); m.input.addItem('iron-rod', 10); generator.fuel.addItem('wood', 1);
    const p = { x: 0, y: 0, z: 0 }; sim.addPole('p', p); sim.addGenerator(generator, p); sim.addConsumer(m, p, 10000);
    sim.connect('p', 'g'); sim.connect('p', 'm'); sim.fixedUpdate(40000);
    expect(m.output.getItemCount('reinforced-component')).toBe(7); expect(m.progress).toBe(.5);
    expect(m.input.getItemCount('iron-plate')).toBe(3); expect(m.input.getItemCount('iron-rod')).toBe(3); expect(m.state).toBe('NO_POWER');
  });
  it('only changes constructor recipes when buffers are empty and resets partial work', () => {
    const items = createDefaultItemRegistry(), r = createDefaultRecipeRegistry(items);
    const m = new ConstructorMachine('c', items, r.get('iron-plate'), [r.get('iron-rod')]);
    m.input.addItem('iron-ingot', 1); m.fixedUpdate(1000);
    expect(m.selectRecipe('iron-rod')).toBe(false); expect(m.recipe.id).toBe('iron-plate'); expect(m.progress).toBe(.5);
    m.input.removeItem('iron-ingot', 1); expect(m.selectRecipe('iron-rod')).toBe(true); expect(m.progress).toBe(0);
    m.input.addItem('iron-ingot', 2); m.fixedUpdate(4000); expect(m.output.getItemCount('iron-rod')).toBe(2);
    expect(m.selectRecipe('iron-plate')).toBe(false); m.output.removeItem('iron-rod', 2);
    expect(m.selectRecipe('iron-plate')).toBe(true); expect(() => m.selectRecipe('reinforced-component')).toThrow();
  });
});
