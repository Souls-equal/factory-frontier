/**
 * Immutable, finite column voxel terrain. Levels denote the exclusive top of a
 * solid column; there are no caves, overhangs or terrain edits. This module is
 * deliberately Three-free, and is not yet connected to the playable world.
 */
export interface VoxelTerrainOptions {
  readonly originX: number;
  readonly originZ: number;
  readonly columnsX: number;
  readonly columnsZ: number;
  readonly blockSize: number;
  /** Inclusive bottom block level. */
  readonly bottomLevel: number;
  /** Sampled at each column centre. Equal inputs must return equal heights. */
  readonly sampleHeight: (x: number, z: number) => number;
}

export interface VoxelSurfaceData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly faceCount: number;
}

export class VoxelTerrain {
  readonly originX: number;
  readonly originZ: number;
  readonly columnsX: number;
  readonly columnsZ: number;
  readonly blockSize: number;
  readonly bottomLevel: number;
  private readonly levels: Int32Array;

  constructor(options: VoxelTerrainOptions) {
    const { originX, originZ, columnsX, columnsZ, blockSize, bottomLevel, sampleHeight } = options;
    if (![originX, originZ, blockSize].every(Number.isFinite) || blockSize <= 0 ||
        !Number.isSafeInteger(columnsX) || columnsX < 1 || columnsX > 512 ||
        !Number.isSafeInteger(columnsZ) || columnsZ < 1 || columnsZ > 512 ||
        !Number.isSafeInteger(bottomLevel) || bottomLevel < -32768 || bottomLevel > 32767 ||
        typeof sampleHeight !== 'function') {
      throw new RangeError('Invalid voxel terrain options.');
    }
    this.originX = originX; this.originZ = originZ;
    this.columnsX = columnsX; this.columnsZ = columnsZ;
    this.blockSize = blockSize; this.bottomLevel = bottomLevel;
    this.levels = new Int32Array(columnsX * columnsZ);
    for (let z = 0; z < columnsZ; z++) for (let x = 0; x < columnsX; x++) {
      const height = sampleHeight(originX + (x + .5) * blockSize, originZ + (z + .5) * blockSize);
      const level = Math.round(height / blockSize);
      // Bounding the vertical range also bounds worst-case mesh allocation.
      if (!Number.isFinite(height) || !Number.isSafeInteger(level) || level <= bottomLevel || level - bottomLevel > 512) {
        throw new RangeError('Voxel column height is outside the supported range.');
      }
      this.levels[z * columnsX + x] = level;
    }
  }

  /** Exclusive upper block level, or null when outside the finite terrain. */
  topLevel(x: number, z: number): number | null {
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= this.columnsX || z >= this.columnsZ) return null;
    return this.levels[z * this.columnsX + x]!;
  }

  /** Occupancy in integer column/level coordinates, including the bottom. */
  isSolid(x: number, y: number, z: number): boolean {
    const top = this.topLevel(x, z);
    return top !== null && Number.isInteger(y) && y >= this.bottomLevel && y < top;
  }

  /** Column under a world-space point; maximum bounds are exclusive. */
  columnAt(x: number, z: number): { readonly x: number; readonly z: number } | null {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const cx = Math.floor((x - this.originX) / this.blockSize);
    const cz = Math.floor((z - this.originZ) / this.blockSize);
    return this.topLevel(cx, cz) === null ? null : { x: cx, z: cz };
  }

  /** Visible top and side quads only. No bottom is rendered in this finite prototype. */
  getSurfaceData(): VoxelSurfaceData {
    // Count first: reject pathological checkerboards before allocating huge arrays.
    let totalFaces = this.columnsX * this.columnsZ;
    for (let z = 0; z < this.columnsZ; z++) for (let x = 0; x < this.columnsX; x++) {
      const top = this.topLevel(x, z)!;
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        totalFaces += Math.max(0, top - (this.topLevel(x + dx, z + dz) ?? this.bottomLevel));
      }
    }
    if (totalFaces > 500_000) throw new RangeError('Voxel surface exceeds the finite prototype mesh limit.');
    const positions = new Float32Array(totalFaces * 12), normals = new Float32Array(totalFaces * 12);
    const indices = new Uint32Array(totalFaces * 6);
    let faceCount = 0;
    const quad = (points: readonly number[], nx: number, ny: number, nz: number): void => {
      positions.set(points, faceCount * 12);
      for (let i = 0; i < 4; i++) normals.set([nx, ny, nz], faceCount * 12 + i * 3);
      const offset = faceCount * 4;
      indices.set([offset, offset + 1, offset + 2, offset, offset + 2, offset + 3], faceCount * 6);
      faceCount++;
    };
    const size = this.blockSize;
    for (let z = 0; z < this.columnsZ; z++) for (let x = 0; x < this.columnsX; x++) {
      const top = this.topLevel(x, z)!;
      const x0 = this.originX + x * size, x1 = x0 + size;
      const z0 = this.originZ + z * size, z1 = z0 + size, y = top * size;
      quad([x0,y,z0, x0,y,z1, x1,y,z1, x1,y,z0], 0,1,0);
      const sides = [
        { dx: -1, dz: 0, nx: -1, nz: 0 }, { dx: 1, dz: 0, nx: 1, nz: 0 },
        { dx: 0, dz: -1, nx: 0, nz: -1 }, { dx: 0, dz: 1, nx: 0, nz: 1 },
      ];
      for (const side of sides) {
        const neighbor = this.topLevel(x + side.dx, z + side.dz) ?? this.bottomLevel;
        for (let level = Math.max(neighbor, this.bottomLevel); level < top; level++) {
          const y0 = level * size, y1 = y0 + size;
          if (side.nx === -1) quad([x0,y0,z1, x0,y1,z1, x0,y1,z0, x0,y0,z0], -1,0,0);
          else if (side.nx === 1) quad([x1,y0,z0, x1,y1,z0, x1,y1,z1, x1,y0,z1], 1,0,0);
          else if (side.nz === -1) quad([x0,y0,z0, x0,y1,z0, x1,y1,z0, x1,y0,z0], 0,0,-1);
          else quad([x1,y0,z1, x1,y1,z1, x0,y1,z1, x0,y0,z1], 0,0,1);
        }
      }
    }
    return { positions, normals, indices, faceCount };
  }
}
