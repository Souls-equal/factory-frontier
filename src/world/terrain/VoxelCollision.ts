import type { CollisionQuery, CollisionNormal, MovementResult } from '../ObstacleField';
import { VoxelTerrain } from './VoxelTerrain';

const EPS = 1e-9;
interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }
interface Hit { time: number; x: number; z: number }

/** Normal out of a true circle/rectangle overlap, not the square corner of an expanded AABB. */
function overlapNormal(x: number, z: number, radius: number, rect: Rect, dx: number, dz: number): CollisionNormal | null {
  const closestX = Math.max(rect.minX, Math.min(rect.maxX, x));
  const closestZ = Math.max(rect.minZ, Math.min(rect.maxZ, z));
  const ox = x - closestX, oz = z - closestZ, distance = Math.hypot(ox, oz);
  if (distance > EPS) {
    if (distance >= radius - EPS) return null;
    return { x: ox / distance, z: oz / distance };
  }
  if (radius <= EPS && !(x > rect.minX + EPS && x < rect.maxX - EPS && z > rect.minZ + EPS && z < rect.maxZ - EPS)) return null;
  // Centre inside a column: allow escape toward its nearest face, without pushing.
  const faces = [
    { depth: x - rect.minX, x: -1, z: 0 }, { depth: rect.maxX - x, x: 1, z: 0 },
    { depth: z - rect.minZ, x: 0, z: -1 }, { depth: rect.maxZ - z, x: 0, z: 1 },
  ];
  faces.sort((a, b) => a.depth - b.depth || (dx * b.x + dz * b.z) - (dx * a.x + dz * a.z));
  return faces[0]!;
}

/** Exact swept circle against the four straight sides and four rounded corners. */
function sweepRect(x: number, z: number, dx: number, dz: number, radius: number, rect: Rect): Hit | null {
  let best: Hit | null = null;
  const consider = (time: number, nx: number, nz: number): void => {
    if (time < -EPS || time > 1 + EPS || dx * nx + dz * nz >= -EPS || (best && time >= best.time)) return;
    best = { time: Math.max(0, Math.min(1, time)), x: nx, z: nz };
  };
  if (Math.abs(dx) > EPS) for (const [face, nx] of [[rect.minX - radius, -1], [rect.maxX + radius, 1]] as const) {
    const t = (face - x) / dx, at = z + dz * t;
    if (at >= rect.minZ - EPS && at <= rect.maxZ + EPS) consider(t, nx, 0);
  }
  if (Math.abs(dz) > EPS) for (const [face, nz] of [[rect.minZ - radius, -1], [rect.maxZ + radius, 1]] as const) {
    const t = (face - z) / dz, at = x + dx * t;
    if (at >= rect.minX - EPS && at <= rect.maxX + EPS) consider(t, 0, nz);
  }
  const lengthSq = dx * dx + dz * dz;
  if (radius > EPS && lengthSq > EPS * EPS) {
    for (const [cx, sx] of [[rect.minX, -1], [rect.maxX, 1]] as const) for (const [cz, sz] of [[rect.minZ, -1], [rect.maxZ, 1]] as const) {
      const ox = x - cx, oz = z - cz, along = ox * dx + oz * dz;
      const discriminant = along * along - lengthSq * (ox * ox + oz * oz - radius * radius);
      if (discriminant < 0) continue;
      const t = (-along - Math.sqrt(discriminant)) / lengthSq;
      const hx = x + dx * t - cx, hz = z + dz * t - cz;
      if (hx * sx >= -EPS && hz * sz >= -EPS) consider(t, hx / radius, hz / radius);
    }
  }
  return best;
}

/** Swept circle versus voxel columns, composed with natural obstacles. */
export class VoxelCollision implements CollisionQuery {
  constructor(private readonly terrain: VoxelTerrain, private readonly natural: CollisionQuery) {}
  moveCircle(x: number, z: number, dx: number, dz: number, radius: number, feetY: number, headY: number): MovementResult {
    const natural = this.natural.moveCircle(x, z, dx, dz, radius, feetY, headY);
    let px = x, pz = z, rx = natural.x - x, rz = natural.z - z;
    const normals: CollisionNormal[] = [...natural.normals];
    let hit = false;
    const size = this.terrain.blockSize;
    for (let pass = 0; pass < 8; pass++) {
      const minCX = Math.max(0, Math.floor((Math.min(px, px + rx) - radius - this.terrain.originX) / size));
      const maxCX = Math.min(this.terrain.columnsX - 1, Math.floor((Math.max(px, px + rx) + radius - this.terrain.originX) / size));
      const minCZ = Math.max(0, Math.floor((Math.min(pz, pz + rz) - radius - this.terrain.originZ) / size));
      const maxCZ = Math.min(this.terrain.columnsZ - 1, Math.floor((Math.max(pz, pz + rz) + radius - this.terrain.originZ) / size));
      const columns: Rect[] = [];
      for (let cz = minCZ; cz <= maxCZ; cz++) for (let cx = minCX; cx <= maxCX; cx++) {
        const top = this.terrain.topLevel(cx, cz)! * size;
        if (feetY >= top - 1e-7 || headY <= this.terrain.bottomLevel * size) continue;
        const minX = this.terrain.originX + cx * size, minZ = this.terrain.originZ + cz * size;
        columns.push({ minX, maxX: minX + size, minZ, maxZ: minZ + size });
      }
      // Recover from a pre-existing overlap by removing only inward movement.
      // Project several times for corners without creating any positional push.
      for (let projection = 0; projection < 8; projection++) {
        let changed = false;
        for (const column of columns) {
          const normal = overlapNormal(px, pz, radius, column, rx, rz);
          if (!normal) continue;
          hit = true;
          const inward = rx * normal.x + rz * normal.z;
          if (inward < -EPS) {
            rx -= inward * normal.x; rz -= inward * normal.z;
            normals.push(normal); changed = true;
          }
        }
        if (!changed) break;
      }
      // Conflicting initial contacts must not permit an unresolved inward move.
      if (columns.some(column => {
        const normal = overlapNormal(px, pz, radius, column, rx, rz);
        return normal !== null && rx * normal.x + rz * normal.z < -EPS;
      })) return { x: px, z: pz, collided: true, normals, blocked: true };
      let nearest: Hit | null = null;
      for (const column of columns) {
        if (overlapNormal(px, pz, radius, column, rx, rz)) continue;
        const candidate = sweepRect(px, pz, rx, rz, radius, column);
        if (candidate && (!nearest || candidate.time < nearest.time)) nearest = candidate;
      }
      if (!nearest) {
        if (!hit) return natural;
        const finalX = px + rx, finalZ = pz + rz;
        const check = this.natural.moveCircle(x, z, finalX - x, finalZ - z, radius, feetY, headY);
        if (Math.hypot(check.x - finalX, check.z - finalZ) > 1e-7) return { x, z, collided: true, normals, blocked: true };
        return { x: finalX, z: finalZ, collided: true, normals, blocked: natural.blocked };
      }
      hit = true; px += rx * nearest.time; pz += rz * nearest.time;
      normals.push({ x: nearest.x, z: nearest.z });
      rx *= 1 - nearest.time; rz *= 1 - nearest.time;
      const inward = rx * nearest.x + rz * nearest.z;
      if (inward < 0) { rx -= inward * nearest.x; rz -= inward * nearest.z; }
    }
    return { x: px, z: pz, collided: true, normals, blocked: true };
  }
}
