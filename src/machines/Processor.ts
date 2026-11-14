import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { Recipe } from '../production/Recipes';
import type { Machine, MachineState } from './Miner';

/** Fixed recipe simulation, shared by machines with bounded input/output buffers. */
export class Processor implements Machine {
  readonly input: Inventory;
  readonly output: Inventory;
  private work = 0;
  private enabledValue = true;
  private poweredValue = true;
  private recipeValue: Readonly<Recipe>;
  private readonly producedItems = new Map<string, number>();
  private readonly consumedItems = new Map<string, number>();
  private observedMs = 0;
  private workingMs = 0;
  constructor(readonly id: string, items: ItemRegistry, recipe: Readonly<Recipe>) {
    if (!id.trim() || !Number.isFinite(recipe.durationMs) || recipe.durationMs <= 0 ||
        !Number.isSafeInteger(recipe.input.quantity) || recipe.input.quantity <= 0 ||
        !Number.isSafeInteger(recipe.output.quantity) || recipe.output.quantity <= 0) throw new RangeError('Invalid processor');
    items.get(recipe.input.itemId); items.get(recipe.output.itemId);
    const seen = new Set([recipe.input.itemId]);
    for (const ingredient of recipe.additionalInputs ?? []) {
      if (seen.has(ingredient.itemId) || !Number.isSafeInteger(ingredient.quantity) || ingredient.quantity <= 0) throw new RangeError('Invalid processor input');
      items.get(ingredient.itemId); seen.add(ingredient.itemId);
    }
    this.recipeValue = recipe;
    this.input = new Inventory(items, 1 + (recipe.additionalInputs?.length ?? 0)); this.output = new Inventory(items, 1);
  }
  get recipe(): Readonly<Recipe> { return this.recipeValue; }
  /** Lifetime completed output, independent of buffer retrieval or recipe switches. */
  produced(itemId: string): number { return this.producedItems.get(itemId) ?? 0; }
  consumed(itemId: string): number { return this.consumedItems.get(itemId) ?? 0; }
  protected recordConsumed(itemId: string, quantity: number): void { this.consumedItems.set(itemId, this.consumed(itemId) + quantity); }
  get elapsedMs(): number { return this.observedMs; }
  get utilization(): number { return this.observedMs ? this.workingMs / this.observedMs : 0; }
  productionRate(itemId: string): number { return this.observedMs ? this.produced(itemId) * 60000 / this.observedMs : 0; }
  consumptionRate(itemId: string): number { return this.observedMs ? this.consumed(itemId) * 60000 / this.observedMs : 0; }
  /** Only for compatible recipes of a subclass; never discard buffered items. */
  protected changeRecipe(recipe: Readonly<Recipe>): boolean {
    if (recipe.id === this.recipe.id) return true;
    if (this.input.usedSlots || this.output.usedSlots) return false;
    this.recipeValue = recipe; this.work = 0; return true;
  }
  get enabled(): boolean { return this.enabledValue; }
  get powered(): boolean { return this.poweredValue; }
  setPowered(value: boolean): void { this.poweredValue = value; }
  setEnabled(enabled: boolean): void { this.enabledValue = enabled; }
  get progress(): number { return this.work / this.recipe.durationMs; }
  protected get additionalState(): MachineState | null { return null; }
  protected get additionalCycles(): number { return Infinity; }
  protected consumeAdditional(_count: number): void { /* No auxiliary ingredients by default. */ }
  get state(): MachineState {
    if (!this.enabled) return 'DISABLED';
    if (!this.powered) return 'NO_POWER';
    if ([this.recipe.input, ...(this.recipe.additionalInputs ?? [])].some(input => this.input.getItemCount(input.itemId) < input.quantity)) return 'MISSING_INPUT';
    if (this.output.getAvailableSpace(this.recipe.output.itemId) < this.recipe.output.quantity) return 'OUTPUT_FULL';
    return this.additionalState ?? 'RUNNING';
  }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid simulation duration.');
    this.observedMs += deltaMs;
    if (!deltaMs || this.state !== 'RUNNING') return;
    const { input, output, durationMs } = this.recipe;
    const ingredients = [input, ...(this.recipe.additionalInputs ?? [])];
    const limit = Math.min(...ingredients.map(item => Math.floor(this.input.getItemCount(item.itemId) / item.quantity)),
      Math.floor(this.output.getAvailableSpace(output.itemId) / output.quantity), this.additionalCycles);
    const working = Math.min(deltaMs, Math.max(0, limit * durationMs - this.work));
    this.workingMs += working; this.work += working;
    const count = Math.min(limit, Math.floor((this.work + 1e-7) / durationMs));
    if (!count) return;
    // All buffers are preflighted and committed synchronously on completed cycles.
    if (!this.input.exchange(ingredients.map(item => ({ itemId: item.itemId, quantity: count * item.quantity })), [])) throw new Error('Processor input changed during production');
    for (const ingredient of ingredients) this.recordConsumed(ingredient.itemId, count * ingredient.quantity);
    this.consumeAdditional(count);
    if (!this.output.exchange([], [{ itemId: output.itemId, quantity: count * output.quantity }])) throw new Error('Processor output changed during production');
    this.producedItems.set(output.itemId, this.produced(output.itemId) + count * output.quantity);
    this.work = Math.max(0, this.work - count * durationMs);
  }
  /** Reserve one stack for each distinct ingredient, preventing starvation of another input. */
  inputSpace(itemId: string): number {
    if (![this.recipe.input, ...(this.recipe.additionalInputs ?? [])].some(entry => entry.itemId === itemId)) return 0;
    return Math.max(0, Math.min(this.input.getAvailableSpace(itemId), this.input.registry.get(itemId).maxStackSize - this.input.getItemCount(itemId)));
  }
  feedIngredient(source: Inventory, itemId: string): QuantityResult {
    const requested = source.getItemCount(itemId), allowed = Math.min(requested, this.inputSpace(itemId));
    const moved = allowed ? source.transferItem(this.input, itemId, allowed).moved : 0;
    return { requested, moved, remainder: requested - moved };
  }
  retrieveIngredient(destination: Inventory, itemId: string): QuantityResult {
    if (![this.recipe.input, ...(this.recipe.additionalInputs ?? [])].some(entry => entry.itemId === itemId)) throw new RangeError('Not a recipe ingredient');
    return this.transfer(this.input, destination, itemId);
  }
  feed(source: Inventory): QuantityResult { return this.feedIngredient(source, this.recipe.input.itemId); }
  retrieve(destination: Inventory): QuantityResult { return this.transfer(this.output, destination, this.recipe.output.itemId); }
  retrieveInput(destination: Inventory): QuantityResult { return this.transfer(this.input, destination, this.recipe.input.itemId); }
  protected transfer(source: Inventory, destination: Inventory, item: string): QuantityResult {
    const count = source.getItemCount(item);
    return count ? source.transferItem(destination, item, count) : { requested: 0, moved: 0, remainder: 0 };
  }
}
