// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { createInventorySlot } from '../../src/ui/InventorySlot';
import { itemIcon } from '../../src/ui/ItemIcons';

describe('shared inventory slot artwork', () => {
  it('provides unique local artwork and accessible counts for every default item', () => {
    const registry = createDefaultItemRegistry(), inventory = new Inventory(registry, 8);
    const definitions = registry.all();
    expect(definitions.map(item => item.id)).toEqual(expect.arrayContaining(['iron-rod', 'reinforced-component']));
    const urls = definitions.map(item => itemIcon(item.id));
    expect(urls.every(url => typeof url === 'string' && url.length > 0)).toBe(true);
    expect(new Set(urls).size).toBe(definitions.length);
    for (const item of definitions) {
      const slot = createInventorySlot(document, inventory, { itemId: item.id, quantity: 37 }, 0);
      expect(slot.querySelector('img')?.getAttribute('src')).toBe(itemIcon(item.id));
      expect(slot.querySelector('img')?.alt).toBe('');
      expect(slot.querySelector('img')?.draggable).toBe(false);
      expect(slot.querySelector('.inventory__slot-count')?.textContent).toBe('37');
      expect(slot.getAttribute('aria-label')).toBe(`${item.name}, 37 of ${item.maxStackSize}`);
      expect(slot.title).toContain(item.name);
    }
  });
  it('keeps empty slots visually empty but accessible and uses text for custom items', () => {
    const registry = createDefaultItemRegistry();
    registry.register({ id: '__proto__', name: 'Custom', description: '', category: 'COMPONENT', maxStackSize: 10, icon: 'X' });
    const inventory = new Inventory(registry, 2);
    const empty = createInventorySlot(document, inventory, null, 1);
    expect(empty.textContent).toBe(''); expect(empty.getAttribute('aria-label')).toBe('Empty slot 2');
    const custom = createInventorySlot(document, inventory, { itemId: '__proto__', quantity: 2 }, 0);
    expect(custom.querySelector('img')).toBeNull();
    expect(custom.querySelector('.inventory__slot-fallback')?.textContent).toBe('X');
    expect(custom.getAttribute('aria-label')).toBe('Custom, 2 of 10');
  });
});
