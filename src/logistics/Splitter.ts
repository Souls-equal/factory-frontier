import type { Inventory, QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { ItemReceiver, ItemSource, PortPose, SourceArbiter } from './Ports';

/** One-item buffer and a persistent round-robin cursor; never consumes an item
 * until an output belt has reserved space for it. */
export type SplitterMode = 'balanced' | 'overflow' | 'priority' | 'filtered';
export class Splitter implements SourceArbiter {
  private item: string | null = null;
  private cursor = 0;
  private modeValue: SplitterMode = 'balanced';
  private priorityValue = 0;
  private readonly filterValues: [string | null, string | null, string | null] = [null, null, null];
  get mode(): SplitterMode { return this.modeValue; }
  get priority(): number { return this.priorityValue; }
  /** Null means an unmatched-item output, not an overflow for configured items. */
  get filters(): readonly (string | null)[] { return [...this.filterValues]; }
  setOutputFilter(index: number, itemId: string | null): void {
    if (!Number.isInteger(index) || index < 0 || index > 2) throw new RangeError('Invalid splitter output');
    if (itemId !== null) this.items.get(itemId);
    this.filterValues[index] = itemId;
  }
  private eligible(index: number, itemId: string): boolean {
    const configured = this.filterValues.includes(itemId);
    return configured ? this.filterValues[index] === itemId : this.filterValues[index] === null;
  }
  configure(mode: SplitterMode, priority: number): void {
    if (!['balanced', 'overflow', 'priority', 'filtered'].includes(mode) || !Number.isInteger(priority) || priority < 0 || priority > 2) throw new RangeError('Invalid splitter configuration');
    this.modeValue = mode; this.priorityValue = priority;
  }
  constructor(readonly id: string, private readonly items: ItemRegistry) {}
  get pending(): string | null { return this.item; }
  outputId(index: number): string { return `${this.id}:output:${index}`; }
  choose(ready: readonly string[]): string | null {
    if (this.modeValue === 'filtered') {
      if (!this.item) return null;
      for (let offset = 0; offset < 3; offset++) {
        const index = (this.cursor + offset) % 3, id = this.outputId(index);
        if (this.eligible(index, this.item) && ready.includes(id)) return id;
      }
      return null;
    }
    const priority = this.outputId(this.priorityValue);
    if (this.modeValue !== 'balanced' && ready.includes(priority)) return priority;
    if (this.modeValue === 'priority') return null;
    for (let offset = 0; offset < 3; offset++) {
      const id = this.outputId((this.cursor + offset) % 3);
      if (ready.includes(id)) return id;
    }
    return null;
  }
  receiver(pose: PortPose): ItemReceiver {
    const canAccept = (itemId: string): boolean => {
      if (this.item !== null) return false;
      try { this.items.get(itemId); return true; } catch { return false; }
    };
    return { id: this.id, pose, canAccept,
      accept: (itemId) => { if (!canAccept(itemId)) return false; this.item = itemId; return true; } };
  }
  source(index: number, pose: PortPose): ItemSource {
    return { id: this.outputId(index), pose, arbiter: this,
      peek: () => this.item,
      take: (itemId) => {
        if (this.item !== itemId || (this.modeValue === 'filtered' && !this.eligible(index, itemId))) return false;
        this.item = null; this.cursor = (index + 1) % 3; return true;
      } };
  }
  retrieve(destination: Inventory): QuantityResult {
    if (!this.item) return { requested: 0, moved: 0, remainder: 0 };
    const result = destination.addItem(this.item, 1);
    if (result.moved) this.item = null;
    return result;
  }
}
