import type { ItemRegistry } from '../items/ItemRegistry';
import { MAX_LIFT_HEIGHT } from '../logistics/LiftDefinitions';

export interface MaterialCost { readonly itemId: string; readonly quantity: number }
/** Plain gameplay data; dimensions are integer grid cells and never Three.js meshes. */
export interface BuildingDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: readonly MaterialCost[];
  readonly widthCells: number;
  readonly depthCells: number;
  readonly height: number;
  readonly maxSlope: number;
  readonly maxGroundVariation: number;
  readonly color: number;
  readonly placement?: 'deposit' | 'logistics';
  readonly category?: string;
}

export class BuildingRegistry {
  private readonly definitions = new Map<string, BuildingDefinition>();
  constructor(private readonly items: ItemRegistry) {}
  register(value: BuildingDefinition): void {
    if (!value.id.trim() || !value.name.trim() || !value.description.trim() ||
        !Number.isSafeInteger(value.widthCells) || value.widthCells <= 0 ||
        !Number.isSafeInteger(value.depthCells) || value.depthCells <= 0 ||
        !Number.isFinite(value.height) || value.height <= 0 ||
        !Number.isFinite(value.maxSlope) || value.maxSlope < 0 || value.maxSlope >= Math.PI / 2 ||
        !Number.isFinite(value.maxGroundVariation) || value.maxGroundVariation < 0 ||
        !Number.isInteger(value.color) || value.color < 0 || value.color > 0xffffff || !value.cost.length) {
      throw new RangeError('Invalid building definition.');
    }
    if (this.definitions.has(value.id)) throw new Error(`Duplicate building id: ${value.id}`);
    const seen = new Set<string>();
    const cost = value.cost.map((entry) => {
      this.items.get(entry.itemId);
      if (seen.has(entry.itemId) || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
        throw new RangeError('Building costs require unique item ids and positive integer quantities.');
      }
      seen.add(entry.itemId);
      return Object.freeze({ ...entry });
    });
    this.definitions.set(value.id, Object.freeze({ ...value, cost: Object.freeze(cost) }));
  }
  get(id: string): BuildingDefinition {
    const result = this.definitions.get(id);
    if (!result) throw new RangeError(`Unknown building: ${id}`);
    return result;
  }
  all(): readonly BuildingDefinition[] { return [...this.definitions.values()]; }
}

export function createDefaultBuildingRegistry(items: ItemRegistry): BuildingRegistry {
  const registry = new BuildingRegistry(items);
  registry.register({ id: 'foundation', name: 'Foundation',
    description: 'A simple stone and timber structural platform.',
    cost: [{ itemId: 'stone', quantity: 10 }, { itemId: 'wood', quantity: 5 }],
    widthCells: 2, depthCells: 2, height: 0.4, maxSlope: 0.12,
    maxGroundVariation: 0.12, color: 0x778b91 });
  registry.register({ id: 'miner-mk1', name: 'Miner Mk.1', category: 'Extraction',
    description: 'Automated extractor for a compatible resource deposit.',
    cost: [{ itemId: 'stone', quantity: 10 }, { itemId: 'wood', quantity: 10 }],
    widthCells: 2, depthCells: 2, height: 2.4, maxSlope: 0.58, maxGroundVariation: 0.8,
    color: 0xb58b42, placement: 'deposit' });
  registry.register({ id: 'smelter', name: 'Smelter', category: 'Production',
    description: 'Smelts iron ore with coal. Cyan: input at rear; yellow: output at front.',
    cost: [{ itemId: 'stone', quantity: 15 }, { itemId: 'wood', quantity: 10 }], widthCells: 2, depthCells: 2,
    height: 2.2, maxSlope: .58, maxGroundVariation: .8, color: 0x7b7370, placement: 'logistics' });
  registry.register({ id: 'constructor', name: 'Constructor', category: 'Production',
    description: 'Presses iron ingots into plates or rods. Choose the recipe in E inspection.',
    cost: [{ itemId: 'stone', quantity: 15 }, { itemId: 'wood', quantity: 10 }], widthCells: 2, depthCells: 2,
    height: 2.2, maxSlope: .58, maxGroundVariation: .8, color: 0x56777e, placement: 'logistics' });
  for (const direction of ['up', 'down'] as const) for (let steps = 10; steps <= MAX_LIFT_HEIGHT * 10; steps++) {
    const rise = steps / 10;
    const id = `lift-${direction}-${rise}`, input = direction === 'up' ? 'low' : 'high';
    registry.register({ id, name: `Lift ${direction === 'up' ? 'Up' : 'Down'} ${rise}m`, category: 'Logistics',
      description: `Vertical conveyor: ${input} rear input; ${rise}m height change. Page Up/Down: 1m; Shift + Page Up/Down: 0.1m.`,
      cost: [{ itemId: 'stone', quantity: 15 }, { itemId: 'wood', quantity: 10 }], widthCells: 2, depthCells: 2,
      height: rise + .9, maxSlope: .58, maxGroundVariation: .8, color: 0x748c92, placement: 'logistics' });
  }
  registry.register({ id: 'power-pole', name: 'Power Pole', category: 'Power',
    description: 'Automatically connects nearby poles and machines within 10 m.',
    cost: [{ itemId: 'stone', quantity: 5 }, { itemId: 'wood', quantity: 5 }], widthCells: 1, depthCells: 1,
    height: 2.6, maxSlope: .58, maxGroundVariation: .8, color: 0x8c8c73, placement: 'logistics' });
  registry.register({ id: 'biomass-generator', name: 'Biomass Generator', category: 'Power',
    description: 'Feed wood by hand or rear conveyor; supplies 30 kW through a nearby pole.',
    cost: [{ itemId: 'stone', quantity: 15 }, { itemId: 'wood', quantity: 10 }], widthCells: 2, depthCells: 2,
    height: 2, maxSlope: .58, maxGroundVariation: .8, color: 0x8e754c, placement: 'logistics' });
  registry.register({ id: 'merger', name: 'Merger', category: 'Logistics',
    description: 'Fairly combines three rear and side inputs into one front output.',
    cost: [{ itemId: 'stone', quantity: 15 }, { itemId: 'wood', quantity: 10 }], widthCells: 2, depthCells: 2,
    height: 1.3, maxSlope: .58, maxGroundVariation: .8, color: 0x8b755c, placement: 'logistics' });
  registry.register({ id: 'splitter', name: 'Splitter', category: 'Logistics',
    description: 'Balances one rear input across up to three front and side outputs.',
    cost: [{ itemId: 'stone', quantity: 15 }, { itemId: 'wood', quantity: 10 }], widthCells: 2, depthCells: 2,
    height: 1.3, maxSlope: .58, maxGroundVariation: .8, color: 0x627991, placement: 'logistics' });
  registry.register({ id: 'storage-container', name: 'Storage Container', category: 'Logistics',
    description: 'Stores 8 stacks. Cyan: input at rear; yellow: output at front.',
    cost: [{ itemId: 'stone', quantity: 15 }, { itemId: 'wood', quantity: 10 }], widthCells: 2, depthCells: 2,
    height: 1.8, maxSlope: .58, maxGroundVariation: .8, color: 0x687c70, placement: 'logistics' });
  registry.register({ id: 'conveyor-cell', name: 'Conveyor', description: 'One cell. Faces your view and transfers to the belt ahead.', category: 'Logistics', placement: 'logistics', cost: [{ itemId: 'stone', quantity: 4 }, { itemId: 'wood', quantity: 2 }], widthCells: 1, depthCells: 1, height: .55, maxSlope: .58, maxGroundVariation: .8, color: 0x697f83 });
  for (const [id, name, description, height] of [
    ['conveyor-auto', 'Conveyor', 'Automatically connects and turns toward adjacent conveyors.', .55],
    ['conveyor-straight', 'Conveyor: Straight', 'Straight belt; arrow points in item direction.', .55],
    ['conveyor-curve', 'Conveyor: Right Curve', 'Quarter-turn belt; input at rear, output at right.', .55],
    ['conveyor-incline', 'Conveyor: Incline', 'Ascending belt; output is one metre above input.', 1.55],
    ['receiving-terminal', 'Receiving Terminal', 'Stores one stack; accepts conveyor outputs on any side.', 1.2],
  ] as const) registry.register({ id, name, description, category: 'Logistics', placement: 'logistics',
    cost: [{ itemId: 'stone', quantity: 4 }, { itemId: 'wood', quantity: 2 }], widthCells: 2, depthCells: 2,
    height, maxSlope: .58, maxGroundVariation: .8, color: 0x697f83 });
  return registry;
}
