import type { CollisionQuery, CollisionNormal, MovementResult } from '../world/ObstacleField';
import type { BuildingSystem } from './BuildingSystem';

/** Conservative swept capsule-vs-rectangle collision composed with existing solids. */
export class BuildingCollision implements CollisionQuery {
  constructor(private readonly natural: CollisionQuery, private readonly buildings: BuildingSystem) {}
  moveCircle(x: number, z: number, dx: number, dz: number, radius: number, feetY: number, headY: number): MovementResult {
    const natural = this.natural.moveCircle(x, z, dx, dz, radius, feetY, headY);
    let px = x, pz = z, rx = natural.x - x, rz = natural.z - z;
    let collided = natural.collided;
    const normals: CollisionNormal[] = [...natural.normals];
    const solids = this.buildings.all().filter((item) => {
      const height = this.buildings.registry.get(item.typeId).height;
      return feetY < item.transform.y + height - 0.02 && headY > item.transform.y;
    });
    if (!solids.length) return natural;
    let buildingHit = false;
    for (let pass = 0; pass < 8; pass++) {
      let nearest = Infinity, nx = 0, nz = 0;
      for (const building of solids) {
        const f = building.transform.footprint;
        const minX = f.minX - radius, maxX = f.maxX + radius, minZ = f.minZ - radius, maxZ = f.maxZ + radius;
        // Conservative square corner expansion keeps the capsule out of the real rectangle.
        if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
          // Do not manufacture a correction velocity for unexpected initial overlap.
          return { x: px, z: pz, collided: true, normals, blocked: true };
        }
        let enter = -Infinity, exit = Infinity, hitX = 0, hitZ = 0;
        for (const axis of ['x', 'z'] as const) {
          const pos = axis === 'x' ? px : pz, delta = axis === 'x' ? rx : rz;
          const min = axis === 'x' ? minX : minZ, max = axis === 'x' ? maxX : maxZ;
          if (Math.abs(delta) < 1e-12) { if (pos <= min || pos >= max) { exit = -Infinity; break; } continue; }
          const t1 = (min - pos) / delta, t2 = (max - pos) / delta;
          const near = Math.min(t1, t2), far = Math.max(t1, t2);
          if (near > enter) { enter = near; hitX = axis === 'x' ? (delta > 0 ? -1 : 1) : 0; hitZ = axis === 'z' ? (delta > 0 ? -1 : 1) : 0; }
          exit = Math.min(exit, far);
        }
        if (enter >= 0 && enter <= 1 && enter <= exit && enter < nearest && rx * hitX + rz * hitZ < 0) {
          nearest = enter; nx = hitX; nz = hitZ;
        }
      }
      if (!Number.isFinite(nearest)) {
        if (!buildingHit) return natural;
        const finalX = px + rx, finalZ = pz + rz;
        // The straight segment remaining after building sliding must not cut back
        // through a natural obstacle whose earlier sweep took a different path.
        const check = this.natural.moveCircle(x, z, finalX - x, finalZ - z, radius, feetY, headY);
        if (Math.hypot(check.x - finalX, check.z - finalZ) > 1e-7) {
          return { x, z, collided: true, normals: [...normals, ...check.normals], blocked: true };
        }
        return { x: finalX, z: finalZ, collided, normals, blocked: natural.blocked };
      }
      buildingHit = true; collided = true; px += rx * nearest; pz += rz * nearest;
      normals.push({ x: nx, z: nz }); rx *= 1 - nearest; rz *= 1 - nearest;
      const inward = rx * nx + rz * nz;
      if (inward < 0) { rx -= inward * nx; rz -= inward * nz; }
    }
    return { x: px, z: pz, collided, normals, blocked: true };
  }
}
