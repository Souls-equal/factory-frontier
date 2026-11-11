import type { SimulationSystem } from '../core/Game';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { ResourceDeposit } from '../resources/ResourceDeposit';
import { Miner, type MinerConfig, DEFAULT_MINER_CONFIG } from './Miner';

/** Tracks placed machine lifecycles independently from DOM and rendering. */
export class MachineManager implements SimulationSystem {
  readonly id = 'machines';
  private readonly machines = new Map<string, Miner>();
  constructor(private readonly buildings: BuildingSystem, private readonly items: ItemRegistry,
    private readonly deposits: () => readonly ResourceDeposit[], private readonly config: MinerConfig = DEFAULT_MINER_CONFIG,
    private readonly paused: () => boolean = () => false) {
    buildings.setDemolitionGuard((building) => (this.machines.get(building.id)?.output.usedSlots ?? 0) === 0);
  }
  get(id: string): Miner | undefined { return this.machines.get(id); }
  all(): readonly Miner[] { return [...this.machines.values()]; }
  sync(): void {
    const all = this.buildings.all(); const ids = new Set(all.map((building) => building.id));
    for (const id of this.machines.keys()) if (!ids.has(id)) this.machines.delete(id);
    for (const building of all) {
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
  }
}
