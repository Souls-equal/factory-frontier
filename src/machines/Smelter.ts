import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { Recipe } from '../production/Recipes';
import type { MachineState } from './Miner';
import { Processor } from './Processor';

/** Temporary direct fuel policy, not an electrical power network. */
export const SMELTER_FUEL = Object.freeze({ itemId: 'coal', quantity: 1 });

export class Smelter extends Processor {
  readonly fuel: Inventory;
  constructor(id: string, items: ItemRegistry, recipe: Readonly<Recipe>) {
    super(id, items, recipe); items.get(SMELTER_FUEL.itemId); this.fuel = new Inventory(items, 1);
  }
  protected override get additionalState(): MachineState | null {
    return this.fuel.getItemCount(SMELTER_FUEL.itemId) < SMELTER_FUEL.quantity ? 'NO_POWER' : null;
  }
  protected override get additionalCycles(): number { return Math.floor(this.fuel.getItemCount(SMELTER_FUEL.itemId) / SMELTER_FUEL.quantity); }
  protected override consumeAdditional(count: number): void {
    if (!this.fuel.exchange([{ itemId: SMELTER_FUEL.itemId, quantity: count * SMELTER_FUEL.quantity }], [])) throw new Error('Smelter fuel changed during production');
  }
  feedFuel(source: Inventory): QuantityResult { return this.transfer(source, this.fuel, SMELTER_FUEL.itemId); }
  retrieveFuel(destination: Inventory): QuantityResult { return this.transfer(this.fuel, destination, SMELTER_FUEL.itemId); }
}
