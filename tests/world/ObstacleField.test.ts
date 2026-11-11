import { describe, expect, it } from 'vitest';

import { ObstacleField, type ObstacleDefinition } from '../../src/world/ObstacleField';

function obstacle(overrides: Partial<ObstacleDefinition> = {}): ObstacleDefinition {
  return {
    id: 'rock-0',
    kind: 'boulder',
    x: 0,
    y: 0,
    z: 0,
    radius: 2,
    height: 3,
    yaw: 0,
    variant: 0,
    ...overrides,
  };
}

describe('ObstacleField', () => {
  it('pushes a capsule out of an overlapping cylinder', () => {
    const field = new ObstacleField([obstacle()]);

    const result = field.resolveCircle(1, 0, 0.5, 0, 1.8);

    expect(result.collided).toBe(true);
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(2.5, 5);
  });

  it('leaves positions outside the obstacle untouched', () => {
    const field = new ObstacleField([obstacle()]);

    const result = field.resolveCircle(10, 0, 0.5, 0, 1.8);

    expect(result.collided).toBe(false);
    expect(result.x).toBe(10);
    expect(result.z).toBe(0);
  });

  it('ignores obstacles the player is standing on top of', () => {
    const field = new ObstacleField([obstacle({ height: 1 })]);

    const result = field.resolveCircle(0.5, 0, 0.4, 1.2, 3);

    expect(result.collided).toBe(false);
  });

  it('ignores obstacles entirely above the player', () => {
    const field = new ObstacleField([obstacle({ y: 12, height: 2 })]);

    const result = field.resolveCircle(0.2, 0, 0.4, 0, 1.8);

    expect(result.collided).toBe(false);
  });

  it('resolves a dead-centre overlap deterministically', () => {
    const field = new ObstacleField([obstacle()]);

    const first = field.resolveCircle(0, 0, 0.5, 0, 1.8);
    const second = field.resolveCircle(0, 0, 0.5, 0, 1.8);

    expect(first).toEqual(second);
    expect(Math.hypot(first.x, first.z)).toBeCloseTo(2.5, 5);
  });

  it('resolves overlapping obstacles without leaving the capsule inside', () => {
    const field = new ObstacleField([
      obstacle({ id: 'a', x: 0, z: 0, radius: 1.5 }),
      obstacle({ id: 'b', x: 2, z: 0, radius: 1.5 }),
    ]);

    const result = field.resolveCircle(1, 0, 0.4, 0, 1.8);
    const clearOfFirst = Math.hypot(result.x - 0, result.z - 0) >= 1.5 + 0.4 - 1e-3;
    const clearOfSecond = Math.hypot(result.x - 2, result.z - 0) >= 1.5 + 0.4 - 1e-3;

    expect(result.collided).toBe(true);
    expect(clearOfFirst).toBe(true);
    expect(clearOfSecond).toBe(true);
  });

  it('only tests objects in nearby spatial buckets', () => {
    const definitions = Array.from({ length: 60 }, (_, index) =>
      obstacle({ id: `rock-${index}`, x: 400 + index * 6, z: 400, radius: 1 }),
    );
    const field = new ObstacleField([...definitions, obstacle({ id: 'near' })]);

    const near = field.resolveCircle(1, 0, 0.5, 0, 1.8);
    const far = field.resolveCircle(-500, -500, 0.5, 0, 1.8);

    expect(near.collided).toBe(true);
    expect(far.collided).toBe(false);
  });

  it('copies the definition list and reports it read-only', () => {
    const definitions = [obstacle()];
    const field = new ObstacleField(definitions);
    definitions.push(obstacle({ id: 'later' }));

    expect(field.definitions).toHaveLength(1);
    expect(Object.isFrozen(field.definitions)).toBe(true);
  });

  it('rejects invalid queries', () => {
    const field = new ObstacleField([obstacle()]);

    expect(() => field.resolveCircle(Number.NaN, 0, 0.5, 0, 1.8)).toThrow(RangeError);
    expect(() => field.resolveCircle(0, 0, -1, 0, 1.8)).toThrow(RangeError);
  });
});
