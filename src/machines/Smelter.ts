import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { Recipe } from '../production/Recipes';
import type { Machine, MachineState } from './Miner';

/** Temporary direct fuel policy, not an electrical power network. */
export const SMELTER_FUEL = Object.freeze({ itemId: 'coal', quantity: 1 });

/** Fixed-recipe processor. No resources are consumed until a cycle completes. */
export class Smelter implements Machine {
  readonly input: Inventory;
  readonly output: Inventory;
  readonly fuel: Inventory;
  private work = 0;
  private enabledValue = true;
  constructor(readonly id: string, items: ItemRegistry, readonly recipe: Readonly<Recipe>) {
    if (!id.trim() || !Number.isFinite(recipe.durationMs) || recipe.durationMs <= 0 ||
      !Number.isSafeInteger(recipe.input.quantity) || recipe.input.quantity <= 0 ||
      !Number.isSafeInteger(recipe.output.quantity) || recipe.output.quantity <= 0) throw new RangeError('Invalid smelter');
    items.get(recipe.input.itemId); items.get(recipe.output.itemId); items.get(SMELTER_FUEL.itemId);
    this.input = new Inventory(items, 1); this.fuel = new Inventory(items, 1); this.output = new Inventory(items, 1);
  }
  get enabled(): boolean { return this.enabledValue; }
  setEnabled(enabled: boolean): void { this.enabledValue = enabled; }
  get progress(): number { return this.work / this.recipe.durationMs; }
  get state(): MachineState {
    if (!this.enabled) return 'DISABLED';
    if (this.input.getItemCount(this.recipe.input.itemId) < this.recipe.input.quantity) return 'MISSING_INPUT';
    if (this.output.getAvailableSpace(this.recipe.output.itemId) < this.recipe.output.quantity) return 'OUTPUT_FULL';
    if (this.fuel.getItemCount(SMELTER_FUEL.itemId) < SMELTER_FUEL.quantity) return 'NO_POWER';
    return 'RUNNING';
  }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid simulation duration.');
    if (!deltaMs || this.state !== 'RUNNING') return;
    const { input, output, durationMs } = this.recipe;
    const limit = Math.min(Math.floor(this.input.getItemCount(input.itemId) / input.quantity),
      Math.floor(this.output.getAvailableSpace(output.itemId) / output.quantity),
      Math.floor(this.fuel.getItemCount(SMELTER_FUEL.itemId) / SMELTER_FUEL.quantity));
    this.work += Math.min(deltaMs, Math.max(0, limit * durationMs - this.work));
    const count = Math.min(limit, Math.floor((this.work + 1e-7) / durationMs));
    if (!count) return;
    // These preflighted inventory operations are synchronous; no other system can
    // mutate the buffers between the check and the commits.
    if (!this.input.exchange([{ itemId: input.itemId, quantity: count * input.quantity }], [])) throw new Error('Smelter input changed during production');
    if (!this.fuel.exchange([{ itemId: SMELTER_FUEL.itemId, quantity: count * SMELTER_FUEL.quantity }], [])) throw new Error('Smelter fuel changed during production');
    if (!this.output.exchange([], [{ itemId: output.itemId, quantity: count * output.quantity }])) throw new Error('Smelter output changed during production');
    this.work = Math.max(0, this.work - count * durationMs);
  }
  feed(source: Inventory): QuantityResult {
    const item = this.recipe.input.itemId, count = source.getItemCount(item);
    return count ? source.transferItem(this.input, item, count) : { requested: 0, moved: 0, remainder: 0 };
  }
  feedFuel(source: Inventory): QuantityResult {
    return this.transfer(source, this.fuel, SMELTER_FUEL.itemId);
  }
  retrieveFuel(destination: Inventory): QuantityResult { return this.transfer(this.fuel, destination, SMELTER_FUEL.itemId); }
  retrieve(destination: Inventory): QuantityResult { return this.transfer(this.output, destination, this.recipe.output.itemId); }
  retrieveInput(destination: Inventory): QuantityResult { return this.transfer(this.input, destination, this.recipe.input.itemId); }
  private transfer(source: Inventory, destination: Inventory, item: string): QuantityResult {
    const count = source.getItemCount(item);
    return count ? source.transferItem(destination, item, count) : { requested: 0, moved: 0, remainder: 0 };
  }
}
