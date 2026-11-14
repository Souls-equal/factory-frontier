import type { ItemRegistry } from '../items/ItemRegistry';

/** Recipe data is independent of machines, UI and simulation. */
export interface Recipe {
  readonly id: string;
  readonly name: string;
  readonly input: { readonly itemId: string; readonly quantity: number };
  readonly additionalInputs?: readonly { readonly itemId: string; readonly quantity: number }[];
  readonly output: { readonly itemId: string; readonly quantity: number };
  readonly durationMs: number;
}
export class RecipeRegistry {
  private readonly entries = new Map<string, Readonly<Recipe>>();
  constructor(private readonly items: ItemRegistry) {}
  register(recipe: Recipe): void {
    if (!recipe.id.trim() || !recipe.name.trim() || this.entries.has(recipe.id) ||
      !Number.isFinite(recipe.durationMs) || recipe.durationMs <= 0 ||
      !Number.isSafeInteger(recipe.input.quantity) || recipe.input.quantity <= 0 ||
      !Number.isSafeInteger(recipe.output.quantity) || recipe.output.quantity <= 0) throw new RangeError('Invalid recipe');
    this.items.get(recipe.input.itemId); this.items.get(recipe.output.itemId);
    const seen = new Set([recipe.input.itemId]);
    const additionalInputs = recipe.additionalInputs?.map(input => {
      if (seen.has(input.itemId) || !Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new RangeError('Invalid recipe input');
      this.items.get(input.itemId); seen.add(input.itemId); return Object.freeze({ ...input });
    });
    this.entries.set(recipe.id, Object.freeze({ ...recipe, input: Object.freeze({ ...recipe.input }), output: Object.freeze({ ...recipe.output }),
      ...(additionalInputs ? { additionalInputs: Object.freeze(additionalInputs) } : {}) }));
  }
  get(id: string): Readonly<Recipe> {
    const recipe = this.entries.get(id); if (!recipe) throw new RangeError(`Unknown recipe: ${id}`); return recipe;
  }
}
export function createDefaultRecipeRegistry(items: ItemRegistry): RecipeRegistry {
  const registry = new RecipeRegistry(items);
  registry.register({ id: 'iron-ingot', name: 'Iron Ingot', input: { itemId: 'iron-ore', quantity: 1 },
    output: { itemId: 'iron-ingot', quantity: 1 }, durationMs: 2000 });
  registry.register({ id: 'iron-plate', name: 'Iron Plate', input: { itemId: 'iron-ingot', quantity: 1 },
    output: { itemId: 'iron-plate', quantity: 1 }, durationMs: 2000 });
  registry.register({ id: 'iron-rod', name: 'Iron Rod', input: { itemId: 'iron-ingot', quantity: 1 },
    output: { itemId: 'iron-rod', quantity: 1 }, durationMs: 2000 });
  registry.register({ id: 'reinforced-component', name: 'Reinforced Component', input: { itemId: 'iron-plate', quantity: 1 },
    additionalInputs: [{ itemId: 'iron-rod', quantity: 1 }], output: { itemId: 'reinforced-component', quantity: 1 }, durationMs: 4000 });
  registry.register({ id: 'steel-ingot', name: 'Steel Ingot', input: { itemId: 'iron-ore', quantity: 1 },
    additionalInputs: [{ itemId: 'coal', quantity: 1 }], output: { itemId: 'steel-ingot', quantity: 1 }, durationMs: 4000 });
  registry.register({ id: 'steel-plate', name: 'Steel Plate', input: { itemId: 'steel-ingot', quantity: 1 },
    output: { itemId: 'steel-plate', quantity: 1 }, durationMs: 2000 });
  return registry;
}
