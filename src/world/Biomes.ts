import { valueNoise2D } from './noise';

export type Biome = 'grassland' | 'forest' | 'desert' | 'highlands';
export const BIOME_LABELS: Readonly<Record<Biome, string>> = Object.freeze({
  grassland: 'Grassland', forest: 'Forest', desert: 'Desert', highlands: 'Highlands',
});

/** Deterministic, coordinate-based regions; independent of visit or generation order. */
export class BiomeField {
  constructor(readonly seed: number, private readonly spawn: { readonly x: number; readonly z: number }) {}

  at(x: number, z: number): Biome {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('Biome coordinates must be finite.');
    // Keep the starting clearing readable and its starter resources predictable.
    if (Math.hypot(x - this.spawn.x, z - this.spawn.z) < 24) return 'grassland';
    const moisture = valueNoise2D(this.seed ^ 0x642c57, x / 42, z / 42);
    const ruggedness = valueNoise2D(this.seed ^ 0x1e63a1, x / 48, z / 48);
    if (ruggedness > .68) return 'highlands';
    if (moisture < .37) return 'desert';
    if (moisture > .61) return 'forest';
    return 'grassland';
  }
}
