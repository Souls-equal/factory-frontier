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
      const relevant = (entries: typeof before) => entries.filter((b) => b.typeId === 'conveyor-auto' || b.typeId === 'miner-mk1' || b.typeId === RECEIVER_TYPE)
        .map((b) => [b.id, b.typeId, b.transform.x, b.transform.y, b.transform.z, b.transform.rotation, b.autoConveyor]);
      if (!before.some((b) => b.typeId === 'conveyor-auto') && !after.some((b) => b.typeId === 'conveyor-auto')) return true;
      if (JSON.stringify(relevant(before)) === JSON.stringify(relevant(after))) return true;
      this.sync();
      const oldPaths = new Map(before.map((b) => [b.id, pathForBuilding(b, buildings.cellSize)]));
      const newPaths = new Map(after.map((b) => [b.id, pathForBuilding(b, buildings.cellSize)]));
      for (const segment of this.network.all()) {
        if (JSON.stringify(oldPaths.get(segment.id)?.spec) !== JSON.stringify(newPaths.get(segment.id)?.spec) && segment.items.length) return false;
      }
      // Check every proposed join, including two previously separate occupied lines.
      for (const [fromId, from] of newPaths) for (const [toId, to] of newPaths) {
        if (!from || !to || fromId === toId || !from.compatible(to)) continue;
        const a = this.network.get(fromId), b = this.network.get(toId);
        const front = a?.items[0], back = b?.items.at(-1);
        if (front && back && from.length - front.distance + back.distance < Math.max(a!.settings.spacing, b!.settings.spacing)) return false;
      }
      return true;
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
      const segment = this.network.get(building.id);
      if (path && segment && JSON.stringify(path.spec) !== JSON.stringify(segment.path.spec)) {
        if (!this.network.reshape(building.id, path)) throw new Error('Cannot reshape an occupied conveyor');
      }
      if (path && !this.network.get(building.id)) this.network.add(building.id, path, this.settings);
      if (building.typeId === RECEIVER_TYPE && !this.terminals.has(building.id)) this.terminals.set(building.id, new Inventory(this.items, this.terminalSlots));
    }
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
