import type { ItemRegistry } from '../items/ItemRegistry';
import type { Recipe } from '../production/Recipes';
import { Processor } from './Processor';

/** A constructor can choose among its registered, compatible single-input recipes. */
export class ConstructorMachine extends Processor {
  readonly recipes: readonly Readonly<Recipe>[];
  constructor(id: string, items: ItemRegistry, recipe: Readonly<Recipe>, alternatives: readonly Readonly<Recipe>[] = []) {
    super(id, items, recipe);
    const recipes = [recipe, ...alternatives];
    if (recipes.some((entry, index) => !entry.id.trim() || entry.additionalInputs?.length ||
      recipes.findIndex(other => other.id === entry.id) !== index))
      throw new RangeError('Incompatible constructor recipe');
    for (const entry of recipes) {
      items.get(entry.input.itemId); items.get(entry.output.itemId);
      if (!Number.isFinite(entry.durationMs) || entry.durationMs <= 0 || !Number.isSafeInteger(entry.input.quantity) || entry.input.quantity <= 0 ||
        !Number.isSafeInteger(entry.output.quantity) || entry.output.quantity <= 0) throw new RangeError('Invalid constructor recipe');
    }
    this.recipes = Object.freeze([...recipes]);
  }
  selectRecipe(id: string): boolean {
    const recipe = this.recipes.find(entry => entry.id === id);
    if (!recipe) throw new RangeError('Unknown constructor recipe');
    return this.changeRecipe(recipe);
  }
}
