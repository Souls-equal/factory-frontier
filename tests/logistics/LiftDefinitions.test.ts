import { describe, expect, it } from 'vitest';
import { isLiftBuilding, liftRise, MAX_LIFT_HEIGHT } from '../../src/logistics/LiftDefinitions';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { pathForBuilding } from '../../src/logistics/ConveyorDefinitions';
import { snapFootprint } from '../../src/buildings/Transform';

describe('lift definitions', () => {
  it.each(['up', 'down'])('registers every %s height with matching geometry and path', (direction) => {
    const registry = createDefaultBuildingRegistry(createDefaultItemRegistry());
    for (let h = 1; h <= MAX_LIFT_HEIGHT; h++) {
      const id = `lift-${direction}-${h}`, def = registry.get(id), transform = snapFootprint(def, 0, 0, 0, 1);
      const path = pathForBuilding({ id, typeId: id, transform }, 1)!;
      expect(liftRise(id)).toBe(direction === 'up' ? h : -h);
      expect(def.height).toBeCloseTo(h + .9);
      expect(path.point(path.length).y - path.point(0).y).toBe(direction === 'up' ? h : -h);
      expect(path.length).toBe(2 + h);
    }
  });
  it.each(['constructor', 'lift-up-0', 'lift-up-9', 'lift-down-01', 'lift-down-1.5', 'lift-up-1x', 'toString', 'lift-up-999999999999999999'])('does not recognize invalid lift id %s', (id) => {
    expect(liftRise(id)).toBeNull(); expect(isLiftBuilding(id)).toBe(false);
  });
});
