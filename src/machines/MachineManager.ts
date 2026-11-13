import type { SimulationSystem } from '../core/Game';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { ResourceDeposit } from '../resources/ResourceDeposit';
import { Miner, type MinerConfig, DEFAULT_MINER_CONFIG } from './Miner';
import { Smelter } from './Smelter';
import { ConstructorMachine } from './ConstructorMachine';
import { createDefaultRecipeRegistry } from '../production/Recipes';

/** Tracks placed machine lifecycles independently from DOM and rendering. */
export class MachineManager implements SimulationSystem {
  readonly id = 'machines';
  private readonly machines = new Map<string, Miner>();
  private readonly smelters = new Map<string, Smelter>();
  private readonly constructors = new Map<string, ConstructorMachine>();
  constructor(private readonly buildings: BuildingSystem, private readonly items: ItemRegistry,
    private readonly deposits: () => readonly ResourceDeposit[], private readonly config: MinerConfig = DEFAULT_MINER_CONFIG,
    private readonly paused: () => boolean = () => false) {
    buildings.addDemolitionGuard((building) => (this.machines.get(building.id)?.output.usedSlots ?? 0) === 0 &&
      (this.smelters.get(building.id)?.output.usedSlots ?? 0) === 0 && (this.smelters.get(building.id)?.input.usedSlots ?? 0) === 0 &&
      (this.smelters.get(building.id)?.fuel.usedSlots ?? 0) === 0 &&
      (this.constructors.get(building.id)?.input.usedSlots ?? 0) === 0 && (this.constructors.get(building.id)?.output.usedSlots ?? 0) === 0);
  }
  get(id: string): Miner | undefined { return this.machines.get(id); }
  all(): readonly Miner[] { return [...this.machines.values()]; }
  smelter(id: string): Smelter | undefined { return this.smelters.get(id); }
  allSmelters(): readonly Smelter[] { return [...this.smelters.values()]; }
  constructorMachine(id: string): ConstructorMachine | undefined { return this.constructors.get(id); }
  allConstructors(): readonly ConstructorMachine[] { return [...this.constructors.values()]; }
  sync(): void {
    const all = this.buildings.all(); const ids = new Set(all.map((building) => building.id));
    for (const id of this.machines.keys()) if (!ids.has(id)) this.machines.delete(id);
    for (const id of this.smelters.keys()) if (!ids.has(id)) this.smelters.delete(id);
    for (const id of this.constructors.keys()) if (!ids.has(id)) this.constructors.delete(id);
    for (const building of all) {
      if (building.typeId === 'constructor' && !this.constructors.has(building.id))
        this.constructors.set(building.id, new ConstructorMachine(building.id, this.items, createDefaultRecipeRegistry(this.items).get('iron-plate')));
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
  }
}
