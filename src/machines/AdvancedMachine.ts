import type { ItemRegistry } from '../items/ItemRegistry';
import type { Recipe } from '../production/Recipes';
import { Processor } from './Processor';

/** Two-ingredient machines share the processor and logistics implementation. */
export class AdvancedMachine extends Processor {
  constructor(id: string, items: ItemRegistry, recipe: Readonly<Recipe>, readonly kind: 'Assembler' | 'Foundry') {
    super(id, items, recipe);
    if (recipe.additionalInputs?.length !== 1) throw new RangeError('Advanced machines require two ingredients');
  }
}
