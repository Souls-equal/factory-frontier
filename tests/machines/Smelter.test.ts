import { describe, expect, it } from 'vitest';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
import { Smelter } from '../../src/machines/Smelter';
import { createDefaultRecipeRegistry, RecipeRegistry } from '../../src/production/Recipes';

function setup() {
  const items = createDefaultItemRegistry(), recipe = createDefaultRecipeRegistry(items).get('iron-ingot');
  return { items, recipe, smelter: new Smelter('smelter', items, recipe) };
}
describe('iron smelter', () => {
  it('consumes one ore and makes one ingot per two seconds on the simulation clock', () => {
    const { smelter: s } = setup(); expect(s.state).toBe('MISSING_INPUT'); s.input.addItem('iron-ore', 3); s.fuel.addItem('coal', 3);
    s.fixedUpdate(1999); expect(s.output.getItemCount('iron-ingot')).toBe(0);
    s.fixedUpdate(4001); expect(s.output.getItemCount('iron-ingot')).toBe(3); expect(s.input.getItemCount('iron-ore')).toBe(0);
    expect(s.state).toBe('MISSING_INPUT'); expect(s.progress).toBe(0);
  });
  it('stops without consuming ingredients when output is full and resumes without catch-up', () => {
    const { smelter: s } = setup(); s.input.addItem('iron-ore', 5); s.fuel.addItem('coal', 5); s.output.addItem('iron-ingot', 100);
    s.fixedUpdate(50000); expect(s.input.getItemCount('iron-ore')).toBe(5); expect(s.state).toBe('OUTPUT_FULL');
    s.output.removeItem('iron-ingot', 1); s.fixedUpdate(1999); expect(s.output.getItemCount('iron-ingot')).toBe(99);
    s.fixedUpdate(1); expect(s.output.getItemCount('iron-ingot')).toBe(100); expect(s.input.getItemCount('iron-ore')).toBe(4);
  });
  it('pauses progress while disabled and supports partial manual transfers', () => {
    const { smelter: s, items } = setup(); const player = new Inventory(items, 1); player.addItem('iron-ore', 100);
    expect(s.feed(player).moved).toBe(100); s.fuel.addItem('coal', 1); s.fixedUpdate(1000); s.setEnabled(false); s.fixedUpdate(8000);
    expect(s.progress).toBe(.5); expect(s.state).toBe('DISABLED'); s.setEnabled(true); s.fixedUpdate(1000);
    expect(s.retrieve(player).moved).toBe(1); expect(s.retrieveInput(player).moved).toBe(0);
  });
  it('validates recipes, item references and immutability', () => {
    const { items, recipe } = setup(), registry = new RecipeRegistry(items);
    expect(() => registry.register({ ...recipe, durationMs: 0 })).toThrow();
    expect(() => registry.register({ ...recipe, input: { itemId: 'unknown', quantity: 1 } })).toThrow();
    registry.register(recipe); expect(() => registry.register(recipe)).toThrow();
    expect(Object.isFrozen(registry.get(recipe.id).input)).toBe(true);
    expect(() => new Smelter('bad', items, { ...recipe, durationMs: NaN })).toThrow();
  });
  it('rejects invalid time without changing buffers', () => {
    const { smelter: s } = setup(); s.input.addItem('iron-ore', 2);
    expect(() => s.fixedUpdate(NaN)).toThrow(); expect(() => s.fixedUpdate(-1)).toThrow();
    expect(s.input.getItemCount('iron-ore')).toBe(2);
  });
});

it('requires coal, consumes one per ingot and resumes without idle catch-up', () => {
  const { smelter: s } = setup(); s.input.addItem('iron-ore', 5);
  expect(s.state).toBe('NO_POWER'); s.fixedUpdate(50000);
  expect(s.progress).toBe(0); expect(s.input.getItemCount('iron-ore')).toBe(5);
  s.fuel.addItem('coal', 2); s.fixedUpdate(10000);
  expect(s.output.getItemCount('iron-ingot')).toBe(2); expect(s.fuel.getItemCount('coal')).toBe(0);
  expect(s.input.getItemCount('iron-ore')).toBe(3); expect(s.state).toBe('NO_POWER');
  s.fuel.addItem('coal', 1); s.fixedUpdate(1999); expect(s.output.getItemCount('iron-ingot')).toBe(2);
  s.fixedUpdate(1); expect(s.output.getItemCount('iron-ingot')).toBe(3); expect(s.fuel.getItemCount('coal')).toBe(0);
});

it('preserves coal and progress on interruption, empty input, full output and disabled machine', () => {
  const { smelter: s } = setup(); s.fuel.addItem('coal', 3);
  s.fixedUpdate(10000); expect(s.fuel.getItemCount('coal')).toBe(3); expect(s.state).toBe('MISSING_INPUT');
  s.input.addItem('iron-ore', 3); s.fixedUpdate(1000); expect(s.progress).toBe(.5);
  s.fuel.removeItem('coal', 3); s.fixedUpdate(10000); expect(s.progress).toBe(.5); expect(s.state).toBe('NO_POWER');
  s.fuel.addItem('coal', 3); s.output.addItem('iron-ingot', 100); s.fixedUpdate(10000);
  expect(s.state).toBe('OUTPUT_FULL'); expect(s.fuel.getItemCount('coal')).toBe(3); expect(s.progress).toBe(.5);
  s.output.removeItem('iron-ingot', 1); s.setEnabled(false); s.fixedUpdate(10000); expect(s.fuel.getItemCount('coal')).toBe(3);
  s.setEnabled(true); s.fixedUpdate(1000); expect(s.fuel.getItemCount('coal')).toBe(2); expect(s.output.getItemCount('iron-ingot')).toBe(100);
});

it('transfers coal partially without deleting or duplicating it', () => {
  const { smelter: s, items } = setup(), player = new Inventory(items, 1);
  player.addItem('coal', 100); s.fuel.addItem('coal', 90);
  expect(s.feedFuel(player)).toEqual({ requested: 100, moved: 10, remainder: 90 });
  expect(s.retrieveFuel(player)).toEqual({ requested: 100, moved: 10, remainder: 90 });
  expect(player.getItemCount('coal') + s.fuel.getItemCount('coal')).toBe(190);
});
