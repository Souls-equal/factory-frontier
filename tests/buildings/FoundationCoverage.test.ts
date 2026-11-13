import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { BuildingTerrain } from '../../src/buildings/BuildingTerrain';
import { BuildingCollision } from '../../src/buildings/BuildingCollision';
import { ConstructionController } from '../../src/buildings/ConstructionController';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { VoxelTerrain } from '../../src/world/terrain/VoxelTerrain';
import { ObstacleField, type ObstacleDefinition } from '../../src/world/ObstacleField';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x,z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({ x,z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const far = { x: 15, z: 15, radius: .4 };
function setup(ground: TerrainQuery = terrain, obstacles: readonly ObstacleDefinition[] = []) {
  const inventory = new Inventory(createDefaultItemRegistry(), 10);
  inventory.addItem('stone', 100); inventory.addItem('wood', 50);
  const system = new BuildingSystem(createDefaultBuildingRegistry(inventory.registry), inventory, ground, obstacles, 1, 29);
  return { system, inventory };
}
function place(system: BuildingSystem, x: number, z: number, height = 0) {
  const result = system.place('foundation', x, z, 0, far, height);
  expect(result.reason).toBe('valid'); return result.building!;
}
describe('foundation gaps and elevation', () => {
  it.each([[1, 1, 1], [1, 0, 2]] as const)('permits %i,%i partial overlap (%i cells), rejects full duplicates and charges once', (x,z,_count) => {
    const { system, inventory } = setup(); place(system, 0, 0);
    const before = inventory.snapshot(), preview = system.validate('foundation', x, z, 0, far, 0);
    expect(preview.reason).toBe('valid'); expect(preview.transform.x).toBe(x); expect(preview.transform.z).toBe(z);
    const result = system.place('foundation', x, z, 0, far, 0);
    expect(result.reason).toBe('valid'); expect(result.transform).toEqual(preview.transform);
    expect(inventory.getItemCount('stone')).toBe(80); expect(inventory.getItemCount('wood')).toBe(40);
    expect(system.place('foundation', x, z, 0, far, 0).reason).toBe('occupied space');
    expect(before).not.toEqual(inventory.snapshot()); expect(system.all()).toHaveLength(2);
  });
  it('fills the one remaining cell among three neighbouring foundations without duplicating fully covered areas', () => {
    const { system, inventory } = setup();
    place(system, 0, 0); place(system, 2, 0); place(system, 0, 2);
    const preview = system.validate('foundation', 1, 1, 0, far, 0);
    expect(preview.reason).toBe('valid'); expect(preview.transform).toMatchObject({ x: 1, z: 1, y: 0 });
    const b = system.place('foundation', 1, 1, 0, far, 0).building!;
    const surface = new BuildingTerrain(terrain, system);
    expect(surface.heightAt(1.5, 1.5)).toBeCloseTo(.4);
    const before = inventory.snapshot(); expect(system.place('foundation', 1, 1, 0, far, 0).reason).toBe('occupied space');
    expect(inventory.snapshot()).toEqual(before);
    const terminal = system.place('receiving-terminal', 1, 1, 0, far);
    expect(terminal.reason).toBe('valid'); expect(terminal.transform.y).toBeCloseTo(.4);
    expect(system.demolish(b.id)).toBe('building supports another');
    expect(system.demolish(terminal.building!.id)).toBe('removed');
    expect(system.demolish(b.id)).toBe('removed'); expect(surface.heightAt(1.5, 1.5)).toBe(0);
  });
  it.each([1, 2, 3])('places on uneven voxel terrain with %i raised columns and no terrain edits', (count) => {
    const ground = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 8, columnsZ: 8, blockSize: 1, bottomLevel: -1,
      sampleHeight: (x,z) => x < 2 && z < 2 && Math.floor(z) * 2 + Math.floor(x) < count ? 1 : 0 });
    const { system } = setup(ground); const before = [ground.topLevel(0,0), ground.topLevel(1,0), ground.topLevel(0,1), ground.topLevel(1,1)];
    const preview = system.validate('foundation', 1, 1, 0, far, 0);
    expect(preview.reason).toBe('valid'); expect(preview.transform.y).toBe(1);
    expect(system.place('foundation', 1, 1, 0, far, 0).transform).toEqual(preview.transform);
    expect([ground.topLevel(0,0), ground.topLevel(1,0), ground.topLevel(0,1), ground.topLevel(1,1)]).toEqual(before);
    expect(system.validate('foundation', 4, 4, 0, far, -1).reason).toBe('unsupported height');
  });
  it('ignores objects and player well below or above an elevated slab, but blocks real overlap', () => {
    const rock: ObstacleDefinition = { id: 'rock', kind: 'boulder', x: 0, y: 0, z: 0, radius: .5, height: 1, yaw: 0, variant: 0 };
    const { system } = setup(terrain, [rock]);
    expect(system.validate('foundation', 0, 0, 0, far, .5).reason).toBe('occupied space');
    expect(system.validate('foundation', 0, 0, 0, { x: 0, z: 0, radius: .4, feetY: 0, headY: 1.8 }, 3).reason).toBe('valid');
    expect(system.validate('foundation', 0, 0, 0, { x: 0, z: 0, radius: .4, feetY: 3, headY: 4.8 }, 3).reason).toBe('player overlap');
    expect(system.validate('foundation', 0, 0, 0, { x: 0, z: 0, radius: .4 }, 3).reason).toBe('player overlap');
  });
  it('allows slabs above existing machinery only when their volumes do not intersect', () => {
    const { system } = setup();
    expect(system.place('storage-container', 0, 0, 0, far).reason).toBe('valid');
    expect(system.validate('foundation', 0, 0, 0, far, 1).reason).toBe('occupied space');
    const slab = system.place('foundation', 0, 0, 0, far, 2);
    expect(slab.reason).toBe('valid');
    const collision = new BuildingCollision(new ObstacleField([]), system);
    expect(collision.moveCircle(0, 3, 0, -4, .3, 2.4, 4.2).collided).toBe(false);
  });
  it('allows elevated construction over uneven terrain while still refusing burial', () => {
    const uneven: TerrainQuery = { ...terrain, heightAt: (x) => x > 0 ? 1 : 0, slopeAt: () => 1 };
    const { system } = setup(uneven);
    expect(system.validate('foundation', 0, 0, 0, far, 0).reason).toBe('unsupported height');
    expect(system.validate('foundation', 0, 0, 0, far, 2).reason).toBe('valid');
  });
  it('blocks a foundation intersecting a machine above it but permits a clear gap', () => {
    const { system } = setup(); place(system, 0, 0);
    expect(system.place('storage-container', 0, 0, 0, far).reason).toBe('valid');
    expect(system.validate('foundation', 1, 0, 0, far, 0).reason).toBe('valid');
    expect(system.validate('foundation', 1, 0, 0, far, .2).reason).toBe('occupied space');
  });
  it('keeps different-height overlapping slabs invalid and never charges on rejection', () => {
    const { system, inventory } = setup(); place(system, 0, 0);
    const before = inventory.snapshot();
    expect(system.place('foundation', 1, 0, 0, far, 3).reason).toBe('occupied space');
    expect(inventory.snapshot()).toEqual(before); expect(system.all()).toHaveLength(1);
  });
  it('does not target a platform through nearer terrain', () => {
    const ridge: TerrainQuery = { ...terrain, heightAt: (_x,z) => z > 3 ? 7.5 : 0 };
    const { system } = setup(ridge); place(system, 0, 0, 6);
    const controller = new ConstructionController(system, ridge, 6); controller.select('foundation');
    const point = controller.aim({ position: { x: 0, y: 8.1, z: 3.9 }, yaw: 0, pitch: -Math.PI / 4 });
    expect(point).not.toBeNull(); expect(point!.z).toBeGreaterThan(3);
  });
  it('aims across an elevated platform even when the ground is beyond reach', () => {
    const { system } = setup(); place(system, 0, 0, 6);
    const controller = new ConstructionController(system, terrain, 6); controller.select('foundation');
    const view = { position: { x: 0, y: 8.1, z: 3.9 }, yaw: 0, pitch: -Math.PI / 4 };
    const player = { x: 0, z: 3.9, radius: .4, feetY: 6.4, headY: 8.2 };
    expect(controller.aim(view)).toEqual(expect.objectContaining({ x: 0 }));
    const preview = controller.preview(view, player)!;
    expect(preview.reason).toBe('valid'); expect(preview.transform).toMatchObject({ x: 0, z: 2, y: 6 });
    expect(controller.confirm(view, player)?.transform).toEqual(preview.transform);
  });
});
