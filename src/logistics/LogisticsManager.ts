import { cellAhead, cellEntryFraction, cellTouchesMachine, splitterOutputTouches, mergerInputTouches, cellTouchesReceiver, cellTouchesSource } from './CellConveyor';
import type { BuildingInstance, BuildingSystem } from '../buildings/BuildingSystem';
import type { SimulationSystem } from '../core/Game';
import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { MachineManager } from '../machines/MachineManager';
import { Smelter, SMELTER_FUEL } from '../machines/Smelter';
import { ConveyorNetwork, type ConveyorSettings, DEFAULT_CONVEYOR_SETTINGS } from './ConveyorNetwork';
import type { GroundItems } from './GroundItems';
import { InventoryReceiver, InventorySource, matchesPort } from './Ports';
import { Splitter } from './Splitter';
import { Merger } from './Merger';
import { directLiftInput, directLiftOutput, directLiftMergerInput, directLiftLink } from './DirectLiftConnections';
import type { ItemSource, ItemReceiver } from './Ports';

import { blocksCellOutput, pathForBuilding, machinePort, splitterPort, mergerPort, isLiftBuilding, RECEIVER_TYPE } from './ConveyorDefinitions';

/** Bridges registered buildings to the existing conveyor simulation, not the renderer. */
export class LogisticsManager implements SimulationSystem {
  readonly id = 'logistics';
  readonly network: ConveyorNetwork;
  private readonly terminals = new Map<string, Inventory>();
  private readonly storageOutputFilters = new Map<string, string>();
  private readonly splitters = new Map<string, Splitter>();
  private readonly mergers = new Map<string, Merger>();
  private seenRevision = -1;
  constructor(private readonly buildings: BuildingSystem, private readonly machines: MachineManager,
    private readonly items: ItemRegistry, private readonly paused: () => boolean = () => false,
    private readonly terminalSlots = 1, private readonly settings: ConveyorSettings = DEFAULT_CONVEYOR_SETTINGS,
    private readonly groundItems?: GroundItems) {
    if (!Number.isSafeInteger(terminalSlots) || terminalSlots < 1) throw new RangeError('Invalid receiver capacity');
    this.network = new ConveyorNetwork(() => false, groundItems ? (item, position) => groundItems.drop(item.id, item.itemId, position) : undefined);
    buildings.addTopologyGuard((before, after) => {
      const relevant = (entries: typeof before) => entries.filter((b) => b.typeId.startsWith('conveyor-') || b.typeId === 'miner-mk1' || (b.typeId === 'smelter' || b.typeId === 'constructor') || b.typeId === RECEIVER_TYPE || b.typeId === 'storage-container' || b.typeId === 'splitter' || b.typeId === 'merger' || isLiftBuilding(b.typeId))
        .map((b) => [b.id, b.typeId, b.transform.x, b.transform.y, b.transform.z, b.transform.rotation, b.autoConveyor, b.cellConveyor]);
      if (JSON.stringify(relevant(before)) === JSON.stringify(relevant(after))) return true;
      this.sync();
      // An entry ramp must not disappear under an item already travelling on it.
      for (const old of before) {
        if (old.typeId !== 'conveyor-cell') continue;
        const next = after.find((b) => b.id === old.id);
        if (next && JSON.stringify(old.cellConveyor?.entries) !== JSON.stringify(next.cellConveyor?.entries) &&
            this.network.get(old.id)?.items.some((item) => item.transition)) return false;
      }
      const paths = new Map(after.map((b) => [b.id, pathForBuilding(b, buildings.cellSize)] as const)
        .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => !!entry[1]));
      return this.network.canReconfigure(paths, this.settings, new Set(after.filter((b) => (b.typeId === 'conveyor-cell' || isLiftBuilding(b.typeId))).map((b) => b.id)));
    });
    buildings.addDemolitionGuard((building) => {
      const segment = this.network.get(building.id);
      return (!segment || segment.items.length === 0) && (this.terminals.get(building.id)?.usedSlots ?? 0) === 0 && !this.splitters.get(building.id)?.pending && !this.mergers.get(building.id)?.occupied;
    });
  }
  merger(id: string): Merger | undefined { return this.mergers.get(id); }
  splitter(id: string): Splitter | undefined { return this.splitters.get(id); }
  terminal(id: string): Inventory | undefined { return this.terminals.get(id); }
  isStorage(id: string): boolean { return this.buildings.get(id)?.typeId === 'storage-container'; }
  /** A null filter preserves the original first-occupied-slot behavior. */
  storageOutputFilter(id: string): string | null {
    if (!this.isStorage(id)) throw new RangeError('Unknown storage container');
    return this.storageOutputFilters.get(id) ?? null;
  }
  setStorageOutputFilter(id: string, itemId: string | null): void {
    if (!this.isStorage(id)) throw new RangeError('Unknown storage container');
    if (itemId !== null) this.items.get(itemId);
    if (itemId === null) this.storageOutputFilters.delete(id);
    else this.storageOutputFilters.set(id, itemId);
  }
  retrieve(id: string, destination: Inventory): QuantityResult {
    const splitter = this.splitters.get(id), merger = this.mergers.get(id);
    if (splitter) return splitter.retrieve(destination);
    if (merger) return merger.retrieve(destination);
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
        this.terminals.delete(id); this.storageOutputFilters.delete(id);
      }
    }
    for (const id of this.storageOutputFilters.keys()) if (!this.isStorage(id)) this.storageOutputFilters.delete(id);
    for (const [id, splitter] of this.splitters) if (!byId.has(id)) {
      if (splitter.pending) throw new Error('Cannot discard a non-empty splitter');
      this.splitters.delete(id);
    }
    for (const [id, merger] of this.mergers) if (!byId.has(id)) {
      if (merger.occupied) throw new Error('Cannot discard a non-empty merger');
      this.mergers.delete(id);
    }
    for (const building of buildings) {
      if (building.typeId === 'merger' && !this.mergers.has(building.id)) this.mergers.set(building.id, new Merger(building.id, this.items));
      if (building.typeId === 'splitter' && !this.splitters.has(building.id)) this.splitters.set(building.id, new Splitter(building.id, this.items));
      const path = pathForBuilding(building, this.buildings.cellSize);
      if (path && !this.network.get(building.id)) {
        if (building.typeId === 'conveyor-cell' || isLiftBuilding(building.typeId)) this.network.addCell(building.id, path, { ...this.settings, spacing: Math.min(this.settings.spacing, path.length / 2) });
        else this.network.add(building.id, path, this.settings);
      }
      if ((building.typeId === RECEIVER_TYPE || building.typeId === 'storage-container') && !this.terminals.has(building.id))
        this.terminals.set(building.id, new Inventory(this.items, building.typeId === 'storage-container' ? 8 : this.terminalSlots));
    }
    const paths = new Map(buildings.map((b) => [b.id, pathForBuilding(b, this.buildings.cellSize)] as const)
      .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => !!entry[1]));
    if (!this.network.reconfigure(paths, this.settings)) throw new Error('Cannot safely reconfigure conveyor items');
    this.network.resetConnections();
    const segments = this.network.all();
    const cells = buildings.filter((b) => b.typeId === 'conveyor-cell');
    const lifts = buildings.filter((b) => isLiftBuilding(b.typeId));
    const attachLiftSource = (building: BuildingInstance, source: ItemSource): boolean => {
      const lift = lifts.find((entry) => {
        if (!directLiftInput(entry, building, this.buildings.cellSize)) return false;
        const path = pathForBuilding(entry, this.buildings.cellSize)!;
        return matchesPort(source.pose, path.point(0), path.direction('input'));
      });
      return !!lift && !this.network.get(lift.id)!.input && this.network.attachCellSource(lift.id, source, 0);
    };
    const attachLiftReceivers = (building: BuildingInstance, receiver: ItemReceiver): void => {
      for (const lift of lifts) if (directLiftOutput(lift, building, this.buildings.cellSize)) this.network.attachCellReceiver(lift.id, receiver);
    };
    const legacy = segments.filter((s) => !this.network.isCell(s.id));
    for (const from of legacy) for (const to of legacy) if (from.id !== to.id && from.path.compatible(to.path)) this.network.connect(from.id, to.id);
    for (const from of cells) {
      const next = cells.find((to) => cellAhead(from, to, this.buildings.cellSize));
      if (next) {
        const b = pathForBuilding(next, this.buildings.cellSize)!;
        this.network.connectCell(from.id, next.id, b.length * cellEntryFraction(from, next, this.buildings.cellSize));
      }
    }
    for (const lift of lifts) {
      const input = cells.find((b) => cellTouchesReceiver(b, lift, this.buildings.cellSize));
      const output = cells.find((b) => cellTouchesSource(b, lift, this.buildings.cellSize));
      if (input) this.network.connectCell(input.id, lift.id, 0);
      if (output) this.network.connectCell(lift.id, output.id, 0);
    }
    // Direct links join coincident lift ports; cell links remain authoritative.
    for (const from of lifts) {
      const to = lifts.find((entry) => directLiftLink(from, entry, this.buildings.cellSize));
      if (to && !this.network.get(from.id)!.output && !this.network.get(to.id)!.input) this.network.connectCell(from.id, to.id, 0);
    }
    for (const building of buildings) {
      const miner = this.machines.get(building.id);
      if (miner) {
        const source = new InventorySource(building.id, machinePort(building, this.buildings.cellSize, 'source'), miner.output, miner.itemId);
        const conditional = { ...source, id: source.id, pose: source.pose,
          peek: () => miner.enabled ? source.peek() : null, take: (itemId: string) => miner.enabled && source.take(itemId) };
        const cell = cells.find((b) => cellTouchesMachine(b, building, this.buildings.cellSize, 'source'));
        if (cell) {
          const path = pathForBuilding(cell, this.buildings.cellSize)!, d = path.direction('input');
          const port = conditional.pose.direction;
          const distance = d.x === port.x && d.z === port.z ? 0 : path.length / 2;
          const start = { x: cell.transform.x - port.x * this.buildings.cellSize / 2, y: conditional.pose.position.y,
            z: cell.transform.z - port.z * this.buildings.cellSize / 2 };
          this.network.attachCellSource(cell.id, conditional, distance, start);
        } else if (!attachLiftSource(building, conditional)) for (const segment of legacy) if (this.network.attachSource(segment.id, conditional)) break;
      }
      const processor = this.machines.smelter(building.id) ?? this.machines.constructorMachine(building.id);
      if (processor) {
        const rawSource = new InventorySource(building.id, machinePort(building, this.buildings.cellSize, 'source'), processor.output, processor.recipe.output.itemId);
        const source = { id: rawSource.id, pose: rawSource.pose, peek: () => processor.enabled ? rawSource.peek() : null,
          take: (itemId: string) => processor.enabled && rawSource.take(itemId) };
        const cell = cells.find((b) => cellTouchesMachine(b, building, this.buildings.cellSize, 'source'));
        if (cell) {
          const path = pathForBuilding(cell, this.buildings.cellSize)!, d = path.direction('input'), port = source.pose.direction;
          const distance = d.x === port.x && d.z === port.z ? 0 : path.length / 2;
          this.network.attachCellSource(cell.id, source, distance, { x: cell.transform.x - port.x * this.buildings.cellSize / 2,
            y: source.pose.position.y, z: cell.transform.z - port.z * this.buildings.cellSize / 2 });
        } else if (!attachLiftSource(building, source)) for (const segment of legacy) if (this.network.attachSource(segment.id, source)) break;
        const pose = machinePort(building, this.buildings.cellSize, 'receiver');
        const ore = new InventoryReceiver(building.id, pose, processor.input);
        const fuel = processor instanceof Smelter ? new InventoryReceiver(building.id, pose, processor.fuel) : null;
        const destination = (itemId: string) => itemId === processor.recipe.input.itemId ? ore : itemId === SMELTER_FUEL.itemId ? fuel : null;
        const receiver = { id: building.id, pose,
          canAccept: (itemId: string) => destination(itemId)?.canAccept(itemId) ?? false,
          accept: (itemId: string) => destination(itemId)?.accept(itemId) ?? false };
        for (const cell of cells) if (cellTouchesMachine(cell, building, this.buildings.cellSize, 'receiver')) this.network.attachCellReceiver(cell.id, receiver);
        attachLiftReceivers(building, receiver);
        for (const segment of legacy) if (this.network.attachReceiver(segment.id, receiver)) break;
      }
      const merger = this.mergers.get(building.id);
      if (merger) {
        for (let i = 0; i < 3; i++) {
          const input = cells.find((cell) => mergerInputTouches(cell, building, this.buildings.cellSize, i));
          const receiver = merger.receiver(i, mergerPort(building, this.buildings.cellSize, i));
          if (input) this.network.attachCellReceiver(input.id, receiver);
          for (const lift of lifts) if (directLiftMergerInput(lift, building, this.buildings.cellSize, i)) this.network.attachCellReceiver(lift.id, receiver);
        }
        const cell = cells.find((b) => cellTouchesMachine(b, building, this.buildings.cellSize, 'source'));
        if (cell) {
          const pose = machinePort(building, this.buildings.cellSize, 'source'), path = pathForBuilding(cell, this.buildings.cellSize)!;
          const d = path.direction('input'), distance = d.x === pose.direction.x && d.z === pose.direction.z ? 0 : path.length / 2;
          this.network.attachCellSource(cell.id, merger.source(pose), distance, { x: cell.transform.x - pose.direction.x * this.buildings.cellSize / 2,
            y: pose.position.y, z: cell.transform.z - pose.direction.z * this.buildings.cellSize / 2 });
        } else attachLiftSource(building, merger.source(machinePort(building, this.buildings.cellSize, 'source')));
      }
      const splitter = this.splitters.get(building.id);
      if (splitter) {
        const input = cells.find((cell) => cellTouchesMachine(cell, building, this.buildings.cellSize, 'receiver'));
        const receiver = splitter.receiver(machinePort(building, this.buildings.cellSize, 'receiver'));
        if (input) this.network.attachCellReceiver(input.id, receiver);
        attachLiftReceivers(building, receiver);
        for (let i = 0; i < 3; i++) {
          const cell = cells.find((entry) => splitterOutputTouches(entry, building, this.buildings.cellSize, i));
          const pose = splitterPort(building, this.buildings.cellSize, i), source = splitter.source(i, pose);
          if (cell) this.network.attachCellSource(cell.id, source, 0);
          else attachLiftSource(building, source);
        }
      }
      const terminal = this.terminals.get(building.id);
      if (terminal) {
        if (building.typeId === 'storage-container') {
          const pose = machinePort(building, this.buildings.cellSize, 'source');
          const selected = (): string | null => {
            const filter = this.storageOutputFilters.get(building.id);
            if (filter) return terminal.getItemCount(filter) > 0 ? filter : null;
            return terminal.snapshot().find((slot) => slot !== null)?.itemId ?? null;
          };
          const source = { id: building.id, pose, peek: selected,
            take: (itemId: string) => selected() === itemId && terminal.removeItem(itemId, 1).moved === 1 };
          const cell = cells.find((b) => cellTouchesMachine(b, building, this.buildings.cellSize, 'source'));
          if (cell) {
            const path = pathForBuilding(cell, this.buildings.cellSize)!, d = path.direction('input'), port = pose.direction;
            const distance = d.x === port.x && d.z === port.z ? 0 : path.length / 2;
            this.network.attachCellSource(cell.id, source, distance, { x: cell.transform.x - port.x * this.buildings.cellSize / 2,
              y: pose.position.y, z: cell.transform.z - port.z * this.buildings.cellSize / 2 });
          } else attachLiftSource(building, source);
        }
        const receiver = new InventoryReceiver(building.id, machinePort(building, this.buildings.cellSize, 'receiver'), terminal);
        for (const cell of cells) if (cellTouchesMachine(cell, building, this.buildings.cellSize, 'receiver')) this.network.attachCellReceiver(cell.id, receiver);
        attachLiftReceivers(building, receiver);
        if (building.typeId === RECEIVER_TYPE) for (const segment of legacy) if (this.network.attachReceiver(segment.id, receiver)) break;
      }
    }
    // Lifts never spill from an unconnected output, even if ordinary cells drop.
    for (const lift of lifts) {
      const segment = this.network.get(lift.id)!;
      if (!segment.output && !segment.receiver) this.network.blockCellOutput(lift.id);
    }
    // A non-accepting building directly ahead is not empty space.
    for (const cell of cells) {
      const segment = this.network.get(cell.id)!;
      if (segment.output || segment.receiver) continue;
      if (buildings.some((b) => blocksCellOutput(cell, b, this.buildings.cellSize, this.buildings.registry, segment.path))) this.network.blockCellOutput(cell.id);
    }
    this.seenRevision = this.buildings.revision;
  }
  /** Items must be inside the footprint and near the building's own level, not
   * beneath a raised foundation or on another floor. Half-open edges disambiguate neighbours. */
  private coversDrop(building: BuildingInstance, position: { x: number; y: number; z: number }): boolean {
    const f = building.transform.footprint, base = building.transform.y;
    const height = this.buildings.registry.get(building.typeId).height;
    const rise = building.cellConveyor?.rise ?? 0, offset = building.cellConveyor?.offset ?? 0;
    return position.x >= f.minX && position.x < f.maxX && position.z >= f.minZ && position.z < f.maxZ &&
      position.y >= base - .05 && position.y <= base + Math.max(height, .5 + offset, .5 + offset + rise) + .3;
  }
  private collectDrops(): Set<string> {
    const priority = new Set<string>(), ground = this.groundItems;
    if (!ground) return priority;
    const buildings = this.buildings.all();
    // Terminal accepts as much as its real inventory permits, in stable drop order.
    for (const terminal of buildings.filter((b) => b.typeId === RECEIVER_TYPE)) {
      const inventory = this.terminals.get(terminal.id)!;
      for (const item of ground.all()) if (this.coversDrop(terminal, item.position)) {
        if (!ground.transfer(item.id, (drop) => {
          try { return inventory.addItem(drop.itemId, 1).moved === 1; } catch { return false; }
        })) ground.lift(item.id, terminal.transform.y + this.buildings.registry.get(terminal.typeId).height + .15);
      }
    }
    for (const cell of buildings.filter((b) => b.typeId === 'conveyor-cell')) {
      const covered = ground.all().filter((item) => this.coversDrop(cell, item.position));
      if (!covered.length) continue;
      // Reserve this tick for floor items, even when the belt is currently full.
      priority.add(cell.id);
      ground.transfer(covered[0]!.id, (drop) => this.network.insertDropped(drop.id, drop.itemId, cell.id));
      const path = this.network.get(cell.id)!.path, deck = path.point(path.length / 2).y;
      for (const item of covered) ground.lift(item.id, deck + .22);
    }
    return priority;
  }
  fixedUpdate(deltaMs: number): void {
    this.sync();
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid logistics tick');
    if (deltaMs > 0 && !this.paused()) {
      const priority = this.collectDrops();
      this.groundItems?.fixedUpdate(deltaMs);
      this.network.fixedUpdate(deltaMs, priority);
    }
  }
}
