import { TerrainHeightfield, type TerrainQuery } from '../world/terrain/TerrainHeightfield';
import type { Footprint } from './Transform';
import { VoxelTerrain } from '../world/terrain/VoxelTerrain';

interface Point { x: number; z: number }
interface Support { low: number; high: number; slope: number }
/** Clip a polygon against an axis-aligned half-plane. */
function clip(points: Point[], axis: 'x' | 'z', bound: number, greater: boolean): Point[] {
  const result: Point[] = [];
  if (!points.length) return result;
  let prev = points[points.length - 1]!;
  let insidePrev = greater ? prev[axis] >= bound : prev[axis] <= bound;
  for (const current of points) {
    const inside = greater ? current[axis] >= bound : current[axis] <= bound;
    if (inside !== insidePrev) {
      const t = (bound - prev[axis]) / (current[axis] - prev[axis]);
      result.push({ x: prev.x + (current.x - prev.x) * t, z: prev.z + (current.z - prev.z) * t });
    }
    if (inside) result.push(current);
    prev = current; insidePrev = inside;
  }
  return result;
}

/** Exact extrema for voxel columns or the piecewise-triangular heightfield. */
export function terrainSupport(terrain: TerrainQuery, f: Footprint): Support | null {
  if (terrain instanceof VoxelTerrain) {
    const size = terrain.blockSize;
    const imin = Math.max(0, Math.floor((f.minX - terrain.originX) / size));
    const imax = Math.min(terrain.columnsX - 1, Math.ceil((f.maxX - terrain.originX) / size) - 1);
    const jmin = Math.max(0, Math.floor((f.minZ - terrain.originZ) / size));
    const jmax = Math.min(terrain.columnsZ - 1, Math.ceil((f.maxZ - terrain.originZ) / size) - 1);
    let low = Infinity, high = -Infinity;
    for (let j = jmin; j <= jmax; j++) for (let i = imin; i <= imax; i++) {
      const height = terrain.topLevel(i, j)! * size;
      low = Math.min(low, height); high = Math.max(high, height);
    }
    return Number.isFinite(low) && Number.isFinite(high) ? { low, high, slope: 0 } : null;
  }
  if (!(terrain instanceof TerrainHeightfield)) {
    // Generic TerrainQuery implementations provide no triangle topology.
    let low = Infinity, high = -Infinity, slope = 0;
    const nx = 8, nz = 8;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const x = f.minX + (f.maxX - f.minX) * i / nx, z = f.minZ + (f.maxZ - f.minZ) * j / nz;
      const h = terrain.heightAt(x, z), s = terrain.slopeAt(x, z);
      if (!Number.isFinite(h) || !Number.isFinite(s)) return null;
      low = Math.min(low, h); high = Math.max(high, h); slope = Math.max(slope, s);
    }
    return { low, high, slope };
  }
  const cell = terrain.cellSize, ox = terrain.bounds.minX, oz = terrain.bounds.minZ;
  const imin = Math.max(0, Math.floor((f.minX - ox) / cell));
  const imax = Math.min(terrain.resolution - 1, Math.floor((f.maxX - ox) / cell));
  const jmin = Math.max(0, Math.floor((f.minZ - oz) / cell));
  const jmax = Math.min(terrain.resolution - 1, Math.floor((f.maxZ - oz) / cell));
  let low = Infinity, high = -Infinity, slope = 0;
  for (let i = imin; i <= imax; i++) for (let j = jmin; j <= jmax; j++) {
    const x = ox + i * cell, z = oz + j * cell;
    const a = { x, z }, b = { x: x + cell, z }, c = { x, z: z + cell }, d = { x: x + cell, z: z + cell };
    const h00 = terrain.heightAtGrid(i, j), h10 = terrain.heightAtGrid(i + 1, j);
    const h01 = terrain.heightAtGrid(i, j + 1), h11 = terrain.heightAtGrid(i + 1, j + 1);
    const triangles = [
      { points: [a, b, c], dx: (h10 - h00) / cell, dz: (h01 - h00) / cell },
      { points: [b, d, c], dx: (h11 - h01) / cell, dz: (h11 - h10) / cell },
    ];
    for (const tri of triangles) {
      let poly = clip(tri.points, 'x', f.minX, true);
      poly = clip(poly, 'x', f.maxX, false); poly = clip(poly, 'z', f.minZ, true); poly = clip(poly, 'z', f.maxZ, false);
      // Exclude triangles touching only at an edge: they do not support area.
      let area = 0;
      for (let k = 0; k < poly.length; k++) { const p = poly[k]!, q = poly[(k + 1) % poly.length]!; area += p.x * q.z - q.x * p.z; }
      if (Math.abs(area) < 1e-10) continue;
      slope = Math.max(slope, Math.atan(Math.hypot(tri.dx, tri.dz)));
      for (const point of poly) { const h = terrain.heightAt(point.x, point.z); low = Math.min(low, h); high = Math.max(high, h); }
    }
  }
  return [low, high, slope].every(Number.isFinite) ? { low, high, slope } : null;
}
