import type { Inventory, QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { ItemReceiver, ItemSource, PortPose } from './Ports';

/** One bounded item per input; the output drains occupied inputs round-robin. */
export class Merger {
  private readonly slots: (string | null)[] = [null, null, null];
  private cursor = 0;
  constructor(readonly id: string, private readonly items: ItemRegistry) {}
  get pending(): readonly (string | null)[] { return [...this.slots]; }
  get occupied(): boolean { return this.slots.some(Boolean); }
  receiver(index: number, pose: PortPose): ItemReceiver {
    const canAccept = (itemId: string) => {
      if (this.slots[index] !== null) return false;
      try { this.items.get(itemId); return true; } catch { return false; }
    };
    return { id: `${this.id}:input:${index}`, pose, canAccept,
      accept: (itemId) => { if (!canAccept(itemId)) return false; this.slots[index] = itemId; return true; } };
  }
  private next(): number {
    for (let i = 0; i < 3; i++) { const index = (this.cursor + i) % 3; if (this.slots[index]) return index; }
    return -1;
  }
  source(pose: PortPose): ItemSource {
    return { id: this.id, pose, peek: () => this.slots[this.next()] ?? null,
      take: (itemId) => { const index = this.next(); if (index < 0 || this.slots[index] !== itemId) return false;
        this.slots[index] = null; this.cursor = (index + 1) % 3; return true; } };
  }
  retrieve(destination: Inventory): QuantityResult {
    let requested = 0, moved = 0;
    for (let i = 0; i < 3; i++) {
      const item = this.slots[i]; if (!item) continue;
      requested++; if (destination.addItem(item, 1).moved) { moved++; this.slots[i] = null; }
    }
    return { requested, moved, remainder: requested - moved };
  }
}
