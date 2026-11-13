import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { ConstructionController } from '../../src/buildings/ConstructionController';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, size: 80, resolution: 40, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 40 && Math.abs(z) <= 40, clampXZ: (x, z) => ({ x, z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const far = { x: 25, z: 25, radius: .4, feetY: 0, headY: 1.8 };
const down = (x: number, z: number, y = 3) => ({ position: { x, y, z }, yaw: 0, pitch: -Math.PI / 2 });
function setup(ground: TerrainQuery = terrain) {
  const inventory = new Inventory(createDefaultItemRegistry(), 10);
  inventory.addItem('stone', 100); inventory.addItem('wood', 100);
  const system = new BuildingSystem(createDefaultBuildingRegistry(inventory.registry), inventory, ground, [], 1, 39);
  const controller = new ConstructionController(system, ground);
  return { system, inventory, controller };
}
function place(system: BuildingSystem, id: string, x: number, z: number, rotation = 0, offset?: number) {
  const result = system.place(id, x, z, rotation, far, offset);
  expect(result.reason).toBe('valid'); return result.building!;
}

describe('platforms at a raised conveyor level', () => {
  it.each(['up', 'down'])('aligns beneath the upper %s lift port in all directions and preserves manual adjustment', (direction) => {
    for (let r = 0; r < 4; r++) {
      const { system, controller, inventory } = setup();
      place(system, 'foundation', 0, 0, 0, 0);
      const lift = place(system, `lift-${direction}-3`, 0, 0, r);
      const a = r * Math.PI / 2, z = direction === 'up' ? -2 : 2;
      const x = Math.round(z * Math.sin(a)), zz = Math.round(z * Math.cos(a));
      controller.select('foundation');
      const preview = controller.preview(down(x, zz), far)!;
      expect(preview.reason).toBe('valid'); expect(preview.snappedToLogistics).toBe(true);
      expect(preview.transform.y + .4).toBeCloseTo(lift.transform.y + 3);
      const before = inventory.snapshot();
      controller.adjustFoundationHeight(1);
      expect(controller.preview(down(x, zz), far)!.transform.y).toBeCloseTo(preview.transform.y + .1);
      controller.adjustFoundationHeight(-1);
      const result = controller.confirm(down(x, zz), far)!;
      expect(result.transform).toEqual(preview.transform); expect(inventory.snapshot()).not.toEqual(before);
      const localZ = direction === 'up' ? -1.5 : 1.5;
      const beltX = Math.round((-.5 * Math.cos(a) + localZ * Math.sin(a)) * 2) / 2;
      const beltZ = Math.round((.5 * Math.sin(a) + localZ * Math.cos(a)) * 2) / 2;
      const belt = system.place('conveyor-cell', beltX, beltZ, r, far);
      expect(belt.reason).toBe('valid'); expect(belt.transform.y).toBeCloseTo(lift.transform.y + 3);
    }
  });
  it.each(['up', 'down'])('aligns a foundation to a fractional-height %s lift', (direction) => {
    const { system, controller } = setup(); const lift = place(system, `lift-${direction}-2.3`, 0, 0);
    controller.select('foundation'); const view = down(0, direction === 'up' ? -2 : 2);
    const preview = controller.preview(view, far)!;
    expect(preview.reason).toBe('valid'); expect(preview.snappedToLogistics).toBe(true);
    expect(preview.transform.y + .4).toBeCloseTo(lift.transform.y + 2.3);
    expect(controller.confirm(view, far)!.transform).toEqual(preview.transform);
  });
  it('aligns beneath a flat raised belt and refuses to bury a slab under ground belts', () => {
    const { system, controller } = setup();
    const lift = place(system, 'lift-up-2', 0, 0);
    const belt = place(system, 'conveyor-cell', -.5, -1.5);
    expect(belt.transform.y).toBe(2); expect(system.demolish(lift.id)).toBe('removed');
    controller.select('foundation');
    const preview = controller.preview(down(0, -2), far)!;
    expect(preview.reason).toBe('valid'); expect(preview.snappedToLogistics).toBe(true);
    expect(preview.transform.y).toBeCloseTo(1.6);
    expect(controller.confirm(down(0, -2), far)!.transform).toEqual(preview.transform);
    const groundBelt = place(system, 'conveyor-cell', 5.5, .5);
    const groundPreview = controller.preview(down(5, 0), far)!;
    expect(groundPreview.transform.y).toBe(0); expect(groundPreview.snappedToLogistics).toBeUndefined();
    expect(system.get(groundBelt.id)).toBeDefined();
  });
});

describe('machines on shared platforms', () => {
  it.each(['smelter', 'constructor', 'storage-container', 'splitter', 'merger', 'lift-up-3', 'receiving-terminal'])('aims and places %s across two raised slabs, with protected support', (type) => {
    const { system, controller, inventory } = setup();
    const first = place(system, 'foundation', 0, 0, 0, 3), second = place(system, 'foundation', 2, 0, 0, 0);
    controller.select(type); const view = down(1, 0, 5.4), before = inventory.snapshot();
    const preview = controller.preview(view, far)!;
    expect(preview.reason).toBe('valid'); expect(preview.transform).toMatchObject({ x: 1, z: 0 }); expect(preview.transform.y).toBeCloseTo(3.4);
    const placed = controller.confirm(view, far)!; expect(placed.transform).toEqual(preview.transform);
    expect(placed.reason).toBe('valid'); expect(inventory.snapshot()).not.toEqual(before);
    expect(system.demolish(first.id)).toBe('building supports another'); expect(system.demolish(second.id)).toBe('building supports another');
  });
  it('does not accept a footprint that is only partly supported', () => {
    const { system } = setup(); place(system, 'foundation', 0, 0, 0, 3);
    const result = system.validate('smelter', 1, 0, 0, far);
    expect(result.reason).toBe('occupied space');
  });
  it('allows supported machinery over steep terrain below while retaining real collisions', () => {
    const rough = { ...terrain, heightAt: (x: number) => x > 0 ? 1 : 0, slopeAt: () => 1 };
    const { system } = setup(rough);
    place(system, 'foundation', 0, 0, 0, 3);
    const machine = system.place('storage-container', 0, 0, 0, far);
    expect(machine.reason).toBe('valid'); expect(machine.transform.y).toBeCloseTo(3.4);
    expect(system.validate('smelter', 0, 0, 0, far).reason).toBe('occupied space');
  });
});

it('rejects conflicting raised port levels without moving or charging the player', () => {
  const { system, controller, inventory } = setup();
  place(system, 'lift-up-3', 0, 0, 0); place(system, 'lift-up-4', 0, -4, 2);
  controller.select('foundation'); const before = inventory.snapshot();
  const preview = controller.preview(down(0, -2), far)!;
  expect(preview.reason).toBe('incompatible connection');
  expect(controller.confirm(down(0, -2), far)?.reason).toBe('incompatible connection');
  expect(inventory.snapshot()).toEqual(before); expect(system.all()).toHaveLength(2);
});

it('continues a platform next to a raised belt and keeps the upper level', () => {
  const { system, controller } = setup();
  const lift = place(system, 'lift-up-2', 0, 0);
  place(system, 'conveyor-cell', -.5, -1.5); expect(system.demolish(lift.id)).toBe('removed');
  controller.select('foundation'); const preview = controller.preview(down(-1, -3), far)!;
  expect(preview.reason).toBe('valid'); expect(preview.snappedToLogistics).toBe(true);
  expect(preview.transform.y).toBeCloseTo(1.6);
});

it('keeps the ray and terrain reach limited for machines on platforms', () => {
  const { system, controller } = setup(); place(system, 'foundation', 0, 0, 0, 6);
  controller.select('smelter');
  expect(controller.aim(down(0, 0, 13.1))).toBeNull();
  const ridge = { ...terrain, heightAt: (_x: number, z: number) => z > 3 ? 7.5 : 0 };
  const c = new ConstructionController(system, ridge, 6); c.select('smelter');
  expect(c.aim({ position: { x: 0, y: 8.1, z: 3.9 }, yaw: 0, pitch: -Math.PI / 4 })!.z).toBeGreaterThan(3);
});

it('prevents placement at mismatched platform and connected-belt levels without spending materials', () => {
  const { system, inventory } = setup();
  place(system, 'foundation', 0, 0, 0, 2);
  // The incoming ground-level belt connects to the rear face of the supported machine.
  place(system, 'conveyor-cell', -.5, 1.5);
  const before = inventory.snapshot();
  const result = system.place('storage-container', 0, 0, 0, far);
  expect(result.reason).toBe('incompatible connection');
  expect(inventory.snapshot()).toEqual(before);
});

it('ignores players and obstacles below a supported machine but rejects actual vertical overlaps', () => {
  const inventory = new Inventory(createDefaultItemRegistry(), 10); inventory.addItem('stone', 100); inventory.addItem('wood', 100);
  const rock = { id: 'rock', kind: 'boulder' as const, x: 0, y: 0, z: 0, radius: .5, height: 1, yaw: 0, variant: 0 };
  const system = new BuildingSystem(createDefaultBuildingRegistry(inventory.registry), inventory, terrain, [rock], 1, 39);
  place(system, 'foundation', 0, 0, 0, 3);
  expect(system.validate('smelter', 0, 0, 0, { x: 0, z: 0, radius: .4, feetY: 0, headY: 1.8 }).reason).toBe('valid');
  expect(system.validate('smelter', 0, 0, 0, { x: 0, z: 0, radius: .4, feetY: 3.4, headY: 5.2 }).reason).toBe('player overlap');
  expect(system.validate('smelter', 0, 0, 0, { x: 0, z: 0, radius: .4 }).reason).toBe('player overlap');
  const tallRock = { ...rock, height: 4 };
  let obstacles: readonly typeof rock[] = [];
  const dynamic = new BuildingSystem(createDefaultBuildingRegistry(inventory.registry), inventory, terrain, [], 1, 39, [], () => obstacles);
  place(dynamic, 'foundation', 0, 0, 0, 3);
  obstacles = [tallRock];
  expect(dynamic.validate('smelter', 0, 0, 0, far).reason).toBe('occupied space');
});

it.each(['lift-up-3', 'lift-down-3'])('targets the %s body for logistics inspection', (type) => {
  const { system, controller } = setup();
  const lift = place(system, type, 0, 0);
  const view = { position: { x: lift.transform.x + 3, y: lift.transform.y + 1.5, z: lift.transform.z }, yaw: Math.PI / 2, pitch: 0 };
  expect(controller.target(view)).toBe(lift.id);
});
