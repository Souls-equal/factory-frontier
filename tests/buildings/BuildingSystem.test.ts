import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
import type { ObstacleDefinition } from '../../src/world/ObstacleField';

const terrain: TerrainQuery = {
  bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, size: 40, resolution: 20, cellSize: 2,
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }),
  contains: (x, z) => Math.abs(x) <= 20 && Math.abs(z) <= 20, clampXZ: (x, z) => ({ x, z }),
};
const player = { x: -8, z: -8, radius: 0.4 };
function setup(options: { terrain?: TerrainQuery; obstacles?: ObstacleDefinition[]; slots?: number } = {}) {
  const items = createDefaultItemRegistry(); const inventory = new Inventory(items, options.slots ?? 4);
  const system = new BuildingSystem(createDefaultBuildingRegistry(items), inventory,
    options.terrain ?? terrain, options.obstacles ?? [], 1, 19);
  return { inventory, system };
}
function stock(inventory: Inventory) { inventory.addItem('stone', 20); inventory.addItem('wood', 10); }

describe('building placement and refund model', () => {
  it('registers a snapped stable id and charges the exact costs once', () => {
    const { inventory, system } = setup(); stock(inventory);
    const preview = system.validate('foundation', 0.2, 0.2, 0, player);
    const placed = system.place('foundation', 0.2, 0.2, 0, player);
    expect(placed.transform).toEqual(preview.transform); expect(placed.building?.id).toBe('building-1');
    expect(system.all()).toEqual([placed.building]);
    expect(inventory.getItemCount('stone')).toBe(10); expect(inventory.getItemCount('wood')).toBe(5);
    expect(system.place('foundation', 0.2, 0.2, 0, player).reason).toBe('occupied space');
    expect(inventory.getItemCount('stone')).toBe(10);
    expect(system.place('foundation', 4, 0, 1, player).building?.id).toBe('building-2');
  });
  it('rejects out-of-bounds, steep, occupied, player and unaffordable placements without costs', () => {
    const { inventory, system } = setup(); stock(inventory); const before = inventory.snapshot();
    expect(system.validate('foundation', 19, 0, 0, player).reason).toBe('outside bounds');
    expect(system.validate('foundation', -8, -8, 0, player).reason).toBe('player overlap');
    const obstacle = { id: 'deposit', kind: 'prop' as const, x: 0, y: 0, z: 0, radius: 0.5, height: 1, yaw: 0, variant: 0 };
    const blocked = setup({ obstacles: [obstacle] }); stock(blocked.inventory);
    expect(blocked.system.place('foundation', 0, 0, 0, player).reason).toBe('occupied space');
    const steep = setup({ terrain: { ...terrain, slopeAt: () => 0.5 } }); stock(steep.inventory);
    expect(steep.system.place('foundation', 0, 0, 0, player).reason).toBe('terrain too steep');
    expect(steep.inventory.getItemCount('stone')).toBe(20);
    expect(inventory.snapshot()).toEqual(before); expect(system.all()).toEqual([]);
    const empty = setup(); expect(empty.system.place('foundation', 0, 0, 0, player).reason).toBe('insufficient materials');
    expect(empty.system.all()).toEqual([]);
  });
  it('demolishes with full refund or fails without mutating building or inventory', () => {
    const { inventory, system } = setup({ slots: 2 }); stock(inventory);
    const building = system.place('foundation', 0, 0, 0, player).building!;
    inventory.addItem('coal', 100); // no space for wood after the remaining wood is removed
    inventory.removeItem('wood', 5); inventory.addItem('coal', 100);
    const before = inventory.snapshot();
    expect(system.demolish(building.id)).toBe('inventory full');
    expect(inventory.snapshot()).toEqual(before); expect(system.get(building.id)).toEqual(building);
    inventory.removeItem('coal', 100);
    expect(system.demolish(building.id)).toBe('removed'); expect(system.get(building.id)).toBeUndefined();
    expect(inventory.getItemCount('stone')).toBe(20); expect(inventory.getItemCount('wood')).toBe(5);
    expect(system.demolish(building.id)).toBe('unknown building');
  });
  it('rejects invalid terrain data and rechecks materials at confirmation', () => {
    const invalid = setup({ terrain: { ...terrain, heightAt: () => NaN } }); stock(invalid.inventory);
    const before = invalid.inventory.snapshot();
    expect(invalid.system.place('foundation', 0, 0, 0, player).reason).toBe('invalid terrain support');
    expect(invalid.inventory.snapshot()).toEqual(before);
    const { inventory, system } = setup(); stock(inventory);
    expect(system.validate('foundation', 0, 0, 0, player).reason).toBe('valid');
    inventory.removeItem('wood', 10);
    expect(system.place('foundation', 0, 0, 0, player).reason).toBe('insufficient materials');
    expect(inventory.getItemCount('stone')).toBe(20);
    expect(system.all()).toEqual([]);
    expect(() => system.validate('foundation', 0, 0, 0, { ...player, radius: NaN })).toThrow();
  });
  it('never reuses ids after a building is demolished', () => {
    const { inventory, system } = setup(); stock(inventory);
    const first = system.place('foundation', 0, 0, 0, player).building!;
    expect(system.demolish(first.id)).toBe('removed');
    const next = system.place('foundation', 0, 0, 0, player).building!;
    expect(next.id).not.toBe(first.id); expect(system.get(first.id)).toBeUndefined();
    expect(system.get(next.id)).toEqual(next);
  });
  it('preflights multiple refund types sharing a single empty slot', () => {
    const { inventory } = setup({ slots: 1 });
    expect(inventory.exchange([], [{ itemId: 'stone', quantity: 1 }, { itemId: 'wood', quantity: 1 }])).toBe(false);
    expect(inventory.snapshot()).toEqual([null]);
  });
});

describe('adjustable and aligned foundations', () => {
  it('allows three quarters burial, rejects more without charging and checks the highest terrain', () => {
    const { inventory, system } = setup(); stock(inventory);
    const before = inventory.snapshot();
    const preview = system.validate('foundation', 0, 0, 0, player, -.3);
    expect(preview.reason).toBe('valid'); expect(preview.transform.y).toBeCloseTo(-.3);
    expect(system.place('foundation', 0, 0, 0, player, -.4).reason).toBe('unsupported height');
    expect(inventory.snapshot()).toEqual(before);
    expect(system.place('foundation', 0, 0, 0, player, -.3).transform).toEqual(preview.transform);
    expect(() => system.validate('foundation', 4, 0, 0, player, NaN)).toThrow();
    const uneven = setup({ terrain: { ...terrain, heightAt: (x) => x > 0 ? .1 : 0 } }); stock(uneven.inventory);
    expect(uneven.system.validate('foundation', 0, 0, 0, player, -.2).reason).toBe('valid');
    expect(uneven.system.validate('foundation', 0, 0, 0, player, -.3).reason).toBe('unsupported height');
  });
  it('snaps partial side contact and copies a floating neighbour level while rejecting overlaps', () => {
    const { inventory, system } = setup(); inventory.addItem('stone', 50); inventory.addItem('wood', 25);
    const first = system.place('foundation', 0, 0, 0, player, 1.2);
    expect(first.reason).toBe('valid');
    const preview = system.validate('foundation', 2, 1, 0, player, 0);
    expect(preview.reason).toBe('valid'); expect(preview.snappedToFoundation).toBe(true);
    expect(preview.transform.x).toBe(2); expect(preview.transform.z).toBe(0); expect(preview.transform.y).toBeCloseTo(1.2);
    expect(system.place('foundation', 2, 1, 0, player, 0).transform).toEqual(preview.transform);
    expect(system.validate('foundation', 0, 0, 0, player, 0).reason).toBe('occupied space');
    const next = system.validate('foundation', 4, 0, 0, player, -.2);
    expect(next.transform.y).toBeCloseTo(1); expect(next.reason).toBe('valid');
  });
  it('preserves support and demolition guards for logistics on elevated foundations', () => {
    const { inventory, system } = setup(); inventory.addItem('stone', 30); inventory.addItem('wood', 15);
    const foundation = system.place('foundation', 0, 0, 0, player, 1).building!;
    const terminal = system.place('receiving-terminal', 0, 0, 0, player);
    expect(terminal.reason).toBe('valid'); expect(terminal.transform.y).toBeCloseTo(1.4);
    expect(system.demolish(foundation.id)).toBe('building supports another');
    expect(system.demolish(terminal.building!.id)).toBe('removed');
    expect(system.demolish(foundation.id)).toBe('removed');
  });
});
