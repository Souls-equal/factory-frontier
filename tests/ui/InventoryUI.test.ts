// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { InventoryUI } from '../../src/ui/InventoryUI';

function create() {
  document.body.innerHTML = `<section hidden><button data-inventory-close>Close</button><div data-inventory-grid></div>
    <p data-inventory-detail></p><p data-inventory-capacity></p><button data-inventory-split>Split</button></section>`;
  const root = document.querySelector('section')!;
  const inv = new Inventory(createDefaultItemRegistry(), 3);
  const close = vi.fn(); const ui = new InventoryUI(root, inv, close);
  const slot = (i: number) => root.querySelector<HTMLButtonElement>(`[data-slot="${i}"]`)!;
  return { root, inv, ui, close, slot };
}
describe('inventory presentation', () => {
  it('shows real slots, counts and item details and updates after changes', () => {
    const { root, inv, ui, slot } = create();
    inv.addItem('iron-ore', 25); ui.open();
    expect(ui.isOpen).toBe(true);
    expect(slot(0).textContent).toContain('Iron Ore ×25');
    expect(slot(1).textContent).toBe('Empty');
    expect(root.querySelector('[data-inventory-capacity]')?.textContent).toContain('1 / 3');
    slot(0).click(); expect(root.querySelector('[data-inventory-detail]')?.textContent).toContain('25 / 100');
    inv.addItem('iron-ore', 3); ui.update();
    expect(slot(0).textContent).toContain('×28');
    ui.closePanel(); expect(root.hidden).toBe(true); ui.dispose();
  });
  it('splits, moves and merges via controls without losing items', () => {
    const { root, inv, ui, slot } = create();
    inv.addItem('iron-ore', 20); ui.open(); slot(0).click();
    root.querySelector<HTMLButtonElement>('[data-inventory-split]')!.click();
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([10, 10, 0]);
    slot(2).click();
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([0, 10, 10]);
    slot(1).click();
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([0, 20, 0]);
    expect(inv.getItemCount('iron-ore')).toBe(20); ui.dispose();
  });
  it('invokes close callback from the close control', () => {
    const { root, ui, close } = create(); ui.open();
    root.querySelector<HTMLButtonElement>('[data-inventory-close]')!.click();
    expect(close).toHaveBeenCalledOnce(); ui.dispose();
  });
});
