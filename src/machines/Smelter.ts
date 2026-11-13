import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { Recipe } from '../production/Recipes';
import type { Machine, MachineState } from './Miner';

/** Fixed-recipe processor. No inputs are consumed until output space is assured. */
export class Smelter implements Machine {
  readonly input: Inventory;
  readonly output: Inventory;
  private work = 0;
  private enabledValue = true;
  constructor(readonly id: string, items: ItemRegistry, readonly recipe: Readonly<Recipe>) {
    if (!id.trim() || !Number.isFinite(recipe.durationMs) || recipe.durationMs <= 0 ||
      !Number.isSafeInteger(recipe.input.quantity) || recipe.input.quantity <= 0 ||
      !Number.isSafeInteger(recipe.output.quantity) || recipe.output.quantity <= 0) throw new RangeError('Invalid smelter');
    items.get(recipe.input.itemId); items.get(recipe.output.itemId);
    this.input = new Inventory(items, 1); this.output = new Inventory(items, 1);
  }
  get enabled(): boolean { return this.enabledValue; }
  setEnabled(enabled: boolean): void { this.enabledValue = enabled; }
  get progress(): number { return this.work / this.recipe.durationMs; }
  get state(): MachineState {
    if (!this.enabled) return 'DISABLED';
    if (this.input.getItemCount(this.recipe.input.itemId) < this.recipe.input.quantity) return 'MISSING_INPUT';
    if (this.output.getAvailableSpace(this.recipe.output.itemId) < this.recipe.output.quantity) return 'OUTPUT_FULL';
    return 'RUNNING';
  }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid simulation duration.');
    if (!deltaMs || this.state !== 'RUNNING') return;
    const { input, output, durationMs } = this.recipe;
    const limit = Math.min(Math.floor(this.input.getItemCount(input.itemId) / input.quantity),
      Math.floor(this.output.getAvailableSpace(output.itemId) / output.quantity));
    this.work += Math.min(deltaMs, Math.max(0, limit * durationMs - this.work));
    const count = Math.min(limit, Math.floor((this.work + 1e-7) / durationMs));
    if (!count) return;
    // These preflighted inventory operations are synchronous; no other system can
    // mutate either buffer between the check and the two commits.
    if (!this.input.exchange([{ itemId: input.itemId, quantity: count * input.quantity }], [])) throw new Error('Smelter input changed during production');
    if (!this.output.exchange([], [{ itemId: output.itemId, quantity: count * output.quantity }])) throw new Error('Smelter output changed during production');
    this.work = Math.max(0, this.work - count * durationMs);
  }
  feed(source: Inventory): QuantityResult {
    const item = this.recipe.input.itemId, count = source.getItemCount(item);
    return count ? source.transferItem(this.input, item, count) : { requested: 0, moved: 0, remainder: 0 };
  }
  retrieve(destination: Inventory): QuantityResult { return this.transfer(this.output, destination, this.recipe.output.itemId); }
  retrieveInput(destination: Inventory): QuantityResult { return this.transfer(this.input, destination, this.recipe.input.itemId); }
  private transfer(source: Inventory, destination: Inventory, item: string): QuantityResult {
    const count = source.getItemCount(item);
    return count ? source.transferItem(destination, item, count) : { requested: 0, moved: 0, remainder: 0 };
  }
}
