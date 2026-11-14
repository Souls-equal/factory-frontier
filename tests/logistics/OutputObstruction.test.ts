import { expect, it } from 'vitest';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { snapFootprint } from '../../src/buildings/Transform';
import type { BuildingInstance } from '../../src/buildings/BuildingSystem';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { blocksCellOutput } from '../../src/logistics/ConveyorDefinitions';

const registry = createDefaultBuildingRegistry(createDefaultItemRegistry());
function building(id: string, typeId: string, x: number, z: number, y: number, rotation = 0): BuildingInstance {
  return { id, typeId, transform: { ...snapFootprint(registry.get(typeId), x, z, rotation, 1), y } };
}
it('compares the actual output height with the full height of the building ahead', () => {
  const lower = building('lower', 'conveyor-cell', -.5, -1.5, 0);
  const higher = building('higher', 'conveyor-cell', -.5, -1.5, 3);
  const ground = building('ground', 'storage-container', 0, -3, 0, 1);
  const upper = building('upper', 'storage-container', 0, -3, 3, 1);
  expect(blocksCellOutput(lower, ground, 1, registry)).toBe(true);
  expect(blocksCellOutput(lower, upper, 1, registry)).toBe(false);
  expect(blocksCellOutput(higher, ground, 1, registry)).toBe(false);
  expect(blocksCellOutput(higher, upper, 1, registry)).toBe(true);
  expect(blocksCellOutput(lower, building('foundation', 'foundation', 0, -3, 0), 1, registry)).toBe(false);
  expect(blocksCellOutput(lower, building('other', 'storage-container', 6, -3, 0), 1, registry)).toBe(false);
  // Inclines have an output above the nominal base and must be compared at that end.
  const ramp: BuildingInstance = { ...lower, cellConveyor: { rise: 1, offset: 0, entries: [] } };
  expect(blocksCellOutput(ramp, ground, 1, registry)).toBe(true); // 1.5m is inside the 1.8m storage body
  expect(blocksCellOutput(ramp, building('low', 'receiving-terminal', 0, -3, 0), 1, registry)).toBe(false);
});
