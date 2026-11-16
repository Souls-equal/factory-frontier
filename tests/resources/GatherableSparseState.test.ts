import { describe, expect, it } from 'vitest';
import { GatherableField, type GatherableDefinition } from '../../src/resources/Gatherables';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

const tree: GatherableDefinition = { id: 'tree', kind: 'tree', itemId: 'wood', x: 0, y: 0, z: 0, radius: .45, quantity: 20 };
const branch: GatherableDefinition = { id: 'branch', kind: 'branch', itemId: 'wood', x: 3, y: 0, z: 0, radius: .25, quantity: 5 };

describe('sparse gatherable state', () => {
  it('derives untouched quantities without allocating mutable overrides', () => {
    const field = new GatherableField([tree, branch]);
    const inventory = new Inventory(createDefaultItemRegistry(), 1); inventory.addItem('coal', 100);
    expect(field.modifiedCount).toBe(0);
    expect(field.remaining(tree.id)).toBe(20); expect(field.remaining(branch.id)).toBe(5);
    expect(field.remaining('unknown')).toBe(0);
    expect(field.placementObstacles()).toHaveLength(2); expect(field.treeObstacles()).toHaveLength(1);
    const target = field.interactables(inventory, 4, [branch])[0]!;
    expect(target.interact().ok).toBe(false); // full inventory does not modify branch
    expect(field.modifiedCount).toBe(0); expect(field.revision).toBe(0);
    expect(() => field.interactables(inventory, 4, [{ ...branch, id: 'unknown' }])).toThrow(RangeError);
    expect(() => new GatherableField([tree, tree])).toThrow(/Duplicate/);
  });

  it('retains partial chops, exhausted tree and partial transfers between adapters', () => {
    const field = new GatherableField([tree, branch]), inventory = new Inventory(createDefaultItemRegistry(), 1);
    inventory.addItem('coal', 100);
    const adapter = () => field.interactables(inventory, 4, [tree])[0]!;
    expect(adapter().interact().message).toContain('2 more'); expect(field.modifiedCount).toBe(1);
    expect(adapter().interact().message).toContain('1 more');
    expect(adapter().interact().ok).toBe(false); // final chop completes even though there is no room
    inventory.removeItem('coal', 100); inventory.addItem('wood', 95);
    expect(adapter().interact().message).toContain('Collected 5');
    expect(field.remaining(tree.id)).toBe(15); expect(field.active(tree.id)).toBe(true);
    expect(field.revision).toBe(0);
    inventory.removeItem('wood', 100);
    expect(adapter().interact().message).toContain('Collected 15');
    expect(field.remaining(tree.id)).toBe(0); expect(field.revision).toBe(1);
    expect(field.modifiedCount).toBe(1); expect(field.remaining(branch.id)).toBe(5);
    expect(adapter().interact().ok).toBe(false);
  });
});
