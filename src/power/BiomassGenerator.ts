import { Inventory, type QuantityResult } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';

/** One wood burns for 30 seconds; unused burn time is retained when idle. */
export const BIOMASS = Object.freeze({ fuel: 'wood', burnMs: 30_000, capacityWatts: 30_000 });
export class BiomassGenerator {
  readonly fuel: Inventory;
  private remaining = 0;
  private enabledValue = true;
  constructor(readonly id: string, items: ItemRegistry) {
    if (!id.trim()) throw new RangeError('Invalid generator id.');
    items.get(BIOMASS.fuel); this.fuel = new Inventory(items, 1);
  }
  get enabled(): boolean { return this.enabledValue; }
  setEnabled(value: boolean): void { this.enabledValue = value; }
  get remainingMs(): number { return this.remaining; }
  get fuelTimeMs(): number { return this.remaining + this.fuel.getItemCount(BIOMASS.fuel) * BIOMASS.burnMs; }
  get ready(): boolean { return this.enabled && this.fuelTimeMs > 0; }
  /** Burn only when dispatched; returns exact milliseconds of generated energy. */
  burn(deltaMs: number): number {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid burn duration.');
    if (!this.enabled || deltaMs === 0) return 0;
    let remaining = deltaMs, delivered = 0;
    while (remaining > 0) {
      if (this.remaining <= 0) {
        if (!this.fuel.getItemCount(BIOMASS.fuel)) break;
        this.fuel.removeItem(BIOMASS.fuel, 1); this.remaining = BIOMASS.burnMs;
      }
      const elapsed = Math.min(remaining, this.remaining);
      this.remaining -= elapsed; remaining -= elapsed; delivered += elapsed;
    }
    return delivered;
  }
  feed(source: Inventory): QuantityResult {
    const amount = source.getItemCount(BIOMASS.fuel);
    return amount ? source.transferItem(this.fuel, BIOMASS.fuel, amount) : { requested: 0, moved: 0, remainder: 0 };
  }
  retrieveFuel(destination: Inventory): QuantityResult {
    const amount = this.fuel.getItemCount(BIOMASS.fuel);
    return amount ? this.fuel.transferItem(destination, BIOMASS.fuel, amount) : { requested: 0, moved: 0, remainder: 0 };
  }
}
