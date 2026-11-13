/** Definitions are the single source of stack limits and presentation metadata. */
export type ItemCategory = 'RAW_RESOURCE' | 'PROCESSED_RESOURCE' | 'COMPONENT' | 'CONSTRUCTION_MATERIAL' | 'FLUID';
export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly maxStackSize: number;
  readonly icon: string;
}

export class ItemRegistry {
  private readonly definitions = new Map<string, Readonly<ItemDefinition>>();

  register(definition: ItemDefinition): void {
    if (!definition.id.trim() || !definition.name.trim() || !Number.isSafeInteger(definition.maxStackSize) || definition.maxStackSize <= 0) {
      throw new RangeError('An item requires a non-empty id and name and a positive integer stack limit.');
    }
    if (this.definitions.has(definition.id)) throw new Error(`Duplicate item id: ${definition.id}`);
    this.definitions.set(definition.id, Object.freeze({ ...definition }));
  }

  get(id: string): Readonly<ItemDefinition> {
    const definition = this.definitions.get(id);
    if (!definition) throw new RangeError(`Unknown item: ${id}`);
    return definition;
  }

  all(): readonly Readonly<ItemDefinition>[] { return [...this.definitions.values()]; }
}

export function createDefaultItemRegistry(): ItemRegistry {
  const registry = new ItemRegistry();
  const definitions: ItemDefinition[] = [
    { id: 'iron-ingot', name: 'Iron Ingot', description: 'Refined iron for manufacturing.', category: 'PROCESSED_RESOURCE', maxStackSize: 100, icon: 'Fe' },
    { id: 'iron-ore', name: 'Iron Ore', description: 'Iron-bearing raw mineral.', category: 'RAW_RESOURCE', maxStackSize: 100, icon: 'Fe' },
    { id: 'copper-ore', name: 'Copper Ore', description: 'Copper-bearing raw mineral.', category: 'RAW_RESOURCE', maxStackSize: 100, icon: 'Cu' },
    { id: 'limestone', name: 'Limestone', description: 'Pale mineral for future concrete production.', category: 'RAW_RESOURCE', maxStackSize: 100, icon: 'Ca' },
    { id: 'coal', name: 'Coal', description: 'Carbon-rich fuel for future energy production.', category: 'RAW_RESOURCE', maxStackSize: 100, icon: 'C' },
    { id: 'stone', name: 'Stone', description: 'Rough construction stone.', category: 'RAW_RESOURCE', maxStackSize: 100, icon: 'St' },
    { id: 'wood', name: 'Wood', description: 'Natural timber for early construction.', category: 'RAW_RESOURCE', maxStackSize: 100, icon: 'Wd' },
  ];
  definitions.forEach((definition) => registry.register(definition));
  return registry;
}
