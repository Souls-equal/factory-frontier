import type { Inventory } from '../items/Inventory';
import type { SimulationSystem } from '../core/Game';
import { matchesPort, type ItemReceiver, type ItemSource } from './Ports';
import { ConveyorPath, type Point3 } from './ConveyorPath';

export interface ConveyorSettings { readonly speed: number; readonly throughputPerMinute: number; readonly spacing: number }
export const DEFAULT_CONVEYOR_SETTINGS: ConveyorSettings = Object.freeze({ speed: 1, throughputPerMinute: 60, spacing: .5 });
/** Output transfers in the latest 60 one-second simulation-time buckets. */
export interface ConveyorFlowStats { readonly total: number; readonly lastMinute: number }
export type ConveyorState = 'DISCONNECTED' | 'IDLE' | 'RUNNING' | 'BLOCKED' | 'INVALID' | 'ERROR';
export interface CellTransition { readonly from: Point3; readonly to: Point3; readonly distance: number; readonly length: number }
export interface TransportItem { readonly id: string; readonly itemId: string; readonly distance: number; readonly previousPosition: Point3; readonly transition?: CellTransition }
/** The physical position can be on an entry ramp inside the receiving tile. */
export function transportPosition(item: TransportItem, path: ConveyorPath): Point3 {
  const t = item.transition;
  if (!t) return path.point(item.distance);
  const f = Math.min(1, t.distance / t.length);
  return { x: t.from.x + (t.to.x - t.from.x) * f, y: t.from.y + (t.to.y - t.from.y) * f, z: t.from.z + (t.to.z - t.from.z) * f };
}
export interface ConveyorSegment {
  readonly id: string;
  readonly path: ConveyorPath;
  readonly settings: ConveyorSettings;
  readonly items: readonly TransportItem[];
  readonly input: string | null;
  readonly output: string | null;
  readonly source: ItemSource | null;
  readonly receiver: ItemReceiver | null;
  readonly state: ConveyorState;
  /** Earliest allowed transfer, expressed on the fixed simulation clock. */
  readonly nextOutputMs: number;
  readonly nextInputMs: number;
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
type InternalItem = Mutable<TransportItem>;
type InternalSegment = Omit<Mutable<ConveyorSegment>, 'items'> & { items: InternalItem[] };

/** Single-input/single-output directed paths. Topology changes are explicit. */
export class ConveyorNetwork implements SimulationSystem {
  readonly id = 'conveyors';
  private readonly segments = new Map<string, InternalSegment>();
  private readonly flow = new Map<string, { total: number; buckets: Map<number, number> }>();
  private nextItem = 1;
  private readonly cells = new Set<string>();
  private readonly cellInputDistance = new Map<string, number>();
  private readonly cellObstacle = new Set<string>();
  private readonly cellSourceStart = new Map<string, Point3>();
  private cellOrder = 0;
  private timeMs = 0;
  private readonly active = new Set<string>();
  private routes: InternalSegment[][] = [];
  constructor(private readonly paused: () => boolean = () => false,
    private readonly drop?: (item: TransportItem, position: Point3) => void) {}
  get dropsOpenEnds(): boolean { return !!this.drop; }
  isCell(id: string): boolean { return this.cells.has(id); }
  isOutputBlocked(id: string): boolean { return this.cellObstacle.has(id); }
  get(id: string): ConveyorSegment | undefined { return this.segments.get(id); }
  all(): readonly ConveyorSegment[] { return [...this.segments.values()]; }
  /** Count completed handoffs and ground drops, not manual pickups. Uses the
   * simulation clock, so pausing or opening an inspection never ages samples. */
  flowStats(id: string): ConveyorFlowStats | undefined {
    if (!this.segments.has(id)) return undefined;
    const data = this.flow.get(id), now = Math.floor(this.timeMs / 1000);
    let lastMinute = 0;
    if (data) for (const [second, count] of data.buckets) if (second > now - 60 && second <= now) lastMinute += count;
    return { total: data?.total ?? 0, lastMinute };
  }
  private recordOutput(id: string): void {
    let data = this.flow.get(id);
    if (!data) { data = { total: 0, buckets: new Map() }; this.flow.set(id, data); }
    const second = Math.floor(this.timeMs / 1000);
    for (const previous of data.buckets.keys()) if (previous <= second - 60) data.buckets.delete(previous);
    data.buckets.set(second, (data.buckets.get(second) ?? 0) + 1); data.total++;
  }
  findItem(id: string): { item: TransportItem; position: Point3 } | undefined {
    for (const segment of this.segments.values()) {
      const item = segment.items.find((entry) => entry.id === id);
      if (item) return { item, position: transportPosition(item, segment.path) };
    }
    return undefined;
  }
  pickup(id: string, inventory: Inventory): boolean {
    for (const segment of this.segments.values()) {
      const index = segment.items.findIndex((item) => item.id === id);
      if (index < 0) continue;
      if (inventory.addItem(segment.items[index]!.itemId, 1).moved !== 1) return false;
      segment.items.splice(index, 1); this.refreshStates(); return true;
    }
    return false;
  }
  /** Admit a dropped item at the cell centre only when spacing permits. */
  insertDropped(id: string, itemId: string, segmentId: string): boolean {
    const segment = this.segments.get(segmentId);
    const distance = segment ? segment.path.length / 2 : 0;
    if (!segment || !this.cells.has(segmentId) || !id || !itemId || this.findItem(id) ||
        segment.items.some((item) => Math.abs(item.distance - distance) < segment.settings.spacing - 1e-8)) return false;
    segment.items.push({ id, itemId, distance, previousPosition: segment.path.point(distance) });
    segment.items.sort((a, b) => b.distance - a.distance); this.refreshStates(); return true;
  }
  add(id: string, path: ConveyorPath, settings: ConveyorSettings = DEFAULT_CONVEYOR_SETTINGS): ConveyorSegment {
    if (!id.trim() || this.segments.has(id) || ![settings.speed, settings.throughputPerMinute, settings.spacing].every(Number.isFinite) ||
        settings.speed <= 0 || settings.throughputPerMinute <= 0 || settings.spacing <= 0 || settings.spacing > path.length) {
      throw new RangeError('Invalid conveyor segment.');
    }
    const segment: InternalSegment = { id, path, settings: Object.freeze({ ...settings }), items: [], input: null, output: null,
      source: null, receiver: null, state: 'DISCONNECTED', nextInputMs: 0, nextOutputMs: 0 };
    this.segments.set(id, segment); this.refreshStates(); return segment;
  }
  addCell(id: string, path: ConveyorPath, settings: ConveyorSettings): ConveyorSegment {
    const segment = this.add(id, path, settings); this.cells.add(id); this.refreshStates(); return segment;
  }
  connectCell(fromId: string, toId: string, inputDistance: number): boolean {
    const from = this.require(fromId), to = this.require(toId);
    if (!this.cells.has(fromId) || !this.cells.has(toId) || fromId === toId || from.output || from.receiver || !Number.isFinite(inputDistance) || inputDistance < 0 || inputDistance > to.path.length) return false;
    from.output = toId; to.input ??= fromId; this.cellInputDistance.set(fromId, inputDistance); this.refreshStates(); return true;
  }
  attachCellSource(id: string, source: ItemSource, distance: number, start?: Point3): boolean {
    const s = this.require(id);
    if (!this.cells.has(id) || s.source || !Number.isFinite(distance) || distance < 0 || distance > s.path.length || this.all().some((entry) => entry.source?.id === source.id)) return false;
    s.source = source; this.cellInputDistance.set(`source:${id}`, distance); if (start) this.cellSourceStart.set(id, start); this.refreshStates(); return true;
  }
  attachCellReceiver(id: string, receiver: ItemReceiver): boolean {
    const s = this.require(id);
    if (!this.cells.has(id) || s.output || s.receiver) return false;
    s.receiver = receiver; this.refreshStates(); return true;
  }
  blockCellOutput(id: string): void { if (this.cells.has(id)) this.cellObstacle.add(id); }
  /**
   * Project every item onto a proposed topology without mutating the network.
   * Distances remain measured from the inlet; a shortened tile can move an item
   * onto its new successor. Reject any proposal that cannot preserve spacing.
   */
  private projectPaths(paths: ReadonlyMap<string, ConveyorPath>, newSettings: ConveyorSettings, cellIds: ReadonlySet<string> = this.cells): Map<string, InternalItem[]> | null {
    const projected = new Map<string, InternalItem[]>();
    const successor = new Map<string, string>();
    const predecessors = new Set<string>();
    for (const [id, path] of paths) {
      const settings = this.segments.get(id)?.settings ?? newSettings;
      if (!cellIds.has(id) && settings.spacing > path.length) return null;
      projected.set(id, []);
      if (cellIds.has(id)) continue;
      for (const [nextId, next] of paths) {
        if (id === nextId || cellIds.has(nextId) || !path.compatible(next)) continue;
        if (successor.has(id) || predecessors.has(nextId)) return null;
        successor.set(id, nextId); predecessors.add(nextId);
      }
    }
    for (const segment of this.segments.values()) {
      if (!paths.has(segment.id)) { if (segment.items.length) return null; continue; }
      if (this.cells.has(segment.id)) {
        const path = paths.get(segment.id)!;
        const changed = JSON.stringify(path.spec) !== JSON.stringify(segment.path.spec);
        if (changed && segment.items.some((item) => item.transition)) return null;
        projected.set(segment.id, segment.items.map((item) => {
          const distance = changed ? item.distance / segment.path.length * path.length : item.distance;
          return { ...item, distance, previousPosition: changed ? path.point(distance) : item.previousPosition };
        }));
        continue;
      }
      for (const item of segment.items) {
        let id = segment.id, distance = item.distance;
        const visited = new Set<string>();
        while (distance > paths.get(id)!.length + 1e-9) {
          if (visited.has(id)) return null;
          visited.add(id); distance -= paths.get(id)!.length;
          const next = successor.get(id); if (!next) return null;
          id = next;
        }
        const path = paths.get(id)!;
        distance = Math.min(distance, path.length);
        const changed = id !== segment.id || JSON.stringify(path.spec) !== JSON.stringify(segment.path.spec);
        projected.get(id)!.push({ ...item, distance, previousPosition: changed ? path.point(distance) : item.previousPosition });
      }
    }
    for (const items of projected.values()) items.sort((a, b) => b.distance - a.distance);
    for (const [id, items] of projected) {
      const settings = this.segments.get(id)?.settings ?? newSettings;
      for (let i = 1; i < items.length; i++) if (items[i - 1]!.distance - items[i]!.distance < settings.spacing - 1e-8) return null;
      const next = successor.get(id);
      if (next && items[0] && projected.get(next)!.length) {
        const back = projected.get(next)!.at(-1)!;
        const gap = Math.max(settings.spacing, (this.segments.get(next)?.settings ?? newSettings).spacing);
        if (paths.get(id)!.length - items[0]!.distance + back.distance < gap - 1e-8) return null;
      }
    }
    return projected;
  }
  canReconfigure(paths: ReadonlyMap<string, ConveyorPath>, newSettings: ConveyorSettings, cellIds: ReadonlySet<string> = this.cells): boolean {
    return this.projectPaths(paths, newSettings, cellIds) !== null;
  }
  /** Apply a validated projection atomically, keeping ids, ordering and clocks. */
  reconfigure(paths: ReadonlyMap<string, ConveyorPath>, newSettings: ConveyorSettings): boolean {
    const projected = this.projectPaths(paths, newSettings);
    if (!projected || paths.size !== this.segments.size || [...paths.keys()].some((id) => !this.segments.has(id))) return false;
    for (const [id, path] of paths) {
      const segment = this.require(id);
      segment.path = path; segment.items = projected.get(id)!;
    }
    return true;
  }
  private require(id: string): InternalSegment { const s = this.segments.get(id); if (!s) throw new RangeError(`Unknown conveyor: ${id}`); return s; }
  connect(fromId: string, toId: string): boolean {
    const from = this.require(fromId), to = this.require(toId);
    if (from === to || from.output || from.receiver || to.input || to.source || !from.path.compatible(to.path)) return false;
    const front = from.items[0], back = to.items.at(-1);
    if (front && back && from.path.length - front.distance + back.distance < Math.max(from.settings.spacing, to.settings.spacing) - 1e-8) return false;
    for (let p: InternalSegment | undefined = to; p; p = p.output ? this.segments.get(p.output) : undefined) if (p === from) return false;
    from.output = to.id; to.input = from.id; this.refreshStates(); return true;
  }
  attachSource(id: string, source: ItemSource): boolean {
    const s = this.require(id);
    if (s.input || s.source || !matchesPort(source.pose, s.path.point(0), s.path.direction('input')) || this.all().some((entry) => entry.source?.id === source.id)) return false;
    s.source = source; this.refreshStates(); return true;
  }
  attachReceiver(id: string, receiver: ItemReceiver): boolean {
    const s = this.require(id);
    if (s.output || s.receiver || !matchesPort(receiver.pose, s.path.point(s.path.length), s.path.direction('output')) || this.all().some((entry) => entry.receiver?.id === receiver.id)) return false;
    s.receiver = receiver; this.refreshStates(); return true;
  }
  /** Clear only links, preserving segment ownership, items and cooldowns. */
  resetConnections(): void {
    this.cellInputDistance.clear(); this.cellObstacle.clear(); this.cellSourceStart.clear();
    for (const segment of this.segments.values()) {
      segment.input = null; segment.output = null; segment.source = null; segment.receiver = null;
    }
    this.refreshStates();
  }
  /** Refuse destruction while items remain; disconnect neighbours synchronously. */
  remove(id: string): boolean {
    const s = this.require(id); if (s.items.length) return false;
    if (this.cells.has(id)) {
      for (const other of this.segments.values()) {
        if (other.output === id) other.output = null;
        if (other.input === id) other.input = null;
      }
      this.cells.delete(id); this.cellInputDistance.delete(id); this.cellObstacle.delete(id);
    } else {
      if (s.input) this.require(s.input).output = null;
      if (s.output) this.require(s.output).input = null;
    }
    this.segments.delete(id); this.flow.delete(id); this.refreshStates(); return true;
  }
  /** Rebuild routes on topology changes, never while rendering or per item. */
  private refreshStates(): void {
    this.active.clear(); this.routes = [];
    for (const terminal of this.segments.values()) {
      if (this.cells.has(terminal.id) || terminal.output) continue;
      const route: InternalSegment[] = [];
      let cursor: InternalSegment | undefined = terminal;
      while (cursor) { route.push(cursor); cursor = cursor.input ? this.segments.get(cursor.input) : undefined; }
      if (!route.at(-1)?.source) continue;
      this.routes.push(route);
      for (const segment of route) this.active.add(segment.id);
    }
    for (const s of this.segments.values()) s.state = this.cells.has(s.id) ? (s.items.length ? 'RUNNING' : 'IDLE') : !this.active.has(s.id) ? 'DISCONNECTED' : s.items.length ? 'RUNNING' : 'IDLE';
  }
  fixedUpdate(deltaMs: number, priorityInputs: ReadonlySet<string> = new Set()): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid conveyor tick.');
    if (deltaMs === 0 || this.paused()) return;
    this.timeMs += deltaMs;
    for (const segment of this.segments.values()) for (const item of segment.items) item.previousPosition = transportPosition(item, segment.path);
    this.advanceCells(deltaMs, priorityInputs);
    // Walk each path downstream-to-upstream. Newly transferred items do not move twice.
    for (const route of this.routes) for (const segment of route) this.advance(segment, deltaMs);
    for (const s of this.segments.values()) {
      if (this.cells.has(s.id) || !s.source || !this.active.has(s.id) || this.timeMs < s.nextInputMs) continue;
      const first = s.items.at(-1);
      if (first && first.distance < s.settings.spacing) continue;
      const itemId = s.source.peek();
      if (itemId && s.source.take(itemId)) {
        s.items.push({ id: `transport-${this.nextItem++}`, itemId, distance: 0, previousPosition: s.path.point(0) });
        s.nextInputMs = this.timeMs + 60000 / s.settings.throughputPerMinute;
      }
    }
    for (const s of this.segments.values()) {
      if (this.cells.has(s.id)) continue;
      if (!this.active.has(s.id)) { s.state = 'DISCONNECTED'; continue; }
      const first = s.items[0];
      const blocked = !!first && (s.output ? (() => {
        const next = this.require(s.output!); const back = next.items.at(-1);
        const gap = Math.max(s.settings.spacing, next.settings.spacing);
        return !!back && first.distance >= s.path.length + back.distance - gap - 1e-9;
      })() : first.distance >= s.path.length - 1e-9 && (s.receiver ? !s.receiver.canAccept(first.itemId) : !this.drop));
      s.state = blocked ? 'BLOCKED' : s.items.length ? 'RUNNING' : 'IDLE';
    }
  }
  /** Fixed-tick two-phase update: movement first, then deterministic transfers.
   * This handles cycles and fan-in without moving an item twice in a tick. */
  private advanceCells(deltaMs: number, priorityInputs: ReadonlySet<string>): void {
    const cells = [...this.cells].map((id) => this.require(id));
    for (const s of cells) {
      let ahead = Infinity;
      for (const item of s.items) {
        if (item.transition) {
          const distance = Math.min(item.transition.length, item.transition.distance + s.settings.speed * deltaMs / 1000);
          item.transition = distance >= item.transition.length - 1e-9 ? undefined : { ...item.transition, distance };
        } else {
          item.distance = Math.max(item.distance, Math.min(s.path.length, item.distance + s.settings.speed * deltaMs / 1000, ahead - s.settings.spacing));
        }
        ahead = item.distance;
      }
    }
    if (cells.length) this.cellOrder = (this.cellOrder + 1) % cells.length;
    const ordered = [...cells.slice(this.cellOrder), ...cells.slice(0, this.cellOrder)];
    for (const s of ordered) {
      const item = s.items[0];
      if (!item || item.transition || item.distance < s.path.length - 1e-9 || this.timeMs < s.nextOutputMs) continue;
      let transferred = false;
      if (s.output) {
        const next = this.require(s.output), distance = this.cellInputDistance.get(s.id)!;
        const gap = Math.max(s.settings.spacing, next.settings.spacing);
        if (!priorityInputs.has(next.id) && next.items.every((other) => Math.abs(other.distance - distance) >= gap - 1e-8)) {
          const from = s.path.point(s.path.length), to = next.path.point(distance);
          const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
          item.distance = distance;
          item.transition = length > 1e-9 ? { from, to, distance: 0, length } : undefined;
          next.items.push(item); next.items.sort((a, b) => b.distance - a.distance);
          transferred = true;
        }
      } else if (s.receiver) {
        transferred = s.receiver.canAccept(item.itemId) && s.receiver.accept(item.itemId);
      } else if (!this.cellObstacle.has(s.id) && this.drop) {
        const end = s.path.point(s.path.length), d = s.path.direction('output');
        this.drop(item, { x: end.x + .2 * d.x, y: end.y + .22, z: end.z + .2 * d.z }); transferred = true;
      }
      if (transferred) { this.recordOutput(s.id); s.items.shift(); s.nextOutputMs = this.timeMs + 60000 / s.settings.throughputPerMinute; }
    }
    // Resolve grouped sources once against belts that actually have space. This
    // avoids fixed iteration-order bias and permits fallback when a branch fills.
    const ready = cells.filter((s) => {
      if (!s.source || priorityInputs.has(s.id) || this.timeMs < s.nextInputMs) return false;
      const distance = this.cellInputDistance.get(`source:${s.id}`) ?? 0;
      return s.items.every((other) => Math.abs(other.distance - distance) >= s.settings.spacing - 1e-8);
    });
    const groups = new Map<NonNullable<ItemSource['arbiter']>, InternalSegment[]>();
    for (const s of ready) if (s.source!.arbiter) {
      const arbiter = s.source!.arbiter;
      if (!groups.has(arbiter)) groups.set(arbiter, []);
      groups.get(arbiter)!.push(s);
    }
    const chosen = new Set<string>();
    for (const [arbiter, entries] of groups) {
      const id = arbiter.choose(entries.map((entry) => entry.source!.id));
      if (id) chosen.add(id);
    }
    for (const s of ready) {
      const source = s.source!;
      if (source.arbiter && !chosen.has(source.id)) continue;
      const distance = this.cellInputDistance.get(`source:${s.id}`) ?? 0;
      const itemId = source.peek();
      if (itemId && source.take(itemId)) {
        const to = s.path.point(distance), from = this.cellSourceStart.get(s.id) ?? to;
        const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
        s.items.push({ id: `transport-${this.nextItem++}`, itemId, distance, previousPosition: from,
          ...(length > 1e-9 ? { transition: { from, to, distance: 0, length } } : {}) });
        s.items.sort((a, b) => b.distance - a.distance); s.nextInputMs = this.timeMs + 60000 / s.settings.throughputPerMinute;
      }
    }
    for (const s of cells) {
      const first = s.items[0];
      s.state = first && first.distance >= s.path.length - 1e-9 &&
        (s.output ? (() => { const next = this.require(s.output!); const at = this.cellInputDistance.get(s.id)!;
          return priorityInputs.has(next.id) || next.items.some((item) => Math.abs(item.distance - at) < Math.max(s.settings.spacing, next.settings.spacing) - 1e-8); })() :
          s.receiver ? !s.receiver.canAccept(first.itemId) : this.cellObstacle.has(s.id) || !this.drop)
        ? 'BLOCKED' : s.items.length ? 'RUNNING' : 'IDLE';
    }
  }
  private advance(s: InternalSegment, deltaMs: number): void {
    const length = s.path.length, delta = s.settings.speed * deltaMs / 1000;
    let ahead = Infinity;
    for (let i = 0; i < s.items.length; i++) {
      const item = s.items[i]!;
      const previousDistance = item.distance;
      const desired = Math.min(item.distance + delta, ahead - s.settings.spacing);
      const next = s.output ? this.require(s.output) : undefined;
      const back = next?.items.at(-1);
      const gap = Math.max(s.settings.spacing, next?.settings.spacing ?? 0);
      // Keep the centre at least a spacing away from the item on the next segment.
      const boundary = back ? length + back.distance - gap : Infinity;
      item.distance = Math.max(item.distance, Math.min(desired, length, boundary));
      if (i === 0 && desired >= length && item.distance >= length - 1e-9 && this.timeMs >= s.nextOutputMs) {
        if (next && (!back || back.distance >= gap)) {
          const remainingSeconds = Math.max(0, deltaMs / 1000 - (length - previousDistance) / s.settings.speed);
          item.distance = Math.min(remainingSeconds * next.settings.speed, back ? back.distance - gap : next.path.length, next.path.length);
          next.items.push(item); this.recordOutput(s.id); s.items.splice(i, 1); i--;
          s.nextOutputMs = this.timeMs + 60000 / s.settings.throughputPerMinute; continue;
        }
        if (!next && !s.receiver && this.drop) {
          const end = s.path.point(length), direction = s.path.direction('output');
          this.drop(item, { x: end.x + direction.x * .2, y: end.y + .22, z: end.z + direction.z * .2 });
          this.recordOutput(s.id); s.items.splice(i, 1); i--; s.nextOutputMs = this.timeMs + 60000 / s.settings.throughputPerMinute; continue;
        }
        if (!next && s.receiver?.canAccept(item.itemId) && s.receiver.accept(item.itemId)) {
          this.recordOutput(s.id); s.items.splice(i, 1); i--; s.nextOutputMs = this.timeMs + 60000 / s.settings.throughputPerMinute; continue;
        }
      }
      ahead = item.distance;
    }
  }
}
