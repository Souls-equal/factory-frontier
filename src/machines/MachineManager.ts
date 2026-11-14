import type { SimulationSystem } from '../core/Game';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { ResourceDeposit } from '../resources/ResourceDeposit';
import { Miner, type MinerConfig, DEFAULT_MINER_CONFIG } from './Miner';
import { Smelter } from './Smelter';
import { ConstructorMachine } from './ConstructorMachine';
import { AdvancedMachine } from './AdvancedMachine';
import { createDefaultRecipeRegistry } from '../production/Recipes';

export interface FactoryStatistics {
  readonly machines: number;
  readonly outputFull: number;
  readonly missingInput: number;
  readonly noPower: number;
  readonly missingFuel: number;
  readonly productionRate: number;
  readonly consumptionRate: number;
  readonly averageUtilization: number;
}

/** Tracks placed machine lifecycles independently from DOM and rendering. */
export class MachineManager implements SimulationSystem {
  readonly id = 'machines';
  private readonly machines = new Map<string, Miner>();
  private readonly smelters = new Map<string, Smelter>();
  private readonly constructors = new Map<string, ConstructorMachine>();
  private readonly advancedMachines = new Map<string, AdvancedMachine>();
  constructor(private readonly buildings: BuildingSystem, private readonly items: ItemRegistry,
    private readonly deposits: () => readonly ResourceDeposit[], private readonly config: MinerConfig = DEFAULT_MINER_CONFIG,
    private readonly paused: () => boolean = () => false) {
    buildings.addDemolitionGuard((building) => (this.machines.get(building.id)?.output.usedSlots ?? 0) === 0 &&
      (this.smelters.get(building.id)?.output.usedSlots ?? 0) === 0 && (this.smelters.get(building.id)?.input.usedSlots ?? 0) === 0 &&
      (this.smelters.get(building.id)?.fuel.usedSlots ?? 0) === 0 &&
      (this.constructors.get(building.id)?.input.usedSlots ?? 0) === 0 && (this.constructors.get(building.id)?.output.usedSlots ?? 0) === 0 &&
      (this.advancedMachines.get(building.id)?.input.usedSlots ?? 0) === 0 && (this.advancedMachines.get(building.id)?.output.usedSlots ?? 0) === 0);
  }
  get(id: string): Miner | undefined { return this.machines.get(id); }
  all(): readonly Miner[] { return [...this.machines.values()]; }
  smelter(id: string): Smelter | undefined { return this.smelters.get(id); }
  allSmelters(): readonly Smelter[] { return [...this.smelters.values()]; }
  constructorMachine(id: string): ConstructorMachine | undefined { return this.constructors.get(id); }
  allConstructors(): readonly ConstructorMachine[] { return [...this.constructors.values()]; }
  advanced(id: string): AdvancedMachine | undefined { return this.advancedMachines.get(id); }
  allAdvanced(): readonly AdvancedMachine[] { return [...this.advancedMachines.values()]; }
  /** Snapshot of currently placed machines; rates are sums of lifetime averages. */
  statistics(itemId: string): FactoryStatistics {
    this.items.get(itemId);
    const miners = this.all(), processors = [...this.allSmelters(), ...this.allConstructors(), ...this.allAdvanced()];
    const machines = [...miners, ...processors];
    return {
      machines: machines.length,
      outputFull: machines.filter(m => m.state === 'OUTPUT_FULL').length,
      missingInput: machines.filter(m => m.state === 'MISSING_INPUT').length,
      noPower: machines.filter(m => m.state === 'NO_POWER' && !m.powered).length,
      missingFuel: processors.filter(m => m instanceof Smelter && m.state === 'NO_POWER' && m.powered).length,
      productionRate: miners.reduce((sum, m) => sum + (m.itemId === itemId ? m.productionRate : 0), 0) + processors.reduce((sum, m) => sum + m.productionRate(itemId), 0),
      consumptionRate: processors.reduce((sum, m) => sum + m.consumptionRate(itemId), 0),
      averageUtilization: machines.length ? machines.reduce((sum, m) => sum + m.utilization, 0) / machines.length : 0,
    };
  }
  sync(): void {
    const all = this.buildings.all(); const ids = new Set(all.map((building) => building.id));
    for (const id of this.machines.keys()) if (!ids.has(id)) this.machines.delete(id);
    for (const id of this.smelters.keys()) if (!ids.has(id)) this.smelters.delete(id);
    for (const id of this.constructors.keys()) if (!ids.has(id)) this.constructors.delete(id);
    for (const id of this.advancedMachines.keys()) if (!ids.has(id)) this.advancedMachines.delete(id);
    for (const building of all) {
      if ((building.typeId === 'assembler' || building.typeId === 'foundry') && !this.advancedMachines.has(building.id)) {
        const assembler = building.typeId === 'assembler';
        const recipe = createDefaultRecipeRegistry(this.items).get(assembler ? 'reinforced-component' : 'steel-ingot');
        this.advancedMachines.set(building.id, new AdvancedMachine(building.id, this.items, recipe, assembler ? 'Assembler' : 'Foundry'));
      }
      if (building.typeId === 'constructor' && !this.constructors.has(building.id)) {
        const recipes = createDefaultRecipeRegistry(this.items);
        this.constructors.set(building.id, new ConstructorMachine(building.id, this.items, recipes.get('iron-plate'), [recipes.get('iron-rod'), recipes.get('steel-plate')]));
      }
      if (building.typeId === 'smelter' && !this.smelters.has(building.id))
        this.smelters.set(building.id, new Smelter(building.id, this.items, createDefaultRecipeRegistry(this.items).get('iron-ingot')));
      if (building.typeId !== 'miner-mk1' || this.machines.has(building.id)) continue;
      if (!building.depositId || !building.depositItemId) throw new Error('Miner is missing deposit metadata.');
      this.machines.set(building.id, new Miner(building.id, building.depositId, building.depositItemId,
        (id) => this.deposits().find((deposit) => deposit.id === id), this.items, this.config));
    }
  }
  fixedUpdate(deltaMs: number): void {
    this.sync();
    if (this.paused()) return;
    for (const machine of this.machines.values()) machine.fixedUpdate(deltaMs);
    for (const machine of this.smelters.values()) machine.fixedUpdate(deltaMs);
    for (const machine of this.constructors.values()) machine.fixedUpdate(deltaMs);
    for (const machine of this.advancedMachines.values()) machine.fixedUpdate(deltaMs);
  }
}
