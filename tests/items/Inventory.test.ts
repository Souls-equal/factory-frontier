import { describe, expect, it } from 'vitest';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry, ItemRegistry } from '../../src/items/ItemRegistry';

function setup(size = 3) { const registry = createDefaultItemRegistry(); return new Inventory(registry, size); }

describe('item registry', () => {
  it('defines six raw resources and the processed iron ingot with unique ids and no water', () => {
    const all = createDefaultItemRegistry().all();
    expect(all.filter((item) => item.category === 'RAW_RESOURCE').map((item) => item.id)).toEqual(['iron-ore', 'copper-ore', 'limestone', 'coal', 'stone', 'wood']);
    expect(all.find((item) => item.id === 'iron-ingot')?.category).toBe('PROCESSED_RESOURCE');
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    expect(all.every((item) => item.maxStackSize > 0)).toBe(true);
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

describe('atomic slot swaps', () => {
  it('swaps incompatible full stacks and preserves counts and stack limits', () => {
    const inventory = setup(2);
    inventory.addItem('iron-ore', 100); inventory.addItem('coal', 47);
    const revision = inventory.revision;
    expect(inventory.swapSlots(0, 1)).toBe(true);
    expect(inventory.snapshot()).toEqual([{ itemId: 'coal', quantity: 47 }, { itemId: 'iron-ore', quantity: 100 }]);
    expect(inventory.getItemCount('iron-ore')).toBe(100);
    expect(inventory.getItemCount('coal')).toBe(47);
    expect(inventory.revision).toBe(revision + 1);
  });
  it('rejects invalid indices without mutation and ignores empty or identical slots', () => {
    const inventory = setup(2); inventory.addItem('wood', 7);
    const before = inventory.snapshot(); const revision = inventory.revision;
    expect(() => inventory.swapSlots(0, 2)).toThrow(RangeError);
    expect(inventory.swapSlots(0, 0)).toBe(false);
    expect(inventory.swapSlots(0, 1)).toBe(false);
    expect(inventory.snapshot()).toEqual(before);
    expect(inventory.revision).toBe(revision);
  });
});

describe('selected stack transfers', () => {
  it('moves only the chosen stack, even when an earlier stack holds the same item', () => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 4), dest = new Inventory(items, 2);
    source.addItem('iron-ore', 150); source.addItem('coal', 3); dest.addItem('iron-ore', 85); dest.addItem('stone', 100);
    const s = source.revision, d = dest.revision;
    expect(source.transferStack(dest, 1)).toEqual({ requested: 50, moved: 15, remainder: 35 });
    expect(source.snapshot()).toEqual([{ itemId: 'iron-ore', quantity: 100 }, { itemId: 'iron-ore', quantity: 35 }, { itemId: 'coal', quantity: 3 }, null]);
    expect(dest.getItemCount('iron-ore')).toBe(100); expect(source.revision).toBe(s + 1); expect(dest.revision).toBe(d + 1);
    expect(source.transferStack(dest, 1)).toEqual({ requested: 35, moved: 0, remainder: 35 });
    expect(source.revision).toBe(s + 1); expect(dest.revision).toBe(d + 1);
    dest.removeItem('iron-ore', 100); expect(source.transferStack(dest, 1)).toEqual({ requested: 35, moved: 35, remainder: 0 });
    expect(source.snapshot()[0]?.quantity).toBe(100); expect(source.snapshot()[1]).toBeNull();
  });
  it('handles empty, self-transfer, invalid indices and incompatible registries without mutations', () => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 2), dest = new Inventory(new ItemRegistry(), 1);
    source.addItem('wood', 5); const before = source.snapshot(), rev = source.revision;
    expect(source.transferStack(dest, 1)).toEqual({ requested: 0, moved: 0, remainder: 0 });
    expect(source.transferStack(source, 0)).toEqual({ requested: 5, moved: 0, remainder: 5 });
    for (const index of [-1, 2, 1.5, NaN]) expect(() => source.transferStack(dest, index)).toThrow(RangeError);
    expect(() => source.transferStack(dest, 0)).toThrow(RangeError);
    expect(source.snapshot()).toEqual(before); expect(source.revision).toBe(rev); expect(dest.usedSlots).toBe(0); expect(dest.revision).toBe(0);
  });
  it('conserves items and respects differing destination stack limits', () => {
    const srcItems = createDefaultItemRegistry(), dstItems = new ItemRegistry();
    dstItems.register({ ...srcItems.get('coal'), maxStackSize: 7 });
    const a = new Inventory(srcItems, 3), b = new Inventory(dstItems, 2); a.addItem('coal', 50);
    expect(a.transferStack(b, 0)).toEqual({ requested: 50, moved: 14, remainder: 36 });
    expect(a.getItemCount('coal') + b.getItemCount('coal')).toBe(50);
    expect(b.snapshot().map((s) => s?.quantity)).toEqual([7,7]);
  });
  it('conserves all materials through repeated slot transfers in both directions', () => {
    const items = createDefaultItemRegistry(), a = new Inventory(items, 5), b = new Inventory(items, 4);
    a.addItem('iron-ore', 275); a.addItem('coal', 80); b.addItem('coal', 25);
    let seed = 918273; const rand = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    for (let i = 0; i < 1000; i++) {
      const src = rand() % 2 ? a : b, dst = src === a ? b : a;
      src.transferStack(dst, rand() % src.capacity);
      expect(a.getItemCount('iron-ore') + b.getItemCount('iron-ore')).toBe(275);
      expect(a.getItemCount('coal') + b.getItemCount('coal')).toBe(105);
      for (const stack of [...a.snapshot(), ...b.snapshot()]) if (stack) expect(stack.quantity).toBeGreaterThan(0);
    }
  });
});

describe('quantity-limited selected stack transfers', () => {
  it('moves only the requested amount of the exact stack and reports capacity remainder', () => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 3), dest = new Inventory(items, 1);
    source.addItem('iron-ore', 150); dest.addItem('iron-ore', 90);
    expect(source.transferStack(dest, 1, 20)).toEqual({ requested: 20, moved: 10, remainder: 10 });
    expect(source.snapshot().map(s => s?.quantity ?? 0)).toEqual([100, 40, 0]);
    expect(dest.getItemCount('iron-ore')).toBe(100);
    const revisions = [source.revision, dest.revision];
    expect(source.transferStack(dest, 1, 1)).toEqual({ requested: 1, moved: 0, remainder: 1 });
    expect([source.revision, dest.revision]).toEqual(revisions);
    dest.removeItem('iron-ore', 100);
    expect(source.transferStack(dest, 1, 7)).toEqual({ requested: 7, moved: 7, remainder: 0 });
    expect(source.snapshot()[1]?.quantity).toBe(33);
    expect(source.getItemCount('iron-ore') + dest.getItemCount('iron-ore')).toBe(140);
  });
  it('validates quantities without mutations and handles self and empty slots', () => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 2), dest = new Inventory(items, 1);
    source.addItem('wood', 5); const before = source.snapshot(), revision = source.revision;
    for (const n of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 6]) {
      expect(() => source.transferStack(dest, 0, n)).toThrow(RangeError);
    }
    expect(source.transferStack(source, 0, 3)).toEqual({ requested: 3, moved: 0, remainder: 3 });
    expect(source.transferStack(dest, 1, 3)).toEqual({ requested: 3, moved: 0, remainder: 3 });
    expect(source.snapshot()).toEqual(before); expect(source.revision).toBe(revision); expect(dest.revision).toBe(0);
  });
});
