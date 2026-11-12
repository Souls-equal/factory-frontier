import type { CollisionQuery, CollisionNormal, MovementResult } from '../ObstacleField';
import { VoxelTerrain } from './VoxelTerrain';

/** Swept conservative circle-versus-column walls, composed with natural obstacles. */
export class VoxelCollision implements CollisionQuery {
  constructor(private readonly terrain: VoxelTerrain, private readonly natural: CollisionQuery) {}
  moveCircle(x: number, z: number, dx: number, dz: number, radius: number, feetY: number, headY: number): MovementResult {
    const natural = this.natural.moveCircle(x, z, dx, dz, radius, feetY, headY);
    let px = x, pz = z, rx = natural.x - x, rz = natural.z - z;
    const normals: CollisionNormal[] = [...natural.normals];
    let hit = false;
    const size = this.terrain.blockSize;
    for (let pass = 0; pass < 8; pass++) {
      let nearest = Infinity, nx = 0, nz = 0;
      const minCX = Math.max(0, Math.floor((Math.min(px, px + rx) - radius - this.terrain.originX) / size));
      const maxCX = Math.min(this.terrain.columnsX - 1, Math.floor((Math.max(px, px + rx) + radius - this.terrain.originX) / size));
      const minCZ = Math.max(0, Math.floor((Math.min(pz, pz + rz) - radius - this.terrain.originZ) / size));
      const maxCZ = Math.min(this.terrain.columnsZ - 1, Math.floor((Math.max(pz, pz + rz) + radius - this.terrain.originZ) / size));
      for (let cz = minCZ; cz <= maxCZ; cz++) for (let cx = minCX; cx <= maxCX; cx++) {
        const top = this.terrain.topLevel(cx, cz)! * size;
        if (feetY >= top - 1e-7 || headY <= this.terrain.bottomLevel * size) continue;
        const minX = this.terrain.originX + cx * size - radius, maxX = minX + size + radius * 2;
        const minZ = this.terrain.originZ + cz * size - radius, maxZ = minZ + size + radius * 2;
        if (px > minX + 1e-9 && px < maxX - 1e-9 && pz > minZ + 1e-9 && pz < maxZ - 1e-9) {
          return { x: px, z: pz, collided: true, normals, blocked: true };
        }
        let enter = -Infinity, exit = Infinity, hx = 0, hz = 0;
        for (const [pos, delta, lo, hi, axis] of [[px, rx, minX, maxX, 0], [pz, rz, minZ, maxZ, 1]] as const) {
          if (Math.abs(delta) < 1e-12) { if (pos <= lo || pos >= hi) { exit = -Infinity; break; } continue; }
          const t1 = (lo - pos) / delta, t2 = (hi - pos) / delta;
          const near = Math.min(t1, t2), far = Math.max(t1, t2);
          if (near > enter) { enter = near; hx = axis === 0 ? (delta > 0 ? -1 : 1) : 0; hz = axis === 1 ? (delta > 0 ? -1 : 1) : 0; }
          exit = Math.min(exit, far);
        }
        if (enter >= -1e-9 && enter <= 1 && enter <= exit && enter < nearest && rx * hx + rz * hz < 0) {
          nearest = Math.max(0, enter); nx = hx; nz = hz;
        }
      }
      if (!Number.isFinite(nearest)) {
        if (!hit) return natural;
        const finalX = px + rx, finalZ = pz + rz;
        const check = this.natural.moveCircle(x, z, finalX - x, finalZ - z, radius, feetY, headY);
        if (Math.hypot(check.x - finalX, check.z - finalZ) > 1e-7) return { x, z, collided: true, normals, blocked: true };
        return { x: finalX, z: finalZ, collided: true, normals, blocked: natural.blocked };
      }
      hit = true; px += rx * nearest; pz += rz * nearest; normals.push({ x: nx, z: nz });
      rx *= 1 - nearest; rz *= 1 - nearest;
      const inward = rx * nx + rz * nz;
      if (inward < 0) { rx -= inward * nx; rz -= inward * nz; }
    }
    return { x: px, z: pz, collided: true, normals, blocked: true };
  }
}
