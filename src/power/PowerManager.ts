import type { BuildingInstance, BuildingSystem } from '../buildings/BuildingSystem';
import type { SimulationSystem } from '../core/Game';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { MachineManager } from '../machines/MachineManager';
import { BiomassGenerator } from './BiomassGenerator';
import { PowerSimulation } from './PowerSimulation';
import type { PowerNetwork, PowerPosition } from './PowerGrid';

export const POWER_RANGE = 10;
export const MACHINE_WATTS: Readonly<Record<string, number>> = Object.freeze({ 'miner-mk1': 10_000, smelter: 10_000, constructor: 10_000 });
export interface PowerWire { readonly a: string; readonly b: string; readonly from: PowerPosition; readonly to: PowerPosition }

/** Bridges building lifecycles to the simulation. Connections are automatic and deterministic. */
export class PowerManager implements SimulationSystem {
  readonly id = 'power';
  private simulation = new PowerSimulation(POWER_RANGE);
  private readonly generators = new Map<string, BiomassGenerator>();
  private revision = -1;
  private wireSnapshot: readonly PowerWire[] = [];
  constructor(private readonly buildings: BuildingSystem, private readonly machines: MachineManager,
    private readonly items: ItemRegistry, private readonly paused: () => boolean = () => false) {
    buildings.addDemolitionGuard(building => (this.generators.get(building.id)?.fuel.usedSlots ?? 0) === 0);
  }
  generator(id: string): BiomassGenerator | undefined { return this.generators.get(id); }
  wires(): readonly PowerWire[] { return this.wireSnapshot; }
  networkFor(id: string): PowerNetwork { return this.simulation.networkFor(id); }
  private position(b: BuildingInstance): PowerPosition {
    return { x: b.transform.x, y: b.transform.y + this.buildings.registry.get(b.typeId).height - .1, z: b.transform.z };
  }
  sync(): void {
    this.machines.sync();
    if (this.revision === this.buildings.revision) return;
    const all = this.buildings.all(), ids = new Set(all.map(b => b.id));
    for (const id of this.generators.keys()) if (!ids.has(id)) this.generators.delete(id);
    for (const b of all) if (b.typeId === 'biomass-generator' && !this.generators.has(b.id))
      this.generators.set(b.id, new BiomassGenerator(b.id, this.items));
    const sim = new PowerSimulation(POWER_RANGE);
    const poles = all.filter(b => b.typeId === 'power-pole').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const endpoints = all.filter(b => b.typeId === 'biomass-generator' || Object.hasOwn(MACHINE_WATTS, b.typeId));
    for (const b of poles) sim.addPole(b.id, this.position(b));
    for (const b of endpoints) {
      const position = this.position(b);
      if (b.typeId === 'biomass-generator') sim.addGenerator(this.generators.get(b.id)!, position);
      else {
        const machine = this.machines.get(b.id) ?? this.machines.smelter(b.id) ?? this.machines.constructorMachine(b.id);
        if (!machine) throw new Error(`Missing machine ${b.id}`);
        sim.addConsumer(machine, position, MACHINE_WATTS[b.typeId]!);
      }
    }
    const wires: PowerWire[] = [];
    const distance = (a: BuildingInstance, b: BuildingInstance): number => {
      const p = this.position(a), q = this.position(b); return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    };
    const link = (a: BuildingInstance, b: BuildingInstance): void => {
      sim.connect(a.id, b.id); wires.push({ a: a.id, b: b.id, from: this.position(a), to: this.position(b) });
    };
    for (let i = 0; i < poles.length; i++) for (let j = i + 1; j < poles.length; j++)
      if (distance(poles[i]!, poles[j]!) <= POWER_RANGE) link(poles[i]!, poles[j]!);
    for (const endpoint of endpoints) {
      const candidates = poles.map(pole => ({ pole, distance: distance(pole, endpoint) }))
        .filter(candidate => candidate.distance <= POWER_RANGE)
        .sort((a, b) => a.distance - b.distance || (a.pole.id < b.pole.id ? -1 : a.pole.id > b.pole.id ? 1 : 0));
      if (candidates[0]) link(candidates[0].pole, endpoint);
    }
    this.simulation = sim; this.wireSnapshot = wires; this.revision = this.buildings.revision;
    sim.refresh();
  }
  fixedUpdate(deltaMs: number): void {
    this.sync();
    if (this.paused()) { this.simulation.refresh(); return; }
    this.simulation.fixedUpdate(deltaMs);
  }
}
