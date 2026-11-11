import { describe, expect, it } from 'vitest';
import { BuildingRegistry, createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { snapFootprint } from '../../src/buildings/Transform';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

const items = createDefaultItemRegistry();
const definition = createDefaultBuildingRegistry(items).get('foundation');
describe('building definitions and grid transforms', () => {
  it('defines a structural foundation with real, registered material requirements', () => {
    expect(definition.cost).toEqual([{ itemId: 'stone', quantity: 10 }, { itemId: 'wood', quantity: 5 }]);
    expect(definition.widthCells).toBe(2); expect(definition.depthCells).toBe(2);
    expect(definition.height).toBeGreaterThan(0);
    for (const cost of definition.cost) expect(items.get(cost.itemId).id).toBe(cost.itemId);
  });
  it('rejects duplicate ids, bad dimensions, unknown items and duplicate costs', () => {
    const registry = new BuildingRegistry(items); registry.register(definition);
    expect(() => registry.register(definition)).toThrow(/Duplicate/);
    expect(() => registry.register({ ...definition, id: 'bad', widthCells: 0 })).toThrow();
    expect(() => registry.register({ ...definition, id: 'bad', cost: [{ itemId: 'missing', quantity: 1 }] })).toThrow();
    expect(() => registry.register({ ...definition, id: 'bad', cost: [definition.cost[0]!, definition.cost[0]!] })).toThrow();
    expect(registry.all()).toHaveLength(1);
  });
  it('snaps footprint edges to grid after rotation, including asymmetric definitions', () => {
    const rectangular = { ...definition, widthCells: 1, depthCells: 2 };
    const first = snapFootprint(rectangular, 3.2, -1.7, 0, 2);
    const rotated = snapFootprint(rectangular, 3.2, -1.7, 1, 2);
    expect(first.footprint.maxX - first.footprint.minX).toBe(2);
    expect(first.footprint.maxZ - first.footprint.minZ).toBe(4);
    expect(rotated.footprint.maxX - rotated.footprint.minX).toBe(4);
    expect(rotated.footprint.maxZ - rotated.footprint.minZ).toBe(2);
    expect(rotated.footprint.minX % 2).toBe(0);
    expect(snapFootprint(rectangular, 3.2, -1.7, -3, 2)).toEqual(rotated);
    expect(() => snapFootprint(rectangular, NaN, 0, 0, 2)).toThrow();
  });
});
