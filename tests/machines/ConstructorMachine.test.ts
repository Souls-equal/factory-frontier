import { describe, expect, it } from 'vitest';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
import { ConstructorMachine } from '../../src/machines/ConstructorMachine';
import { createDefaultRecipeRegistry } from '../../src/production/Recipes';

function setup() {
  const items = createDefaultItemRegistry(), recipe = createDefaultRecipeRegistry(items).get('iron-plate');
  return { items, machine: new ConstructorMachine('c', items, recipe) };
}
describe('constructor', () => {
  it('converts one ingot into one plate in two seconds', () => {
    const { machine: m } = setup(); expect(m.state).toBe('MISSING_INPUT');
    m.input.addItem('iron-ingot', 3); m.fixedUpdate(1999); expect(m.output.getItemCount('iron-plate')).toBe(0);
    m.fixedUpdate(4001); expect(m.output.getItemCount('iron-plate')).toBe(3);
    expect(m.input.getItemCount('iron-ingot')).toBe(0); expect(m.progress).toBe(0); expect(m.state).toBe('MISSING_INPUT');
  });
  it('retains progress while disabled or output full and never catches up idle time', () => {
    const { machine: m } = setup(); m.input.addItem('iron-ingot', 3); m.fixedUpdate(1000);
    m.setEnabled(false); m.fixedUpdate(50000); expect(m.progress).toBe(.5);
    m.setEnabled(true); m.output.addItem('iron-plate', 100); m.fixedUpdate(10000);
    expect(m.state).toBe('OUTPUT_FULL'); expect(m.input.getItemCount('iron-ingot')).toBe(3); expect(m.progress).toBe(.5);
    m.output.removeItem('iron-plate', 1); m.fixedUpdate(1000); expect(m.output.getItemCount('iron-plate')).toBe(100);
    expect(m.input.getItemCount('iron-ingot')).toBe(2);
  });
  it('supports safe partial manual input and recovery', () => {
    const { machine: m, items } = setup(), player = new Inventory(items, 1);
    player.addItem('iron-ingot', 100); m.input.addItem('iron-ingot', 90);
    expect(m.feed(player).moved).toBe(10); expect(m.retrieveInput(player).moved).toBe(10);
    expect(player.getItemCount('iron-ingot') + m.input.getItemCount('iron-ingot')).toBe(190);
    expect(() => m.fixedUpdate(-1)).toThrow(); expect(() => m.fixedUpdate(NaN)).toThrow();
  });
});
