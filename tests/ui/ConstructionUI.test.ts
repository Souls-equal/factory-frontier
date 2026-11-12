// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ConstructionUI } from '../../src/ui/ConstructionUI';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

describe('construction menu', () => {
  it('shows costs, disables unaffordable selection and tracks inventory changes', () => {
    document.body.innerHTML = '<section hidden><button data-construction-close>Close</button><div data-construction-list></div></section>';
    const root = document.querySelector('section')!, inventory = new Inventory(createDefaultItemRegistry(), 4), select = vi.fn(), close = vi.fn();
    const ui = new ConstructionUI(root, createDefaultBuildingRegistry(inventory.registry), inventory, select, close);
    ui.open(); const entry = () => root.querySelector<HTMLButtonElement>('[data-building="foundation"]')!;
    expect(root.textContent).toContain('Stone: 0 / 10'); expect(entry().disabled).toBe(true);
    entry().click(); expect(select).not.toHaveBeenCalled();
    inventory.addItem('stone', 10); inventory.addItem('wood', 5); ui.update();
    expect(entry().disabled).toBe(false); expect(root.textContent).toContain('Wood: 5 / 5');
    const before = inventory.snapshot(); entry().click();
    expect(select).toHaveBeenCalledWith('foundation'); expect(inventory.snapshot()).toEqual(before);
    root.querySelector<HTMLButtonElement>('[data-construction-close]')!.click(); expect(close).toHaveBeenCalledOnce();
    ui.closePanel(); expect(ui.isOpen).toBe(false); ui.dispose();
  });
});

it('offers all Phase 5 entries with exact costs and rejects unaffordable selection', () => {
  document.body.innerHTML = '<section hidden><button data-construction-close>Close</button><div data-construction-list></div></section>';
  const root = document.querySelector('section')!, inventory = new Inventory(createDefaultItemRegistry(), 4), select = vi.fn();
  const ui = new ConstructionUI(root, createDefaultBuildingRegistry(inventory.registry), inventory, select, vi.fn()); ui.open();
  const ids = ['conveyor-cell', 'receiving-terminal'];
  for (const id of ids) {
    const entry = root.querySelector<HTMLButtonElement>(`[data-building="${id}"]`)!;
    expect(entry).not.toBeNull(); expect(entry.disabled).toBe(true);
    expect(entry.textContent).toContain('Stone: 0 / 4'); expect(entry.textContent).toContain('Wood: 0 / 2');
    entry.click(); expect(select).not.toHaveBeenCalled();
  }
  for (const id of ['conveyor-straight', 'conveyor-curve', 'conveyor-incline']) expect(root.querySelector(`[data-building="${id}"]`)).toBeNull();
  inventory.addItem('stone', 4); inventory.addItem('wood', 2); ui.update();
  for (const id of ids) {
    const entry = root.querySelector<HTMLButtonElement>(`[data-building="${id}"]`)!;
    expect(entry.disabled).toBe(false); entry.click(); expect(select).toHaveBeenLastCalledWith(id);
  }
  ui.dispose();
});
