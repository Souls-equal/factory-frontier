import type { Inventory } from '../items/Inventory';
import type { Point3 } from './ConveyorPath';

export interface PortPose { readonly position: Point3; readonly direction: Point3 }
export function validPortPose(pose: PortPose): boolean {
  const { position: p, direction: d } = pose;
  return [p.x, p.y, p.z, d.x, d.y, d.z].every(Number.isFinite) && d.y === 0 && Math.abs(d.x) + Math.abs(d.z) === 1 && Number.isInteger(d.x) && Number.isInteger(d.z);
}
export function matchesPort(pose: PortPose, position: Point3, direction: Point3): boolean {
  return validPortPose(pose) && Math.hypot(pose.position.x - position.x, pose.position.y - position.y, pose.position.z - position.z) <= 1e-7 &&
    pose.direction.x === direction.x && pose.direction.z === direction.z;
}

/** All port methods are synchronous; take/accept succeed only when one item moves. */
export interface ItemSource {
  readonly id: string;
  readonly pose: PortPose;
  peek(): string | null;
  take(itemId: string): boolean;
}
export interface ItemReceiver {
  readonly id: string;
  readonly pose: PortPose;
  canAccept(itemId: string): boolean;
  accept(itemId: string): boolean;
}

export class InventorySource implements ItemSource {
  constructor(readonly id: string, readonly pose: PortPose, private readonly inventory: Inventory, private readonly itemId: string) {
    inventory.registry.get(itemId);
    if (!id.trim() || !validPortPose(pose)) throw new RangeError('Invalid source port.');
  }
  peek(): string | null { return this.inventory.getItemCount(this.itemId) ? this.itemId : null; }
  take(itemId: string): boolean {
    return itemId === this.itemId && this.inventory.removeItem(itemId, 1).moved === 1;
  }
}
export class InventoryReceiver implements ItemReceiver {
  constructor(readonly id: string, readonly pose: PortPose, readonly inventory: Inventory) { if (!id.trim() || !validPortPose(pose)) throw new RangeError('Invalid receiver port.'); }
  canAccept(itemId: string): boolean {
    try { return this.inventory.getAvailableSpace(itemId) > 0; } catch { return false; }
  }
  accept(itemId: string): boolean { return this.canAccept(itemId) && this.inventory.addItem(itemId, 1).moved === 1; }
}
