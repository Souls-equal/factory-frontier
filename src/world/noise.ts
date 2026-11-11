/**
 * Deterministic procedural noise.
 *
 * Phase 1 only needs smooth, reproducible terrain: a seeded value-noise
 * field with fractal octave summation is enough and avoids a dependency.
 * Everything here is pure maths — no DOM, no Three.js, no allocation in the
 * sampling path — so terrain generation is testable and safe to run in Node.
 */

/** 32-bit integer hash of a lattice coordinate and seed (returns 0..1). */
export function hash2D(seed: number, x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smoothstep easing used by both noise interpolation and terrain shaping. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }
  const t = clampUnit((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clampUnit(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Value noise in the range 0..1.
 *
 * `period` (in lattice cells) makes the field tile, which keeps the finite
 * exploration area seamless if it is ever wrapped into chunks.
 */
export function valueNoise2D(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  const v00 = hash2D(seed, x0, y0);
  const v10 = hash2D(seed, x0 + 1, y0);
  const v01 = hash2D(seed, x0, y0 + 1);
  const v11 = hash2D(seed, x0 + 1, y0 + 1);

  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const top = v00 + (v10 - v00) * sx;
  const bottom = v01 + (v11 - v01) * sx;
  return top + (bottom - top) * sy;
}

export interface FractalNoiseOptions {
  /** Number of summed octaves. */
  readonly octaves: number;
  /** Frequency of the first octave (cycles per world unit). */
  readonly frequency: number;
  /** Amplitude multiplier between octaves. */
  readonly persistence: number;
  /** Frequency multiplier between octaves. */
  readonly lacunarity: number;
}

/**
 * Fractal Brownian motion built on {@link valueNoise2D}.
 *
 * The result is normalized to roughly 0..1 regardless of octave count, which
 * keeps terrain shaping parameters stable when the octave count changes.
 */
export function fractalNoise2D(
  seed: number,
  x: number,
  y: number,
  options: FractalNoiseOptions,
): number {
  let frequency = options.frequency;
  let amplitude = 1;
  let sum = 0;
  let normalization = 0;

  for (let octave = 0; octave < options.octaves; octave += 1) {
    // Each octave uses its own seed so octaves do not align on shared lattice points.
    sum += valueNoise2D(seed + octave * 1013, x * frequency, y * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= options.persistence;
    frequency *= options.lacunarity;
  }

  return normalization === 0 ? 0 : sum / normalization;
}
