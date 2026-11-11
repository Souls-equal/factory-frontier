import { describe, expect, it } from 'vitest';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry, ItemRegistry } from '../../src/items/ItemRegistry';

function setup(size = 3) { const registry = createDefaultItemRegistry(); return new Inventory(registry, size); }

describe('item registry', () => {
  it('defines all six initial resources with unique ids and no water', () => {
    const all = createDefaultItemRegistry().all();
    expect(all.map((item) => item.id)).toEqual(['iron-ore', 'copper-ore', 'limestone', 'coal', 'stone', 'wood']);
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    expect(all.every((item) => item.category === 'RAW_RESOURCE' && item.maxStackSize > 0)).toBe(true);
  });
  it('rejects duplicate ids, invalid definitions, and unknown ids', () => {
    const registry = createDefaultItemRegistry();
    const iron = registry.get('iron-ore');
    expect(() => registry.register(iron)).toThrow();
    expect(() => registry.get('water')).toThrow();
    expect(() => new ItemRegistry().register({ ...iron, maxStackSize: 0 })).toThrow();
  });
  it('accepts a new definition without changing inventory logic', () => {
    const registry = createDefaultItemRegistry();
    registry.register({ id: 'new', name: 'New', description: 'test', category: 'COMPONENT', maxStackSize: 7, icon: 'N' });
    const inventory = new Inventory(registry, 2);
    expect(inventory.addItem('new', 12).moved).toBe(12);
    expect(inventory.snapshot()).toEqual([{ itemId: 'new', quantity: 7 }, { itemId: 'new', quantity: 5 }]);
  });
});

describe('slot inventory', () => {
  it('fills existing stacks first, then empty slots, with correct capacity', () => {
    const inv = setup(); inv.addItem('iron-ore', 80); inv.addItem('iron-ore', 150);
    expect(inv.snapshot().map((s) => s?.quantity)).toEqual([100, 100, 30]);
    expect(inv.getAvailableSpace('iron-ore')).toBe(70);
    expect(inv.getItemCount('iron-ore')).toBe(230);
    expect(inv.hasItem('iron-ore', 230)).toBe(true);
    expect(inv.canAddItem('iron-ore', 71)).toBe(false);
  });
  it('reports partial adds without exceeding capacity', () => {
    const inv = setup(1);
    expect(inv.addItem('iron-ore', 105)).toEqual({ requested: 105, moved: 100, remainder: 5 });
    expect(inv.addItem('copper-ore', 1).moved).toBe(0);
    expect(inv.snapshot()).toEqual([{ itemId: 'iron-ore', quantity: 100 }]);
  });
  it('removes across stacks and reports missing quantities', () => {
    const inv = setup(2); inv.addItem('iron-ore', 150);
    expect(inv.removeItem('iron-ore', 180)).toEqual({ requested: 180, moved: 150, remainder: 30 });
    expect(inv.snapshot()).toEqual([null, null]);
  });
  it('rejects invalid operations without mutation', () => {
    const inv = setup(); inv.addItem('iron-ore', 8); const before = inv.snapshot();
    for (const n of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => inv.addItem('iron-ore', n)).toThrow();
      expect(() => inv.removeItem('iron-ore', n)).toThrow();
    }
    expect(() => inv.addItem('invalid', 1)).toThrow();
    expect(() => inv.removeItem('invalid', 1)).toThrow();
    expect(() => inv.moveStack(-1, 2)).toThrow();
    expect(inv.snapshot()).toEqual(before);
  });
  it('transfers partially and conserves both inventories', () => {
    const a = setup(2), b = setup(1); a.addItem('iron-ore', 90); b.addItem('iron-ore', 80);
    expect(a.transferItem(b, 'iron-ore', 70)).toEqual({ requested: 70, moved: 20, remainder: 50 });
    expect(a.getItemCount('iron-ore') + b.getItemCount('iron-ore')).toBe(170);
    expect(a.transferItem(b, 'iron-ore', 1).moved).toBe(0);
    expect(a.transferItem(a, 'iron-ore', 1).moved).toBe(0);
  });
  it('splits stacks, merges partially and conserves items', () => {
    const inv = setup(3); inv.addItem('iron-ore', 100);
    expect(inv.splitStack(0, 40)).toBe(40);
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([60, 40, 0]);
    inv.addItem('iron-ore', 60);
    expect(inv.mergeStacks(1, 0)).toBe(0);
    expect(inv.mergeStacks(0, 1)).toBe(40);
    expect(inv.getItemCount('iron-ore')).toBe(160);
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([60, 100, 0]);
  });
  it('leaves incompatible or full-slot moves unchanged', () => {
    const inv = setup(2); inv.addItem('iron-ore', 40); inv.addItem('coal', 20);
    const before = inv.snapshot();
    expect(inv.moveStack(0, 1)).toBe(0);
    expect(inv.splitStack(0, 10)).toBe(0);
    expect(() => inv.splitStack(0, 40)).toThrow();
    expect(inv.snapshot()).toEqual(before);
  });
  it('returns snapshots that cannot mutate inventory state', () => {
    const inv = setup(); inv.addItem('iron-ore', 3);
    const snapshot = inv.snapshot() as Array<{ itemId: string; quantity: number } | null>;
    if (snapshot[0]) snapshot[0].quantity = 99;
    expect(inv.getItemCount('iron-ore')).toBe(3);
  });
});

describe('inventory conservation under repeated operations', () => {
  it('preserves quantities through many moves and partial transfers', () => {
    const registry = createDefaultItemRegistry();
    const a = new Inventory(registry, 5), b = new Inventory(registry, 4);
    a.addItem('iron-ore', 275); b.addItem('iron-ore', 25);
    let seed = 54321;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let i = 0; i < 1000; i++) {
      const source = (random() % 2) ? a : b;
      const destination = source === a ? b : a;
      source.transferItem(destination, 'iron-ore', random() % 50 + 1);
      const from = random() % source.capacity, to = random() % source.capacity;
      source.moveStack(from, to);
      expect(a.getItemCount('iron-ore') + b.getItemCount('iron-ore')).toBe(300);
      for (const item of [...a.snapshot(), ...b.snapshot()]) {
        if (item) expect(item.quantity).toBeGreaterThan(0);
        if (item) expect(item.quantity).toBeLessThanOrEqual(registry.get(item.itemId).maxStackSize);
      }
    }
  });
});
