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

  it('sweeps against a small obstacle and reports an outward unit normal', () => {
    const field = new ObstacleField([obstacle({ radius: 0.1 })]);
    const result = field.moveCircle(0, 2, 0, -4, 0.4, 0, 1.8);
    expect(result.z).toBeCloseTo(0.5, 8);
    expect(result.blocked).toBe(false);
    expect(result.normals).toHaveLength(1);
    expect(result.normals[0]?.x).toBeCloseTo(0, 8);
    expect(result.normals[0]?.z).toBeCloseTo(1, 8);
  });

  it('does not escape around the entire obstacle for round-off penetration', () => {
    const field = new ObstacleField([obstacle({ x: 1.447567, z: 0.023544, radius: 0.71 })]);
    const x = 1.4586768148;
    const z = 1.1344884525;
    const result = field.resolveCircle(x, z, 0.4, 0, 1.8);
    expect(Math.hypot(result.x - x, result.z - z)).toBeLessThan(0.001);
  });

  it('preserves unobstructed motion and ignores vertical non-overlap', () => {
    const field = new ObstacleField([obstacle({ height: 1 })]);
    const result = field.moveCircle(0, 3, 1, -4, 0.4, 1.2, 3);
    expect(result).toEqual({ x: 1, z: -1, collided: false, normals: [], blocked: false });
  });

  it('handles duplicate overlapping colliders without introducing a large correction', () => {
    const field = new ObstacleField([obstacle(), obstacle({ id: 'duplicate' })]);
    const result = field.moveCircle(0, 3, 0, -1, 0.4, 0, 1.8);
    expect(result.z).toBeCloseTo(2.4, 8);
    expect(result.blocked).toBe(false);
  });

});

describe('collision stability before Phase 2', () => {
  it('leaves contact cleanly after sustained pressure against nearby cylinders', () => {
    const make = (id: string, x: number): ObstacleDefinition => ({
      id, kind: 'boulder', x, y: 0, z: 0, radius: 1, height: 3, yaw: 0, variant: 0,
    });
    const field = new ObstacleField([make('left', -1), make('right', 1)]);
    let x = 0;
    let z = 2;
    for (let i = 0; i < 500; i++) {
      const result = field.moveCircle(x, z, 0, -0.1, 0.4, 0, 1.8);
      expect(Math.hypot(result.x - x, result.z - z)).toBeLessThanOrEqual(0.1000001);
      expect(Math.hypot(result.x - 1, result.z)).toBeGreaterThanOrEqual(1.4 - 1e-7);
      expect(Math.hypot(result.x + 1, result.z)).toBeGreaterThanOrEqual(1.4 - 1e-7);
      x = result.x; z = result.z;
    }
    const leaving = field.moveCircle(x, z, 0, 0.25, 0.4, 0, 1.8);
    expect(leaving.z - z).toBeCloseTo(0.25, 7);
    expect(leaving.blocked).toBe(false);
  });
});
