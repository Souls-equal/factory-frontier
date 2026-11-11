/**
 * Small deterministic pseudo-random generator (mulberry32).
 *
 * World generation must be reproducible from a seed (§4.1), so gameplay code
 * never calls `Math.random()`. The generator is intentionally tiny and stable:
 * the same seed produces the same sequence on every platform.
 */
export interface RandomSource {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
  /** Uniformly chosen element. */
  pick<T>(items: readonly T[]): T;
}

export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty list.');
      }
      // Length is checked above; the cast only satisfies the index signature.
      return items[Math.floor(next() * items.length) % items.length] as T;
    },
  };
}
