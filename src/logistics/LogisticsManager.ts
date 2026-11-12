import type { BuildingSystem } from '../buildings/BuildingSystem';
import type { SimulationSystem } from '../core/Game';
import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { MachineManager } from '../machines/MachineManager';
import { ConveyorNetwork, type ConveyorSettings, DEFAULT_CONVEYOR_SETTINGS } from './ConveyorNetwork';
import { InventoryReceiver, InventorySource } from './Ports';

import { pathForBuilding, machinePort, RECEIVER_TYPE } from './ConveyorDefinitions';

/** Bridges registered buildings to the existing conveyor simulation, not the renderer. */
export class LogisticsManager implements SimulationSystem {
  readonly id = 'logistics';
  readonly network: ConveyorNetwork;
  private readonly terminals = new Map<string, Inventory>();
  private seenRevision = -1;
  constructor(private readonly buildings: BuildingSystem, private readonly machines: MachineManager,
    private readonly items: ItemRegistry, private readonly paused: () => boolean = () => false,
    private readonly terminalSlots = 1, private readonly settings: ConveyorSettings = DEFAULT_CONVEYOR_SETTINGS) {
    if (!Number.isSafeInteger(terminalSlots) || terminalSlots < 1) throw new RangeError('Invalid receiver capacity');
    this.network = new ConveyorNetwork();
    buildings.addTopologyGuard((before, after) => {
      const relevant = (entries: typeof before) => entries.filter((b) => b.typeId.startsWith('conveyor-') || b.typeId === 'miner-mk1' || b.typeId === RECEIVER_TYPE)
        .map((b) => [b.id, b.typeId, b.transform.x, b.transform.y, b.transform.z, b.transform.rotation, b.autoConveyor]);
      if (JSON.stringify(relevant(before)) === JSON.stringify(relevant(after))) return true;
      this.sync();
      const paths = new Map(after.map((b) => [b.id, pathForBuilding(b, buildings.cellSize)] as const)
        .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => !!entry[1]));
      return this.network.canReconfigure(paths, this.settings);
    });
    buildings.addDemolitionGuard((building) => {
      const segment = this.network.get(building.id);
      return (!segment || segment.items.length === 0) && (this.terminals.get(building.id)?.usedSlots ?? 0) === 0;
    });
  }
  terminal(id: string): Inventory | undefined { return this.terminals.get(id); }
  retrieve(id: string, destination: Inventory): QuantityResult {
    const inventory = this.terminals.get(id);
    if (!inventory) throw new RangeError('Unknown receiving terminal');
    let requested = 0, moved = 0;
    for (const slot of inventory.snapshot()) {
      if (!slot) continue;
      const result = inventory.transferItem(destination, slot.itemId, slot.quantity);
      requested += result.requested; moved += result.moved;
    }
    return { requested, moved, remainder: requested - moved };
  }
  sync(): void {
    if (this.seenRevision === this.buildings.revision) return;
    this.machines.sync();
    const buildings = this.buildings.all(), byId = new Map(buildings.map((building) => [building.id, building]));
    for (const segment of this.network.all()) {
      if (!byId.has(segment.id) && !this.network.remove(segment.id)) throw new Error('Cannot discard an occupied conveyor');
    }
    for (const [id, inventory] of this.terminals) {
      if (!byId.has(id)) {
        if (inventory.usedSlots) throw new Error('Cannot discard a non-empty receiving terminal');
        this.terminals.delete(id);
      }
    }
    for (const building of buildings) {
      const path = pathForBuilding(building, this.buildings.cellSize);
      if (path && !this.network.get(building.id)) this.network.add(building.id, path, this.settings);
      if (building.typeId === RECEIVER_TYPE && !this.terminals.has(building.id)) this.terminals.set(building.id, new Inventory(this.items, this.terminalSlots));
    }
    const paths = new Map(buildings.map((b) => [b.id, pathForBuilding(b, this.buildings.cellSize)] as const)
      .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => !!entry[1]));
    if (!this.network.reconfigure(paths, this.settings)) throw new Error('Cannot safely reconfigure conveyor items');
    this.network.resetConnections();
    const segments = this.network.all();
    for (const from of segments) for (const to of segments) if (from.id !== to.id && from.path.compatible(to.path)) this.network.connect(from.id, to.id);
    for (const building of buildings) {
      const miner = this.machines.get(building.id);
      if (miner) {
        const source = new InventorySource(building.id, machinePort(building, this.buildings.cellSize, 'source'), miner.output, miner.itemId);
        const conditional = { ...source, id: source.id, pose: source.pose,
          peek: () => miner.enabled ? source.peek() : null, take: (itemId: string) => miner.enabled && source.take(itemId) };
        for (const segment of segments) if (this.network.attachSource(segment.id, conditional)) break;
      }
      const terminal = this.terminals.get(building.id);
      if (terminal) {
        const receiver = new InventoryReceiver(building.id, machinePort(building, this.buildings.cellSize, 'receiver'), terminal);
        for (const segment of segments) if (this.network.attachReceiver(segment.id, receiver)) break;
      }
    }
    this.seenRevision = this.buildings.revision;
  }
  fixedUpdate(deltaMs: number): void { this.sync(); if (!this.paused()) this.network.fixedUpdate(deltaMs); }
}
