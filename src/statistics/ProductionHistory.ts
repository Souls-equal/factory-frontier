import type { SimulationSystem } from '../core/Game';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { MachineManager } from '../machines/MachineManager';

export interface ProductionRow {
  readonly itemId: string;
  readonly produced: number;
  readonly consumed: number;
  readonly extracted: number;
  readonly producedPerMinute: number;
  readonly consumedPerMinute: number;
  readonly extractedPerMinute: number;
}
type Totals = { produced: number; consumed: number; extracted: number };
type Bucket = Map<string, Totals>;
const zero = (): Totals => ({ produced: 0, consumed: 0, extracted: 0 });

/** Samples authoritative counters after each fixed step. The latest 60 whole
 * one-second simulation buckets are retained, even after a machine is removed.
 * Completion events are assigned to the end of their fixed step. */
export class ProductionHistory implements SimulationSystem {
  readonly id = 'production-history';
  private timeMs = 0;
  private readonly previous = new Map<string, Map<string, Totals>>();
  private readonly buckets = new Map<number, Bucket>();
  constructor(private readonly machines: MachineManager, private readonly items: ItemRegistry,
    private readonly paused: () => boolean = () => false) {}
  get elapsedMs(): number { return this.timeMs; }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid statistics tick');
    if (!deltaMs || this.paused()) return;
    this.timeMs += deltaMs;
    const second = Math.floor(this.timeMs / 1000);
    for (const key of this.buckets.keys()) if (key <= second - 60) this.buckets.delete(key);
    const miners = this.machines.all(), processors = [...this.machines.allSmelters(), ...this.machines.allConstructors(), ...this.machines.allAdvanced()];
    const active = new Set([...miners, ...processors].map(machine => machine.id));
    for (const id of this.previous.keys()) if (!active.has(id)) this.previous.delete(id);
    const accumulate = (id: string, itemId: string, current: Totals): void => {
      let seen = this.previous.get(id); if (!seen) { seen = new Map(); this.previous.set(id, seen); }
      const before = seen.get(itemId) ?? zero(); seen.set(itemId, current);
      const produced = Math.max(0, current.produced - before.produced), consumed = Math.max(0, current.consumed - before.consumed), extracted = Math.max(0, current.extracted - before.extracted);
      if (!(produced || consumed || extracted)) return;
      let bucket = this.buckets.get(second); if (!bucket) { bucket = new Map(); this.buckets.set(second, bucket); }
      const total = bucket.get(itemId) ?? zero();
      total.produced += produced; total.consumed += consumed; total.extracted += extracted; bucket.set(itemId, total);
    };
    for (const miner of miners) accumulate(miner.id, miner.itemId, { produced: miner.produced, consumed: 0, extracted: miner.produced });
    const definitions = this.items.all();
    for (const machine of processors) for (const item of definitions)
      accumulate(machine.id, item.id, { produced: machine.produced(item.id), consumed: machine.consumed(item.id), extracted: 0 });
  }
  /** Counts use bucket boundaries; rates scale by elapsed time until 60s. */
  snapshot(): readonly ProductionRow[] {
    const current = Math.floor(this.timeMs / 1000), duration = Math.min(this.timeMs, 60000);
    const result = new Map<string, Totals>();
    for (const [second, bucket] of this.buckets) if (second > current - 60 && second <= current)
      for (const [id, entry] of bucket) {
        const total = result.get(id) ?? zero(); total.produced += entry.produced; total.consumed += entry.consumed; total.extracted += entry.extracted; result.set(id, total);
      }
    return [...result.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([itemId, counts]) => ({ itemId, ...counts,
      producedPerMinute: duration ? counts.produced * 60000 / duration : 0,
      consumedPerMinute: duration ? counts.consumed * 60000 / duration : 0,
      extractedPerMinute: duration ? counts.extracted * 60000 / duration : 0 }));
  }
}
