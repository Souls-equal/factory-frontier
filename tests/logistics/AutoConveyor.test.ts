import { describe, expect, it } from 'vitest';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { snapFootprint } from '../../src/buildings/Transform';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { resolveAutoConveyors } from '../../src/logistics/AutoConveyor';
import { pathForBuilding } from '../../src/logistics/ConveyorDefinitions';
import type { BuildingInstance } from '../../src/buildings/BuildingSystem';

const registry = createDefaultBuildingRegistry(createDefaultItemRegistry());
const make = (id: string, typeId: string, x: number, z: number, rotation = 0, y = 0): BuildingInstance => ({
  id, typeId, transform: { ...snapFootprint(registry.get(typeId === 'conveyor-auto' ? 'conveyor-straight' : typeId), x, z, rotation, 1), y },
});

describe('automatic conveyor topology', () => {
  it.each([0, 1, 2, 3])('forms left and right turns at rotation %s', (rotation) => {
    const d = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }][rotation]!;
    const miner = make('m', 'miner-mk1', 0, 0, rotation), a = make('a', 'conveyor-auto', d.x * 2, d.z * 2);
    for (const side of [-1, 1]) {
      const right = { x: -d.z * side, z: d.x * side };
      const b = make('b', 'conveyor-auto', a.transform.x + right.x * 2, a.transform.z + right.z * 2);
      const plan = resolveAutoConveyors([miner, a, b], 1)!;
      expect(plan.get('a')?.shape).toBe(side === 1 ? 'curve-right' : 'curve-left');
      const pathA = pathForBuilding({ ...a, autoConveyor: plan.get('a') }, 1)!;
      const pathB = pathForBuilding({ ...b, autoConveyor: plan.get('b') }, 1)!;
      expect(pathA.compatible(pathB)).toBe(true);
    }
  });
  it('rejects a branch and cycle instead of losing connections', () => {
    const a = make('a', 'conveyor-auto', 0, 0), b = make('b', 'conveyor-auto', 0, -2), c = make('c', 'conveyor-auto', 2, 0), d = make('d', 'conveyor-auto', -2, 0);
    expect(resolveAutoConveyors([a, b, c, d], 1)).toBeNull();
    expect(resolveAutoConveyors([a, b, c, make('e', 'conveyor-auto', 2, -2)], 1)).toBeNull();
  });
  it('infers a rising path to a higher adjacent tile', () => {
    const miner = make('m', 'miner-mk1', 0, 0), a = make('a', 'conveyor-auto', 0, -2), b = make('b', 'conveyor-auto', 0, -4, 0, 1);
    const plan = resolveAutoConveyors([miner, a, b], 1)!;
    expect(plan.get('a')).toEqual({ shape: 'incline', rotation: 0, rise: 1, offset: 0 });
    expect(pathForBuilding({ ...a, autoConveyor: plan.get('a') }, 1)!.compatible(pathForBuilding({ ...b, autoConveyor: plan.get('b') }, 1)!)).toBe(true);
  });
});

it('joins descending and curved slopes at the exact same height', () => {
  const miner = make('m', 'miner-mk1', 0, 0, 0, 1);
  const a = make('a', 'conveyor-auto', 0, -2, 0, 1);
  const b = make('b', 'conveyor-auto', 0, -4, 0, 0);
  const c = make('c', 'conveyor-auto', 2, -4, 0, 0);
  const plan = resolveAutoConveyors([miner, a, b, c], 1)!;
  expect(plan.get('b')).toMatchObject({ shape: 'curve-right', offset: 1, rise: -1 });
  const paths = [a, b, c].map((belt) => pathForBuilding({ ...belt, autoConveyor: plan.get(belt.id) }, 1)!);
  expect(paths[0]!.compatible(paths[1]!)).toBe(true);
  expect(paths[1]!.compatible(paths[2]!)).toBe(true);
  expect(paths[1]!.point(0).y).toBe(1.5); expect(paths[1]!.point(paths[1]!.length).y).toBe(.5);
});

it('resolves a line to its source and sink regardless of placement order', () => {
  const m = make('m', 'miner-mk1', 0, 0), a = make('a', 'conveyor-auto', 0, -2, 2);
  const b = make('b', 'conveyor-auto', 0, -4, 1), c = make('c', 'conveyor-auto', -2, -4, 3);
  const t = make('t', 'receiving-terminal', -4, -4, 1);
  const one = resolveAutoConveyors([m, a, b, c, t], 1)!;
  const two = resolveAutoConveyors([t, c, b, a, m], 1)!;
  for (const belt of [a, b, c]) expect(two.get(belt.id)).toEqual(one.get(belt.id));
  expect(one.get('b')?.shape).toBe('curve-left');
});
