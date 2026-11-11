/**
 * Solid obstacles and their collision representation (Phase 1).
 *
 * Collision decision: every obstacle is a **vertical cylinder** (uniform radius,
 * known top height) for physics, whatever its visual shape. This is deliberately
 * the simplest representation that is reliable and cheap:
 * - a circle resolved on the XZ plane can never let the player tunnel through,
 * - push-out is stable and cannot trap the player (unlike box corners),
 * - rocks, masts and milled props can all share one collider type.
 *
 * Obstacles are stored in a uniform spatial hash so a movement step only tests
 * obstacles within a couple of cells of the player instead of the whole world.
 * Nothing here imports Three.js; the renderer reads the same definitions.
 */

export type ObstacleKind = 'boulder' | 'formation' | 'prop';

export interface ObstacleDefinition {
  readonly id: string;
  readonly kind: ObstacleKind;
  /** World-space centre (XZ) and base height (Y) of the obstacle. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Collision footprint radius in metres. */
  readonly radius: number;
  /** Height above the base, in metres. */
  readonly height: number;
  /** Visual yaw in radians. */
  readonly yaw: number;
  /** Visual variant index (resolved by the renderer, ignored by physics). */
  readonly variant: number;
}

export interface CollisionResult {
  readonly x: number;
  readonly z: number;
  readonly collided: boolean;
}

/** Collision contract consumed by the player simulation. */
export interface CollisionQuery {
  resolveCircle(
    x: number,
    z: number,
    radius: number,
    feetY: number,
    headY: number,
  ): CollisionResult;
}

const CELL_SIZE = 8;
const MAX_RESOLVE_PASSES = 4;
/** Angular samples used to escape a cluster of overlapping obstacles. */
const ESCAPE_DIRECTIONS = 24;

export class ObstacleField implements CollisionQuery {
  readonly definitions: readonly ObstacleDefinition[];

  private readonly buckets = new Map<string, number[]>();

  constructor(definitions: readonly ObstacleDefinition[]) {
    this.definitions = Object.freeze([...definitions]);

    for (let index = 0; index < this.definitions.length; index += 1) {
      const definition = this.definitions[index];
      if (definition === undefined) {
        continue;
      }
      const minKeyX = Math.floor((definition.x - definition.radius) / CELL_SIZE);
      const maxKeyX = Math.floor((definition.x + definition.radius) / CELL_SIZE);
      const minKeyZ = Math.floor((definition.z - definition.radius) / CELL_SIZE);
      const maxKeyZ = Math.floor((definition.z + definition.radius) / CELL_SIZE);

      for (let keyX = minKeyX; keyX <= maxKeyX; keyX += 1) {
        for (let keyZ = minKeyZ; keyZ <= maxKeyZ; keyZ += 1) {
          const key = bucketKey(keyX, keyZ);
          const bucket = this.buckets.get(key);
          if (bucket === undefined) {
            this.buckets.set(key, [index]);
          } else {
            bucket.push(index);
          }
        }
      }
    }
  }

  /**
   * Push a vertical capsule out of every overlapping obstacle.
   *
   * `feetY`/`headY` bound the capsule vertically: an obstacle only blocks the
   * player when their vertical spans overlap, which is what allows props on a
   * plateau to be walked under/over later without changing the collider shape.
   */
  resolveCircle(
    x: number,
    z: number,
    radius: number,
    feetY: number,
    headY: number,
  ): CollisionResult {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) {
      throw new RangeError('Collision queries require finite coordinates and a non-negative radius.');
    }

    let resolvedX = x;
    let resolvedZ = z;
    let collided = false;

    for (let pass = 0; pass < MAX_RESOLVE_PASSES; pass += 1) {
      let pushedThisPass = false;
      const candidates = this.candidatesAt(resolvedX, resolvedZ, radius);

      for (const index of candidates) {
        const obstacle = this.definitions[index];
        if (obstacle === undefined || !blocks(obstacle, feetY, headY)) {
          continue;
        }

        const dx = resolvedX - obstacle.x;
        const dz = resolvedZ - obstacle.z;
        const minDistance = obstacle.radius + radius;
        const distanceSq = dx * dx + dz * dz;

        if (distanceSq >= minDistance * minDistance) {
          continue;
        }

        const distance = Math.sqrt(distanceSq);
        if (distance < 1e-6) {
          // Dead centre: push along +X so the result is deterministic.
          resolvedX = obstacle.x + minDistance;
          resolvedZ = obstacle.z;
        } else {
          const scale = minDistance / distance;
          resolvedX = obstacle.x + dx * scale;
          resolvedZ = obstacle.z + dz * scale;
        }
        collided = true;
        pushedThisPass = true;
      }

      if (!pushedThisPass) {
        break;
      }
    }

    // Overlapping obstacles can pin a capsule between them. If it is still
    // inside something, search the boundary of each offending obstacle for the
    // closest free position, so the player is never left stuck inside geometry.
    if (collided && this.penetration(resolvedX, resolvedZ, radius, feetY, headY) > 0) {
      const escaped = this.findEscape(resolvedX, resolvedZ, radius, feetY, headY);
      resolvedX = escaped.x;
      resolvedZ = escaped.z;
    }

    return { x: resolvedX, z: resolvedZ, collided };
  }

  /** Summed squared penetration depth over all blocked obstacles (0 = free). */
  private penetration(x: number, z: number, radius: number, feetY: number, headY: number): number {
    let total = 0;
    for (const index of this.candidatesAt(x, z, radius)) {
      const obstacle = this.definitions[index];
      if (obstacle === undefined || !blocks(obstacle, feetY, headY)) {
        continue;
      }
      const minDistance = obstacle.radius + radius;
      const distance = Math.hypot(x - obstacle.x, z - obstacle.z);
      if (distance < minDistance) {
        const depth = minDistance - distance;
        total += depth * depth;
      }
    }
    return total;
  }

  /** Deterministic radial search for the nearest position outside all blockers. */
  private findEscape(
    x: number,
    z: number,
    radius: number,
    feetY: number,
    headY: number,
  ): { readonly x: number; readonly z: number } {
    let bestX = x;
    let bestZ = z;
    let bestPenalty = this.penetration(x, z, radius, feetY, headY);

    for (const index of this.candidatesAt(x, z, radius)) {
      const obstacle = this.definitions[index];
      if (obstacle === undefined || !blocks(obstacle, feetY, headY)) {
        continue;
      }

      const ringRadius = obstacle.radius + radius + 1e-3;
      for (let step = 0; step < ESCAPE_DIRECTIONS; step += 1) {
        const angle = (step / ESCAPE_DIRECTIONS) * Math.PI * 2;
        const candidateX = obstacle.x + Math.cos(angle) * ringRadius;
        const candidateZ = obstacle.z + Math.sin(angle) * ringRadius;
        const penalty = this.penetration(candidateX, candidateZ, radius, feetY, headY);

        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestX = candidateX;
          bestZ = candidateZ;
        }
        if (penalty === 0) {
          return { x: candidateX, z: candidateZ };
        }
      }
    }

    return { x: bestX, z: bestZ };
  }

  /** Bucket indices near a point, deduplicated. Used by collision and targeting. */
  private candidatesAt(x: number, z: number, radius: number): readonly number[] {
    const minKeyX = Math.floor((x - radius) / CELL_SIZE);
    const maxKeyX = Math.floor((x + radius) / CELL_SIZE);
    const minKeyZ = Math.floor((z - radius) / CELL_SIZE);
    const maxKeyZ = Math.floor((z + radius) / CELL_SIZE);

    if (minKeyX === maxKeyX && minKeyZ === maxKeyZ) {
      return this.buckets.get(bucketKey(minKeyX, minKeyZ)) ?? EMPTY;
    }

    const seen = new Set<number>();
    const result: number[] = [];
    for (let keyX = minKeyX; keyX <= maxKeyX; keyX += 1) {
      for (let keyZ = minKeyZ; keyZ <= maxKeyZ; keyZ += 1) {
        const bucket = this.buckets.get(bucketKey(keyX, keyZ));
        if (bucket === undefined) {
          continue;
        }
        for (const index of bucket) {
          if (!seen.has(index)) {
            seen.add(index);
            result.push(index);
          }
        }
      }
    }
    return result;
  }
}

/** True when an obstacle's vertical span overlaps the player capsule. */
function blocks(obstacle: ObstacleDefinition, feetY: number, headY: number): boolean {
  return feetY < obstacle.y + obstacle.height - 0.02 && headY > obstacle.y;
}

const EMPTY: readonly number[] = Object.freeze([]);

function bucketKey(x: number, z: number): string {
  return `${x}:${z}`;
}
