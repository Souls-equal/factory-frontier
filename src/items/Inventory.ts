import type { ItemRegistry } from './ItemRegistry';

export interface ItemStack { readonly itemId: string; readonly quantity: number }
export interface QuantityResult { readonly requested: number; readonly moved: number; readonly remainder: number }

function quantity(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError('Quantity must be a positive safe integer.');
}

/** Slot inventory; partial add/remove/transfer return exactly what was moved. */
export class Inventory {
  private readonly slots: Array<ItemStack | null>;
  private revisionValue = 0;
  constructor(readonly registry: ItemRegistry, readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new RangeError('Inventory capacity must be a positive integer.');
    this.slots = Array.from({ length: capacity }, () => null);
  }
  get revision(): number { return this.revisionValue; }
  get usedSlots(): number { return this.slots.filter(Boolean).length; }
  snapshot(): readonly (ItemStack | null)[] { return this.slots.map((slot) => slot ? { ...slot } : null); }
  getItemCount(id: string): number {
    this.registry.get(id);
    return this.slots.reduce<number>((total, slot) => total + (slot?.itemId === id ? slot.quantity : 0), 0);
  }
  hasItem(id: string, amount: number): boolean { quantity(amount); return this.getItemCount(id) >= amount; }
  getAvailableSpace(id: string): number {
    const max = this.registry.get(id).maxStackSize;
    return this.slots.reduce<number>((sum, slot) => sum + (slot === null ? max : slot.itemId === id ? max - slot.quantity : 0), 0);
  }
  canAddItem(id: string, amount: number): boolean { quantity(amount); return this.getAvailableSpace(id) >= amount; }
  addItem(id: string, amount: number): QuantityResult {
    quantity(amount);
    const max = this.registry.get(id).maxStackSize;
    let remaining = amount;
    for (let i = 0; i < this.capacity && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot?.itemId === id && slot.quantity < max) {
        const moved = Math.min(max - slot.quantity, remaining);
        this.slots[i] = { itemId: id, quantity: slot.quantity + moved }; remaining -= moved;
      }
    }
    for (let i = 0; i < this.capacity && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const moved = Math.min(max, remaining);
        this.slots[i] = { itemId: id, quantity: moved }; remaining -= moved;
      }
    }
    if (remaining !== amount) this.revisionValue++;
    return { requested: amount, moved: amount - remaining, remainder: remaining };
  }
  removeItem(id: string, amount: number): QuantityResult {
    quantity(amount); this.registry.get(id);
    let remaining = amount;
    for (let i = 0; i < this.capacity && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot?.itemId === id) {
        const moved = Math.min(slot.quantity, remaining);
        this.slots[i] = moved === slot.quantity ? null : { itemId: id, quantity: slot.quantity - moved };
        remaining -= moved;
      }
    }
    if (remaining !== amount) this.revisionValue++;
    return { requested: amount, moved: amount - remaining, remainder: remaining };
  }
  /** Transfers only as much as both source and destination can support. */
  transferItem(destination: Inventory, id: string, amount: number): QuantityResult {
    quantity(amount); this.registry.get(id); destination.registry.get(id);
    if (destination === this) return { requested: amount, moved: 0, remainder: amount };
    const moved = Math.min(amount, this.getItemCount(id), destination.getAvailableSpace(id));
    if (moved > 0) { this.removeItem(id, moved); destination.addItem(id, moved); }
    return { requested: amount, moved, remainder: amount - moved };
  }
  /** Apply a multi-item exchange all-or-nothing, including shared empty-slot capacity. */
  exchange(remove: readonly ItemStack[], add: readonly ItemStack[]): boolean {
    const next = this.snapshot().map((slot) => slot ? { ...slot } : null);
    for (const entry of [...remove, ...add]) { quantity(entry.quantity); this.registry.get(entry.itemId); }
    for (const entry of remove) {
      let remaining = entry.quantity;
      for (let i = 0; i < next.length && remaining > 0; i++) {
        const slot = next[i];
        if (slot?.itemId !== entry.itemId) continue;
        const moved = Math.min(slot.quantity, remaining);
        next[i] = moved === slot.quantity ? null : { ...slot, quantity: slot.quantity - moved };
        remaining -= moved;
      }
      if (remaining) return false;
    }
    for (const entry of add) {
      let remaining = entry.quantity;
      const max = this.registry.get(entry.itemId).maxStackSize;
      for (let i = 0; i < next.length && remaining > 0; i++) {
        const slot = next[i];
        if (slot?.itemId !== entry.itemId) continue;
        const moved = Math.min(max - slot.quantity, remaining);
        next[i] = { ...slot, quantity: slot.quantity + moved }; remaining -= moved;
      }
      for (let i = 0; i < next.length && remaining > 0; i++) {
        if (next[i] !== null) continue;
        const moved = Math.min(max, remaining);
        next[i] = { itemId: entry.itemId, quantity: moved }; remaining -= moved;
      }
      if (remaining) return false;
    }
    if (remove.length || add.length) {
      for (let i = 0; i < next.length; i++) this.slots[i] = next[i] ?? null;
      this.revisionValue++;
    }
    return true;
  }
  private validSlot(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.capacity) throw new RangeError('Invalid slot index.');
  }
  /** Move into an empty slot or merge into a compatible stack; never swap. */
  moveStack(source: number, destination: number, amount?: number): number {
    this.validSlot(source); this.validSlot(destination);
    if (amount !== undefined) quantity(amount);
    if (source === destination) return 0;
    const from = this.slots[source]; const to = this.slots[destination];
    if (!from || (to && to.itemId !== from.itemId)) return 0;
    const requested = amount ?? from.quantity; quantity(requested);
    if (requested > from.quantity) throw new RangeError('Not enough items in source stack.');
    const moved = Math.min(requested, this.registry.get(from.itemId).maxStackSize - (to?.quantity ?? 0));
    if (!moved) return 0;
    this.slots[destination] = { itemId: from.itemId, quantity: (to?.quantity ?? 0) + moved };
    this.slots[source] = moved === from.quantity ? null : { itemId: from.itemId, quantity: from.quantity - moved };
    this.revisionValue++; return moved;
  }
  /** Atomically exchange two occupied slots without changing their quantities. */
  swapSlots(first: number, second: number): boolean {
    this.validSlot(first); this.validSlot(second);
    if (first === second) return false;
    const left = this.slots[first], right = this.slots[second];
    if (!left || !right) return false;
    this.slots[first] = right; this.slots[second] = left;
    this.revisionValue++;
    return true;
  }
  splitStack(source: number, amount: number): number {
    this.validSlot(source); quantity(amount);
    const slot = this.slots[source];
    if (!slot || amount >= slot.quantity) throw new RangeError('A split must leave items in the source slot.');
    const empty = this.slots.indexOf(null);
    return empty < 0 ? 0 : this.moveStack(source, empty, amount);
  }
  mergeStacks(source: number, destination: number): number { return this.moveStack(source, destination); }
}
