import type { InteractionPoint } from './Interactable';

/**
 * Pure ray/sphere maths for the interaction system.
 *
 * Keeping this out of Three.js means interaction targeting is deterministic and
 * testable in Node, and the ray never depends on mesh geometry. Visual objects
 * that are not registered as interactables are ignored by construction.
 */

export interface Ray {
  readonly origin: InteractionPoint;
  /** Must be a unit vector. */
  readonly direction: InteractionPoint;
}

/**
 * Distance along `ray` to the first intersection with a sphere, or `null`.
 *
 * Returns the nearest non-negative hit. A ray starting inside the sphere counts
 * as a hit at distance 0.
 */
export function raySphereIntersection(
  ray: Ray,
  centre: InteractionPoint,
  radius: number,
): number | null {
  if (!(radius > 0)) {
    return null;
  }

  const toCentreX = centre.x - ray.origin.x;
  const toCentreY = centre.y - ray.origin.y;
  const toCentreZ = centre.z - ray.origin.z;

  const projection = toCentreX * ray.direction.x + toCentreY * ray.direction.y + toCentreZ * ray.direction.z;
  const centreDistanceSq = toCentreX * toCentreX + toCentreY * toCentreY + toCentreZ * toCentreZ;
  const discriminant = projection * projection - (centreDistanceSq - radius * radius);

  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const near = projection - root;
  const far = projection + root;

  if (near >= 0) {
    return near;
  }
  if (far >= 0) {
    return 0;
  }
  return null;
}

/** Build a unit forward vector from a first-person yaw/pitch pair. */
export function forwardVector(yaw: number, pitch: number): InteractionPoint {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}
