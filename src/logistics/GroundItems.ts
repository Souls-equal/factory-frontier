import type { Inventory } from '../items/Inventory';
import type { Point3 } from './ConveyorPath';

export interface GroundItem {
  readonly id: string;
  readonly itemId: string;
  readonly position: Point3;
  readonly previousPosition: Point3;
  readonly velocityY: number;
}

/** Dropped resources remain owned by the simulation until picked up. */
export class GroundItems {
  private readonly items = new Map<string, GroundItem>();
  constructor(private readonly groundBelow: (x: number, z: number, y: number) => number) {}
  all(): readonly GroundItem[] { return [...this.items.values()]; }
  get(id: string): GroundItem | undefined { return this.items.get(id); }
  drop(id: string, itemId: string, position: Point3): void {
    if (!id || !itemId || this.items.has(id) || ![position.x, position.y, position.z].every(Number.isFinite)) throw new RangeError('Invalid dropped item');
    this.items.set(id, { id, itemId, position: { ...position }, previousPosition: { ...position }, velocityY: 0 });
  }
  fixedUpdate(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Invalid ground item tick');
    const dt = deltaMs / 1000;
    for (const item of this.items.values()) {
      const floor = this.groundBelow(item.position.x, item.position.z, item.position.y - .15) + .15;
      const velocityY = item.velocityY - 9.81 * dt;
      const y = Math.max(floor, item.position.y + item.velocityY * dt - 4.905 * dt * dt);
      this.items.set(item.id, { ...item, previousPosition: item.position, position: { ...item.position, y }, velocityY: y <= floor ? 0 : velocityY });
    }
  }
  pickup(id: string, inventory: Inventory): boolean {
    const item = this.items.get(id);
    if (!item || inventory.addItem(item.itemId, 1).moved !== 1) return false;
    this.items.delete(id); return true;
  }
}
