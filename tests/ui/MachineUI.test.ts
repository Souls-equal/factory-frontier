// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MachineUI } from '../../src/ui/MachineUI';
import { Miner } from '../../src/machines/Miner';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

describe('machine inspection UI', () => {
  it('shows actual state, transfers only what fits, disables and closes without losing state', () => {
    document.body.innerHTML = '<section hidden><div data-machine-details></div><button data-machine-close>Close</button><button data-machine-toggle></button><button data-machine-retrieve></button><p data-machine-notice></p></section>';
    const root = document.querySelector('section')!, items = createDefaultItemRegistry();
    const deposit: ResourceDeposit = { id: 'd', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'pure', productionMultiplier: 2, extractionCompatible: true };
    const miner = new Miner('m', 'd', 'iron-ore', () => deposit, items); miner.fixedUpdate(10000);
    const player = new Inventory(items, 1); player.addItem('iron-ore', 95);
    const close = vi.fn(); const ui = new MachineUI(root, player, close); ui.open(miner);
    expect(root.textContent).toContain('RUNNING'); expect(root.textContent).toContain('pure'); expect(root.textContent).toContain('60 items/min');
    expect(root.textContent).toContain('Output: 10 / 100');
    root.querySelector<HTMLButtonElement>('[data-machine-retrieve]')!.click();
    expect(root.textContent).toContain('Transferred 5; 5 remain');
    expect(miner.output.getItemCount('iron-ore')).toBe(5); expect(player.getItemCount('iron-ore')).toBe(100);
    root.querySelector<HTMLButtonElement>('[data-machine-toggle]')!.click(); expect(miner.state).toBe('DISABLED');
    expect(root.textContent).toContain('DISABLED'); root.querySelector<HTMLButtonElement>('[data-machine-close]')!.click(); expect(close).toHaveBeenCalledOnce();
    ui.closePanel(); expect(miner.output.getItemCount('iron-ore')).toBe(5); expect(ui.isOpen).toBe(false); ui.dispose();
  });
});
