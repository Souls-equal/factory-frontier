import { describe, expect, it } from 'vitest';

import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';

const config = createGameConfig({
  world: { seed: 777, resolution: 40, sizeMeters: 140, obstacleCount: 18, spawnFlatRadius: 12 },
});

describe('createWorld', () => {
  it('is reproducible from the seed', () => {
    const first = createWorld(config);
    const second = createWorld(config);

    expect(second.spawn).toEqual(first.spawn);
    expect(second.obstacleDefinitions.length).toBe(first.obstacleDefinitions.length);

    first.obstacleDefinitions.forEach((obstacle, index) => {
      const other = second.obstacleDefinitions[index];
      expect(other?.id).toBe(obstacle.id);
      expect(other?.x).toBe(obstacle.x);
      expect(other?.z).toBe(obstacle.z);
    });
  });

  it('changes layout for a different seed', () => {
    const other = createWorld(createGameConfig({ world: { ...config.world, seed: 1234 } }));

    expect(other.obstacleDefinitions[0]?.x).not.toBe(createWorld(config).obstacleDefinitions[0]?.x);
  });

  it('spawns the player on the terrain surface', () => {
    const world = createWorld(config);

    expect(world.spawn.y).toBeCloseTo(world.terrain.heightAt(world.spawn.x, world.spawn.z), 6);
    expect(world.terrain.contains(world.spawn.x, world.spawn.z)).toBe(true);
    expect(world.terrain.slopeAt(world.spawn.x, world.spawn.z)).toBeLessThan(0.25);
  });

  it('keeps the outpost clearing free of boulders', () => {
    const world = createWorld(config);

    for (const obstacle of world.obstacleDefinitions) {
      if (obstacle.kind === 'prop') {
        continue;
      }
      const distance = Math.hypot(obstacle.x - world.spawn.x, obstacle.z - world.spawn.z);
      expect(distance).toBeGreaterThan(config.world.spawnFlatRadius + obstacle.radius);
    }
  });

  it('generates the requested number of obstacles with unique ids', () => {
    const world = createWorld(config);
    const rocks = world.obstacleDefinitions.filter((obstacle) => obstacle.kind !== 'prop');
    const ids = new Set(world.obstacleDefinitions.map((obstacle) => obstacle.id));

    expect(rocks).toHaveLength(config.world.obstacleCount);
    expect(ids.size).toBe(world.obstacleDefinitions.length);
  });

  it('places every obstacle on the terrain surface', () => {
    const world = createWorld(config);

    for (const obstacle of world.obstacleDefinitions) {
      expect(obstacle.y).toBeCloseTo(world.terrain.heightAt(obstacle.x, obstacle.z), 5);
      expect(obstacle.radius).toBeGreaterThan(0);
      expect(obstacle.height).toBeGreaterThan(0);
    }
  });

  it('registers solid colliders for the interactable masts', () => {
    const world = createWorld(config);

    for (const interactable of world.interactables) {
      const collider = world.obstacleDefinitions.find(
        (obstacle) => obstacle.id === `${interactable.id}-collider`,
      );
      expect(collider).toBeDefined();
      expect(collider?.x).toBeCloseTo(interactable.x, 6);
      expect(collider?.z).toBeCloseTo(interactable.z, 6);
    }
  });

  it('provides interactables with stable ids, names and hints', () => {
    const world = createWorld(config);

    expect(world.interactables.length).toBeGreaterThanOrEqual(2);
    for (const interactable of world.interactables) {
      expect(interactable.id).toMatch(/^[a-z-]+$/);
      expect(interactable.displayName.length).toBeGreaterThan(0);
      expect(interactable.hint.length).toBeGreaterThan(0);
      expect(interactable.range).toBeGreaterThan(0);
      expect(interactable.targetRadius).toBeGreaterThan(0);
      expect(interactable.baseY).toBeCloseTo(
        world.terrain.heightAt(interactable.x, interactable.z),
        6,
      );
      // The anchor sits above the prop base so a first-person ray can hit it.
      expect(interactable.y).toBeGreaterThan(interactable.baseY);
    }
  });

  it('does not overlap the interactables with each other', () => {
    const world = createWorld(config);
    const [first, second] = world.interactables;

    if (first === undefined || second === undefined) {
      throw new Error('Expected at least two interactables.');
    }

    const distance = Math.hypot(first.x - second.x, first.z - second.z);
    expect(distance).toBeGreaterThan(first.range + second.range);
  });
});
