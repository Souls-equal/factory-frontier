/**
 * Solid obstacles and their collision representation (Phase 1).
 *
 * Collision decision: every obstacle is a **vertical cylinder** (uniform radius,
 * known top height) for physics, whatever its visual shape. This is deliberately
 * the simplest representation that is reliable and cheap:
 * - a swept circle prevents crossing horizontal obstacle footprints,
 * - contact normals allow movement to slide along obstacle surfaces,
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

export interface CollisionNormal {
  /** Unit outward normal on the horizontal contact plane. */
  readonly x: number;
  readonly z: number;
}

export interface MovementResult extends CollisionResult {
  /** Normals constraining this step; position corrections are never velocity. */
  readonly normals: readonly CollisionNormal[];
  /** Unresolved overlaps or contact iteration limit require stopping motion. */
  readonly blocked: boolean;
}

/** Collision contract consumed by the player simulation. */
export interface CollisionQuery {
  moveCircle(x: number, z: number, dx: number, dz: number, radius: number,
    feetY: number, headY: number): MovementResult;
}

const CELL_SIZE = 8;
const MAX_RESOLVE_PASSES = 4;
// Limit iterative sliding at complicated intersections. Any remaining movement
// is discarded rather than permitting a player to cross an unresolved contact.
const MAX_SWEEP_CONTACTS = 12;
// World-space tolerance for floating-point contact/overlap comparisons (metres).
const CONTACT_EPSILON = 1e-8;
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
    // inside something, search nearby obstacle boundaries for a lower-penetration
    // position. The bounded search can leave overlap in pathological clusters.
    if (collided && this.penetration(resolvedX, resolvedZ, radius, feetY, headY) > CONTACT_EPSILON * CONTACT_EPSILON) {
      const escaped = this.findEscape(resolvedX, resolvedZ, radius, feetY, headY);
      resolvedX = escaped.x;
      resolvedZ = escaped.z;
    }

    return { x: resolvedX, z: resolvedZ, collided };
  }

  /** Sweep a moving circle against vertical cylinders, then slide at each hit.
   * Initial overlap is corrected separately and never contributes to velocity.
   */
  moveCircle(x: number, z: number, dx: number, dz: number, radius: number,
    feetY: number, headY: number): MovementResult {
    if (![x, z, dx, dz, radius, feetY, headY].every(Number.isFinite) || radius < 0) {
      throw new RangeError('Collision movement requires finite values and a non-negative radius.');
    }
    const initial = this.resolveCircle(x, z, radius, feetY, headY);
    let currentX = initial.x;
    let currentZ = initial.z;
    let remainingX = dx;
    let remainingZ = dz;
    let collided = initial.collided;
    const normals: CollisionNormal[] = [];

    // If a pathological overlapping cluster cannot be resolved, do not move
    // through it or manufacture velocity from the attempted correction.
    if (this.penetration(currentX, currentZ, radius, feetY, headY) > CONTACT_EPSILON * CONTACT_EPSILON) {
      return { x: currentX, z: currentZ, collided, normals, blocked: true };
    }

    for (let pass = 0; pass < MAX_SWEEP_CONTACTS; pass += 1) {
      const lengthSq = remainingX * remainingX + remainingZ * remainingZ;
      if (lengthSq <= CONTACT_EPSILON * CONTACT_EPSILON) {
        return { x: currentX, z: currentZ, collided, normals, blocked: false };
      }

      let hitTime = Infinity;
      let hitNormalX = 0;
      let hitNormalZ = 0;
      const candidates = this.candidatesInBounds(
        Math.min(currentX, currentX + remainingX) - radius,
        Math.max(currentX, currentX + remainingX) + radius,
        Math.min(currentZ, currentZ + remainingZ) - radius,
        Math.max(currentZ, currentZ + remainingZ) + radius,
      );
      for (const index of candidates) {
        const obstacle = this.definitions[index];
        if (obstacle === undefined || !blocks(obstacle, feetY, headY)) continue;
        const offsetX = currentX - obstacle.x;
        const offsetZ = currentZ - obstacle.z;
        const reach = obstacle.radius + radius;
        const along = offsetX * remainingX + offsetZ * remainingZ;
        // Only contacts that the movement enters can constrain it.
        if (along >= 0) continue;
        const c = offsetX * offsetX + offsetZ * offsetZ - reach * reach;
        const discriminant = along * along - lengthSq * c;
        if (discriminant < 0) continue;
        const time = Math.max(0, (-along - Math.sqrt(discriminant)) / lengthSq);
        if (time > 1 || time >= hitTime) continue;
        const contactX = offsetX + remainingX * time;
        const contactZ = offsetZ + remainingZ * time;
        const distance = Math.hypot(contactX, contactZ);
        if (distance <= CONTACT_EPSILON) continue;
        const nx = contactX / distance;
        const nz = contactZ / distance;
        if (remainingX * nx + remainingZ * nz >= -CONTACT_EPSILON) continue;
        hitTime = time;
        hitNormalX = nx;
        hitNormalZ = nz;
      }
      if (!Number.isFinite(hitTime)) {
        return { x: currentX + remainingX, z: currentZ + remainingZ, collided, normals, blocked: false };
      }

      collided = true;
      currentX += remainingX * hitTime;
      currentZ += remainingZ * hitTime;
      normals.push({ x: hitNormalX, z: hitNormalZ });
      remainingX *= 1 - hitTime;
      remainingZ *= 1 - hitTime;
      const inward = remainingX * hitNormalX + remainingZ * hitNormalZ;
      if (inward < 0) {
        remainingX -= inward * hitNormalX;
        remainingZ -= inward * hitNormalZ;
      }
    }
    return { x: currentX, z: currentZ, collided, normals, blocked: true };
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

  /** Deterministic radial search, choosing the closest free sampled point. */
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
    let bestDistance = Infinity;

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

        const distance = Math.hypot(candidateX - x, candidateZ - z);
        if (penalty < bestPenalty || (penalty === bestPenalty && distance < bestDistance)) {
          bestPenalty = penalty;
          bestDistance = distance;
          bestX = candidateX;
          bestZ = candidateZ;
        }
      }
    }

    return { x: bestX, z: bestZ };
  }

  /** Bucket indices near a point, deduplicated. Used by collision and targeting. */
  private candidatesAt(x: number, z: number, radius: number): readonly number[] {
    return this.candidatesInBounds(x - radius, x + radius, z - radius, z + radius);
  }

  private candidatesInBounds(minX: number, maxX: number, minZ: number, maxZ: number): readonly number[] {
    const minKeyX = Math.floor(minX / CELL_SIZE);
    const maxKeyX = Math.floor(maxX / CELL_SIZE);
    const minKeyZ = Math.floor(minZ / CELL_SIZE);
    const maxKeyZ = Math.floor(maxZ / CELL_SIZE);

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
