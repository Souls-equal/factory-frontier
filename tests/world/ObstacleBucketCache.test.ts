import { describe, expect, it, vi } from 'vitest';
import { ObstacleField, type ObstacleDefinition } from '../../src/world/ObstacleField';
import { createRandom } from '../../src/world/rng';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { GatherableCollision } from '../../src/resources/Gatherables';
import { Inventory } from '../../src/items/Inventory';
import { VoxelCollision } from '../../src/world/terrain/VoxelCollision';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

const rock = (id: string, x: number, z: number, radius = 1): ObstacleDefinition =>
  ({ id, kind: 'boulder', x, y: 0, z, radius, height: 3, yaw: 0, variant: 0 });

describe('bounded natural collision buckets', () => {
  it('lazily loads, refreshes and evicts even empty buckets in LRU order', () => {
    const getX = vi.fn(() => 0), d = rock('a', 0, 0);
    Object.defineProperty(d, 'x', { get: getX });
    const field = new ObstacleField([d], { maxCachedBuckets: 2 });
    expect(field.cachedBucketCount).toBe(0);
    const query = (x: number) => field.resolveCircle(x, 100, 0, 0, 1.8);
    query(100); query(108);
    expect(field.cachedBucketCount).toBe(2); expect(getX).toHaveBeenCalledTimes(4);
    query(100); expect(getX).toHaveBeenCalledTimes(4); // A is newest
    query(116); expect(getX).toHaveBeenCalledTimes(6); // evicts B
    query(100); expect(getX).toHaveBeenCalledTimes(6);
    query(108); expect(getX).toHaveBeenCalledTimes(8);
    expect(field.cachedBucketCount).toBe(2);
    expect(() => new ObstacleField([], { maxCachedBuckets: 0 })).toThrow(RangeError);
    expect(() => new ObstacleField([], { maxCachedBuckets: 1.5 })).toThrow(RangeError);
  });

  it('exactly matches the eager hash for overlaps, long sweeps, slides, boundaries and repeated eviction', () => {
    const random = createRandom(7919);
    const definitions = Array.from({ length: 65 }, (_, i) => ({
      ...rock(`rock-${i}`, random.range(-60, 60), random.range(-60, 60), random.range(.1, 7)),
      y: random.range(-2, 4), height: random.range(.5, 8),
    }));
    definitions.push(rock('overlap-a', 0, 0, 2), rock('overlap-b', 2, 0, 2), rock('wide', 8, 8, 12));
    const eager = new ObstacleField(definitions);
    const caches = [1, 4, 128].map(maxCachedBuckets => new ObstacleField(definitions, { maxCachedBuckets }));
    const samples = [
      {x: 1, z: 0, dx: 0, dz: 0, radius: .4, feet: 0},
      {x: -70, z: 8, dx: 140, dz: 0, radius: .4, feet: 0},
      {x: 7.9999, z: 8, dx: 0, dz: 10, radius: 1, feet: 0},
      ...Array.from({ length: 800 }, () => ({ x: random.range(-65, 65), z: random.range(-65, 65),
        dx: random.range(-18, 18), dz: random.range(-18, 18), radius: random.range(.1, 2), feet: random.range(-2, 8) })),
    ];
    for (const q of samples) for (const field of caches) {
      expect(field.resolveCircle(q.x, q.z, q.radius, q.feet, q.feet + 1.8)).toEqual(eager.resolveCircle(q.x, q.z, q.radius, q.feet, q.feet + 1.8));
      expect(field.moveCircle(q.x, q.z, q.dx, q.dz, q.radius, q.feet, q.feet + 1.8)).toEqual(eager.moveCircle(q.x, q.z, q.dx, q.dz, q.radius, q.feet, q.feet + 1.8));
    }
    expect(caches[0]!.cachedBucketCount).toBeLessThanOrEqual(1);
    expect(caches[1]!.cachedBucketCount).toBeLessThanOrEqual(4);
    expect(caches[2]!.cachedBucketCount).toBeLessThanOrEqual(128);
  }, 15000);

  it('matches eager collision through voxel composition in seeded generated worlds', () => {
    const random = createRandom(8311);
    for (const seed of [1, 9, 123]) {
      const world = createWorld(createGameConfig({ world: { seed, sizeMeters: 80, resolution: 32, obstacleCount: 20 } }));
      const reference = new VoxelCollision(world.terrain, new ObstacleField([...world.obstacleDefinitions, ...world.gatherables.treeObstacles()]));
      const streamed = new VoxelCollision(world.terrain, new GatherableCollision(world.obstacles, world.gatherables));
      const locations = [...world.obstacleDefinitions, ...world.gatherables.treeObstacles()];
      for (let i = 0; i < 160; i++) {
        const object = locations[i % locations.length]!;
        const x = object.x + random.range(-2, 2), z = object.z + random.range(-2, 2);
        const dx = random.range(-2, 2), dz = random.range(-2, 2), y = object.y;
        expect(streamed.moveCircle(x, z, dx, dz, .4, y, y + 1.8)).toEqual(reference.moveCircle(x, z, dx, dz, .4, y, y + 1.8));
      }
    }
  });

  it('integrates lazy collision buckets into the world and removes a collected tree after revisiting', () => {
    const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } }), inventory);
    expect(world.obstacles.cachedBucketCount).toBe(0);
    const tree = world.gatherables.definitions.find(d => d.kind === 'tree')!;
    const emptyBase = new ObstacleField([], { maxCachedBuckets: 2 });
    const collision = new GatherableCollision(emptyBase, world.gatherables);
    const move = () => collision.moveCircle(tree.x - 2, tree.z, 4, 0, .3, tree.y, tree.y + 1.8);
    expect(move().collided).toBe(true);
    collision.moveCircle(-100, -100, 1, 0, .3, 0, 1.8);
    const target = world.gatherables.interactables(inventory, 4).find(i => i.descriptor.id === tree.id)!;
    expect(target.interact().ok).toBe(true); expect(target.interact().ok).toBe(true); expect(target.interact().ok).toBe(true);
    expect(world.gatherables.active(tree.id)).toBe(false);
    expect(move().collided).toBe(false);
  });
});
