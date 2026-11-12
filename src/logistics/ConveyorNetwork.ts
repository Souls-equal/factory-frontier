import type { SimulationSystem } from '../core/Game';
import { matchesPort, type ItemReceiver, type ItemSource } from './Ports';
import { ConveyorPath } from './ConveyorPath';

export interface ConveyorSettings { readonly speed: number; readonly throughputPerMinute: number; readonly spacing: number }
export const DEFAULT_CONVEYOR_SETTINGS: ConveyorSettings = Object.freeze({ speed: 1, throughputPerMinute: 60, spacing: .5 });
export type ConveyorState = 'DISCONNECTED' | 'IDLE' | 'RUNNING' | 'BLOCKED';
export interface TransportItem { readonly id: string; readonly itemId: string; readonly distance: number; }
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
  private nextItem = 1;
  private timeMs = 0;
  private readonly active = new Set<string>();
  private routes: InternalSegment[][] = [];
  constructor(private readonly paused: () => boolean = () => false) {}
  get(id: string): ConveyorSegment | undefined { return this.segments.get(id); }
  all(): readonly ConveyorSegment[] { return [...this.segments.values()]; }
  add(id: string, path: ConveyorPath, settings: ConveyorSettings = DEFAULT_CONVEYOR_SETTINGS): ConveyorSegment {
    if (!id.trim() || this.segments.has(id) || ![settings.speed, settings.throughputPerMinute, settings.spacing].every(Number.isFinite) ||
        settings.speed <= 0 || settings.throughputPerMinute <= 0 || settings.spacing <= 0 || settings.spacing > path.length) {
      throw new RangeError('Invalid conveyor segment.');
    }
    const segment: InternalSegment = { id, path, settings: Object.freeze({ ...settings }), items: [], input: null, output: null,
      source: null, receiver: null, state: 'DISCONNECTED', nextInputMs: 0, nextOutputMs: 0 };
    this.segments.set(id, segment); this.refreshStates(); return segment;
  }
  private require(id: string): InternalSegment { const s = this.segments.get(id); if (!s) throw new RangeError(`Unknown conveyor: ${id}`); return s; }
  connect(fromId: string, toId: string): boolean {
    const from = this.require(fromId), to = this.require(toId);
    if (from === to || from.output || from.receiver || to.input || to.source || !from.path.compatible(to.path)) return false;
    const front = from.items[0], back = to.items.at(-1);
    if (front && back && from.path.length - front.distance + back.distance < Math.max(from.settings.spacing, to.settings.spacing)) return false;
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
  /** Refuse destruction while items remain; disconnect neighbours synchronously. */
  remove(id: string): boolean {
    const s = this.require(id); if (s.items.length) return false;
    if (s.input) this.require(s.input).output = null;
    if (s.output) this.require(s.output).input = null;
    this.segments.delete(id); this.refreshStates(); return true;
  }
  /** Rebuild routes on topology changes, never while rendering or per item. */
  private refreshStates(): void {
    this.active.clear(); this.routes = [];
    for (const terminal of this.segments.values()) {
      if (terminal.output || !terminal.receiver) continue;
      const route: InternalSegment[] = [];
      let cursor: InternalSegment | undefined = terminal;
      while (cursor) { route.push(cursor); cursor = cursor.input ? this.segments.get(cursor.input) : undefined; }
      if (!route.at(-1)?.source) continue;
      this.routes.push(route);
      for (const segment of route) this.active.add(segment.id);
    }
    for (const s of this.segments.values()) s.state = !this.active.has(s.id) ? 'DISCONNECTED' : s.items.length ? 'RUNNING' : 'IDLE';
  }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid conveyor tick.');
    if (deltaMs === 0 || this.paused()) return;
    this.timeMs += deltaMs;
    // Walk each path downstream-to-upstream. Newly transferred items do not move twice.
    for (const route of this.routes) for (const segment of route) this.advance(segment, deltaMs);
    for (const s of this.segments.values()) {
      if (!s.source || !this.active.has(s.id) || this.timeMs < s.nextInputMs) continue;
      const first = s.items.at(-1);
      if (first && first.distance < s.settings.spacing) continue;
      const itemId = s.source.peek();
      if (itemId && s.source.take(itemId)) {
        s.items.push({ id: `transport-${this.nextItem++}`, itemId, distance: 0 });
        s.nextInputMs = this.timeMs + 60000 / s.settings.throughputPerMinute;
      }
    }
    for (const s of this.segments.values()) {
      if (!this.active.has(s.id)) { s.state = 'DISCONNECTED'; continue; }
      const first = s.items[0];
      const blocked = !!first && (s.output ? (() => {
        const next = this.require(s.output!); const back = next.items.at(-1);
        const gap = Math.max(s.settings.spacing, next.settings.spacing);
        return !!back && first.distance >= s.path.length + back.distance - gap - 1e-9;
      })() : first.distance >= s.path.length - 1e-9 && !!s.receiver && !s.receiver.canAccept(first.itemId));
      s.state = blocked ? 'BLOCKED' : s.items.length ? 'RUNNING' : 'IDLE';
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
          next.items.push(item); s.items.splice(i, 1); i--;
          s.nextOutputMs = this.timeMs + 60000 / s.settings.throughputPerMinute; continue;
        }
        if (!next && s.receiver?.canAccept(item.itemId) && s.receiver.accept(item.itemId)) {
          s.items.splice(i, 1); i--; s.nextOutputMs = this.timeMs + 60000 / s.settings.throughputPerMinute; continue;
        }
      }
      ahead = item.distance;
    }
  }
}
