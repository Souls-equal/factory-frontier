import { describe, expect, it } from 'vitest';
import { Miner } from '../../src/machines/Miner';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

function setup(multiplier = 1) {
  const items = createDefaultItemRegistry();
  let deposit: ResourceDeposit | undefined = { id: 'iron', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8,
    purity: multiplier === .5 ? 'impure' : multiplier === 2 ? 'pure' : 'normal', productionMultiplier: multiplier, extractionCompatible: true };
  const miner = new Miner('building-1', 'iron', 'iron-ore', () => deposit, items);
  return { miner, items, setDeposit: (value: ResourceDeposit | undefined) => { deposit = value; }, getDeposit: () => deposit };
}
describe('Miner Mk.1 fixed-step simulation', () => {
  it.each([[.5, 15], [1, 30], [2, 60]])('produces %s purity: %s items per simulated minute', (multiplier, amount) => {
    const { miner } = setup(multiplier); expect(miner.state).toBe('IDLE');
    for (let i = 0; i < 1200; i++) miner.fixedUpdate(50);
    expect(miner.output.getItemCount('iron-ore')).toBe(amount); expect(miner.state).toBe('RUNNING');
    expect(miner.progress).toBeCloseTo(0);
  });
  it('retains fractional progress across steps, disabled and unavailable states', () => {
    const { miner, setDeposit, getDeposit } = setup(); const deposit = getDeposit()!;
    miner.fixedUpdate(1000); expect(miner.progress).toBeCloseTo(.5);
    miner.setEnabled(false); miner.fixedUpdate(3000); expect(miner.state).toBe('DISABLED'); expect(miner.progress).toBeCloseTo(.5);
    miner.setEnabled(true); setDeposit(undefined); miner.fixedUpdate(3000);
    expect(miner.state).toBe('MISSING_INPUT'); expect(miner.progress).toBeCloseTo(.5);
    setDeposit({ ...deposit, itemId: 'coal' }); expect(miner.state).toBe('MISSING_INPUT');
    setDeposit(deposit); miner.fixedUpdate(1000);
    expect(miner.output.getItemCount('iron-ore')).toBe(1); expect(miner.progress).toBeCloseTo(0);
  });
  it('stops when full, preserves pre-existing fractional progress and resumes after retrieval', () => {
    const { miner, items } = setup();
    miner.fixedUpdate(1000); expect(miner.progress).toBeCloseTo(.5);
    miner.output.addItem('iron-ore', 100); miner.fixedUpdate(10000);
    expect(miner.state).toBe('OUTPUT_FULL'); expect(miner.progress).toBeCloseTo(.5);
    const player = new Inventory(items, 1); const transfer = miner.retrieve(player);
    expect(transfer).toEqual({ requested: 100, moved: 100, remainder: 0 });
    miner.fixedUpdate(1000); expect(miner.output.getItemCount('iron-ore')).toBe(1);
    expect(miner.output.getItemCount('iron-ore') + player.getItemCount('iron-ore')).toBe(101);
  });
  it('stops exactly when capacity fills during a long tick, without banking excess work', () => {
    const { miner } = setup(); miner.output.addItem('iron-ore', 99); miner.fixedUpdate(60000);
    expect(miner.output.getItemCount('iron-ore')).toBe(100); expect(miner.state).toBe('OUTPUT_FULL');
    expect(miner.progress).toBeCloseTo(0); miner.fixedUpdate(60000); expect(miner.output.getItemCount('iron-ore')).toBe(100);
  });
  it('transfers only available player capacity without deleting the remainder', () => {
    const { miner, items } = setup(); miner.output.addItem('iron-ore', 30);
    const player = new Inventory(items, 1); player.addItem('iron-ore', 90);
    expect(miner.retrieve(player)).toEqual({ requested: 30, moved: 10, remainder: 20 });
    expect(miner.retrieve(player)).toEqual({ requested: 20, moved: 0, remainder: 20 });
    expect(player.getItemCount('iron-ore') + miner.output.getItemCount('iron-ore')).toBe(120);
  });
  it('is independent of how the same simulated time is partitioned', () => {
    const a = setup().miner, b = setup().miner;
    for (let i = 0; i < 1200; i++) a.fixedUpdate(50);
    for (let i = 0; i < 240; i++) b.fixedUpdate(250);
    expect(a.output.snapshot()).toEqual(b.output.snapshot()); expect(a.progress).toBeCloseTo(b.progress);
  });
});
