import type { Biome, BiomeField } from '../world/Biomes';
import type { ObstacleDefinition } from '../world/ObstacleField';
import { createRandom } from '../world/rng';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';
import type { ResourceDeposit } from './ResourceDeposit';

/** Preferred destinations, not exclusive spawning rules. Baseline deposits
 * remain where they were; there is a bounded fallback when no site is viable. */
export const DEPOSIT_BIOME_PREFERENCES: Readonly<Record<string, readonly Biome[]>> = Object.freeze({
  'iron-ore': Object.freeze(['highlands'] as const),
  'copper-ore': Object.freeze(['desert'] as const),
  limestone: Object.freeze(['desert'] as const),
  coal: Object.freeze(['highlands', 'forest'] as const),
  stone: Object.freeze(['highlands'] as const),
  wood: Object.freeze(['forest'] as const),
});

function stableSeed(seed: number, id: string): number {
  let hash = seed ^ 0x1b534d27;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  return hash;
}

/** Relocate only secondary deposits. All candidates are checked against the
 * current complete set, so an unsuccessful search leaves the original intact. */
export function distributeBiomeDeposits(
  baseline: readonly ResourceDeposit[], terrain: TerrainQuery, obstacles: readonly ObstacleDefinition[],
  biomes: Pick<BiomeField, 'at'>, seed: number, spawn: { readonly x: number; readonly z: number },
  playAreaRadius: number, suitable: (x: number, z: number) => boolean,
): readonly ResourceDeposit[] {
  const result = [...baseline];
  const protectedTypes = new Set<string>();
  const reachableRadius = Math.min(terrain.size * .43, playAreaRadius - 2.8);
  for (let index = 0; index < result.length; index++) {
    const deposit = result[index]!;
    if (!protectedTypes.has(deposit.itemId)) { protectedTypes.add(deposit.itemId); continue; }
    const preferred = DEPOSIT_BIOME_PREFERENCES[deposit.itemId];
    if (!preferred || reachableRadius <= 30) continue;
    const random = createRandom(stableSeed(seed, deposit.id));
    for (let attempt = 0; attempt < 320; attempt++) {
      // Uniform area sample using a separate stream for each deposit identity.
      const radius = Math.sqrt(random.next()) * reachableRadius, angle = random.next() * 2 * Math.PI;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (Math.hypot(x - spawn.x, z - spawn.z) < 30 || !terrain.contains(x, z) ||
          !preferred.includes(biomes.at(x, z)) || terrain.slopeAt(x, z) > .58) continue;
      if (obstacles.some(o => Math.hypot(x - o.x, z - o.z) < deposit.radius + o.radius + 1.3) ||
          result.some((d, i) => i !== index && Math.hypot(x - d.x, z - d.z) < deposit.radius + d.radius + 1.5)) continue;
      if (!suitable(x, z)) continue;
      result[index] = Object.freeze({ ...deposit, x, y: terrain.heightAt(x, z), z });
      break;
    }
  }
  return Object.freeze(result);
}
