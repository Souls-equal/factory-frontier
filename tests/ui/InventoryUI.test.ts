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
function dispatchDrag(target: Element, type: string): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { setData: vi.fn(), effectAllowed: '', dropEffect: '' } });
  target.dispatchEvent(event);
  return event;
}
function drag(source: Element, target: Element): void {
  dispatchDrag(source, 'dragstart');
  dispatchDrag(target, 'dragover');
  dispatchDrag(target, 'drop');
  dispatchDrag(source, 'dragend');
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
  it('selects and deselects without moving items when clicking slots or empty space', () => {
    const { root, inv, ui, slot } = create();
    inv.addItem('iron-ore', 20); ui.open(); slot(0).click(); slot(2).click();
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([20, 0, 0]);
    slot(0).click(); root.click();
    expect(root.querySelector('[data-inventory-detail]')?.textContent).not.toContain('Iron Ore —');
    expect(inv.getItemCount('iron-ore')).toBe(20); ui.dispose();
  });
  it('splits, drags to empty slots and merges without losing items', () => {
    const { root, inv, ui, slot } = create();
    inv.addItem('iron-ore', 20); ui.open(); slot(0).click();
    root.querySelector<HTMLButtonElement>('[data-inventory-split]')!.click();
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([10, 10, 0]);
    drag(slot(0), slot(2));
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([0, 10, 10]);
    drag(slot(2), slot(1));
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([0, 20, 0]);
    expect(inv.getItemCount('iron-ore')).toBe(20); ui.dispose();
  });
  it('merges only available space and retains the source remainder', () => {
    const { inv, ui, slot } = create();
    inv.addItem('iron-ore', 170); ui.open();
    drag(slot(1), slot(2));
    inv.addItem('iron-ore', 10); ui.update(); // [100, 10, 70]
    drag(slot(2), slot(1)); // [100, 80, empty]
    drag(slot(0), slot(1)); // [80, 100, empty]
    expect(inv.snapshot().map((s) => s?.quantity ?? 0)).toEqual([80, 100, 0]);
    expect(inv.getItemCount('iron-ore')).toBe(180); ui.dispose();
  });
  it('swaps incompatible stacks without duplicating or losing items', () => {
    const { inv, ui, slot } = create();
    inv.addItem('iron-ore', 20); inv.addItem('coal', 7); ui.open();
    drag(slot(0), slot(1));
    expect(inv.snapshot()).toEqual([{ itemId: 'coal', quantity: 7 }, { itemId: 'iron-ore', quantity: 20 }, null]);
    ui.dispose();
  });
  it('cancels drops outside slots and ignores stale or external drags', () => {
    const { root, inv, ui, slot } = create();
    inv.addItem('iron-ore', 20); ui.open();
    const before = inv.snapshot();
    const source = slot(0); dispatchDrag(source, 'dragstart');
    dispatchDrag(root, 'drop'); dispatchDrag(source, 'dragend');
    expect(inv.snapshot()).toEqual(before);
    dispatchDrag(slot(2), 'drop'); // no internal drag source
    expect(inv.snapshot()).toEqual(before);
    dispatchDrag(slot(0), 'dragstart'); inv.addItem('coal', 5);
    const changed = inv.snapshot(); dispatchDrag(slot(2), 'drop');
    expect(inv.snapshot()).toEqual(changed); ui.dispose();
  });
  it('ignores empty-source drags, same-slot drops and repeated drop events', () => {
    const { inv, ui, slot } = create();
    inv.addItem('wood', 12); ui.open();
    const before = inv.snapshot();
    expect(dispatchDrag(slot(1), 'dragstart').defaultPrevented).toBe(true);
    dispatchDrag(slot(0), 'drop');
    expect(inv.snapshot()).toEqual(before);
    drag(slot(0), slot(0));
    expect(inv.snapshot()).toEqual(before);
    drag(slot(0), slot(1));
    const after = inv.snapshot();
    dispatchDrag(slot(2), 'drop');
    expect(inv.snapshot()).toEqual(after);
    expect(inv.getItemCount('wood')).toBe(12);
    ui.dispose();
  });
  it('cancels an in-progress drag if inventory changes before the next frame', () => {
    const { inv, ui, slot } = create();
    inv.addItem('wood', 12); ui.open();
    dispatchDrag(slot(0), 'dragstart');
    inv.addItem('coal', 4); ui.update();
    const before = inv.snapshot(); dispatchDrag(slot(2), 'drop');
    expect(inv.snapshot()).toEqual(before);
    ui.dispose();
  });

  it('invokes close callback from the close control', () => {
    const { root, ui, close } = create(); ui.open();
    root.querySelector<HTMLButtonElement>('[data-inventory-close]')!.click();
    expect(close).toHaveBeenCalledOnce(); ui.dispose();
  });
});
