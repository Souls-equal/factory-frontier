import type { MachineState } from '../machines/Miner';
import { BiomassGenerator, BIOMASS } from './BiomassGenerator';
import { PowerGrid, type PowerNetwork, type PowerPosition } from './PowerGrid';

/** Machines remain responsible for their own recipe and buffer rules. */
export interface ElectricConsumer {
  readonly id: string;
  readonly enabled: boolean;
  readonly state: MachineState;
  setPowered(powered: boolean): void;
  fixedUpdate(deltaMs: number): void;
}

/**
 * Simulation adapter for the explicit grid. It owns no building or UI state.
 * All enabled consumers reserve their rated power, even when blocked or idle.
 * In a loaded online network all available generators burn in parallel, at
 * full rate. No fuel is burned while idle, disconnected or overloaded.
 * Ticks are split at fuel exhaustion so machines never receive free energy.
 */
export class PowerSimulation {
  private readonly grid: PowerGrid;
  private readonly generators = new Map<string, BiomassGenerator>();
  private readonly consumers = new Map<string, ElectricConsumer>();
  constructor(wireRange: number) { this.grid = new PowerGrid(wireRange); }
  addPole(id: string, position: PowerPosition): void { this.grid.add({ id, kind: 'pole', position }); }
  addGenerator(generator: BiomassGenerator, position: PowerPosition): void {
    this.grid.add({ id: generator.id, kind: 'generator', position, capacityWatts: BIOMASS.capacityWatts, enabled: generator.ready });
    this.generators.set(generator.id, generator);
  }
  addConsumer(consumer: ElectricConsumer, position: PowerPosition, demandWatts: number): void {
    this.grid.add({ id: consumer.id, kind: 'consumer', position, demandWatts, enabled: consumer.enabled });
    this.consumers.set(consumer.id, consumer); consumer.setPowered(false);
  }
  remove(id: string): boolean {
    const consumer = this.consumers.get(id);
    if (consumer) consumer.setPowered(false);
    this.consumers.delete(id); this.generators.delete(id);
    return this.grid.remove(id);
  }
  connect(a: string, b: string): boolean { return this.grid.connect(a, b); }
  disconnect(a: string, b: string): boolean { return this.grid.disconnect(a, b); }
  networkFor(id: string): PowerNetwork { this.refresh(); return this.grid.networkFor(id); }
  /** Synchronize flags and return a snapshot without consuming fuel. */
  refresh(): readonly PowerNetwork[] {
    for (const [id, generator] of this.generators) this.grid.setEnabled(id, generator.ready);
    for (const [id, consumer] of this.consumers) this.grid.setEnabled(id, consumer.enabled);
    const networks = this.grid.networks();
    for (const network of networks) for (const id of network.consumers)
      this.consumers.get(id)!.setPowered(network.status === 'online' && this.consumers.get(id)!.enabled);
    return networks;
  }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid simulation duration.');
    let remaining = deltaMs;
    while (remaining > 0) {
      const networks = this.refresh();
      const active = networks.filter(network => network.status === 'online' && network.demandWatts > 0)
        .flatMap(network => network.generators.map(id => this.generators.get(id)!).filter(generator => generator.ready));
      const step = active.reduce((time, generator) => Math.min(time, generator.fuelTimeMs), remaining);
      for (const generator of active) generator.burn(step);
      for (const consumer of this.consumers.values()) consumer.fixedUpdate(step);
      remaining -= step;
    }
    this.refresh();
  }
}
