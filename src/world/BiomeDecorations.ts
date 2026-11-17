import type { World } from './World';
import { hash2D } from './noise';

/** Presentation-only procedural data; never a collider or resource. */
export type DecorationKind = 'meadow' | 'flower' | 'fern' | 'scrub' | 'alpine' | 'reeds';
export interface Decoration {
  readonly x: number; readonly y: number; readonly z: number;
  readonly yaw: number; readonly scale: number; readonly tint: number;
}
export interface DecorationCandidate {
  readonly kind: DecorationKind; readonly gx: number; readonly gz: number;
  readonly x: number; readonly z: number; readonly priority: number;
}
export interface DecorationBounds { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
const CAP = 2200;
const SPACING = 3;
const JITTER = SPACING * .275;
const compare = (a: DecorationCandidate, b: DecorationCandidate): number =>
  a.priority - b.priority || a.gz - b.gz || a.gx - b.gx;

/**
 * Recreate cosmetic records per half-open region, keeping the original global
 * priority cap. Only a cutoff key is retained, never the selected world records.
 */
export class BiomeDecorationField {
  private readonly radius: number;
  private readonly minX: number; private readonly maxX: number;
  private readonly minZ: number; private readonly maxZ: number;
  private readonly cutoff: DecorationCandidate | undefined;

  constructor(private readonly world: World) {
    const bounds = world.terrain.bounds;
    this.radius = Math.min(world.playAreaRadius, 150);
    this.minX = Math.ceil(Math.max(bounds.minX + 1, -this.radius) / SPACING);
    this.maxX = Math.floor(Math.min(bounds.maxX - 1, this.radius) / SPACING);
    this.minZ = Math.ceil(Math.max(bounds.minZ + 1, -this.radius) / SPACING);
    this.maxZ = Math.floor(Math.min(bounds.maxZ - 1, this.radius) / SPACING);
    const candidates: DecorationCandidate[] = [];
    for (let gz = this.minZ; gz <= this.maxZ; gz++) for (let gx = this.minX; gx <= this.maxX; gx++) {
      const candidate = this.candidate(gx, gz); if (candidate) candidates.push(candidate);
    }
    // Stable tie order matches the previous row-major stable priority sort.
    if (candidates.length > CAP) { candidates.sort(compare); this.cutoff = candidates[CAP - 1]; }
  }

  /** Returns stable priority-sorted records whose centres are inside the region. */
  inBounds(bounds: DecorationBounds): readonly { readonly kind: DecorationKind; readonly decoration: Decoration }[] {
    if (![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite) ||
        bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ) throw new RangeError('Invalid decoration bounds.');
    const minX = Math.max(this.minX, Math.ceil((bounds.minX - JITTER) / SPACING));
    const maxX = Math.min(this.maxX, Math.floor((bounds.maxX + JITTER) / SPACING));
    const minZ = Math.max(this.minZ, Math.ceil((bounds.minZ - JITTER) / SPACING));
    const maxZ = Math.min(this.maxZ, Math.floor((bounds.maxZ + JITTER) / SPACING));
    const candidates: DecorationCandidate[] = [];
    for (let gz = minZ; gz <= maxZ; gz++) for (let gx = minX; gx <= maxX; gx++) {
      const c = this.candidate(gx, gz);
      if (!c || c.x < bounds.minX || c.x >= bounds.maxX || c.z < bounds.minZ || c.z >= bounds.maxZ ||
          (this.cutoff && compare(c, this.cutoff) > 0)) continue;
      candidates.push(c);
    }
    candidates.sort(compare);
    return candidates.map(({ kind, gx, gz, x, z }) => {
      const rand = (salt: number) => hash2D(this.world.biomes.seed ^ salt, gx, gz);
      return { kind, decoration: { x, z, y: this.world.terrain.heightAt(x, z) + .01,
        yaw: rand(203) * Math.PI * 2, scale: .75 + rand(307) * .5,
        tint: kind === 'flower' ? [0xffffff, 0xffd9b3, 0xbcdcff][Math.floor(rand(409) * 3)]! : 0xffffff } };
    });
  }

  private candidate(gx: number, gz: number): DecorationCandidate | null {
    const world = this.world, rand = (salt: number) => hash2D(world.biomes.seed ^ salt, gx, gz);
    const x = (gx + (rand(11) - .5) * .55) * SPACING, z = (gz + (rand(31) - .5) * .55) * SPACING;
    if (Math.hypot(x, z) > this.radius - 1 || Math.hypot(x - world.spawn.x, z - world.spawn.z) < 3) return null;
    const biome = world.biomes.at(x, z), chance = rand(101);
    const kind: DecorationKind | null = biome === 'wetlands' ? (chance < .42 ? 'reeds' : chance < .49 ? 'flower' : null)
      : biome === 'forest' ? (chance < .38 ? 'fern' : chance < .48 ? 'flower' : null)
      : biome === 'desert' ? (chance < .16 ? 'scrub' : null)
      : biome === 'highlands' ? (chance < .23 ? 'alpine' : null)
      : chance < .22 ? 'meadow' : chance < .32 ? 'flower' : null;
    if (!kind || world.obstacleDefinitions.some(o => Math.hypot(o.x - x, o.z - z) < o.radius + .65) ||
        world.gatherables.definitions.some(o => Math.hypot(o.x - x, o.z - z) < o.radius + .7)) return null;
    return { kind, gx, gz, x, z, priority: rand(503) };
  }
}
