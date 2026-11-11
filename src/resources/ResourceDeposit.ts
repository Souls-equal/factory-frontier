import type { ResourceConfig } from '../core/Configuration';
import type { Interactable, InteractionOutcome } from '../interaction/Interactable';
import type { Inventory } from '../items/Inventory';
import type { ItemRegistry } from '../items/ItemRegistry';
import type { ObstacleDefinition } from '../world/ObstacleField';
import { createRandom } from '../world/rng';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';

export type Purity = 'impure' | 'normal' | 'pure';
export interface ResourceDeposit {
  readonly id: string;
  readonly itemId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  readonly purity: Purity;
  /** Stored for future extraction; manual gathering is unaffected. */
  readonly productionMultiplier: number;
  readonly extractionCompatible: boolean;
}

export const RESOURCE_TYPES = ['iron-ore', 'copper-ore', 'limestone', 'coal', 'stone', 'wood'] as const;

/** Seeded clusters near the clearing and in distinct exploration directions. */
export function generateDeposits(terrain: TerrainQuery, obstacles: readonly ObstacleDefinition[],
  seed: number, spawn: { x: number; z: number }, settings: ResourceConfig, playAreaRadius: number): readonly ResourceDeposit[] {
  const random = createRandom(seed ^ 0x48b32f17);
  const deposits: ResourceDeposit[] = [];
  const radius = 0.8;
  const reachableRadius = Math.min(terrain.size * 0.43, playAreaRadius - radius - 2);
  const worldRadius = Math.min(45, terrain.size * 0.24, Math.max(0, reachableRadius - 5));
  RESOURCE_TYPES.forEach((itemId, type) => {
    // The first iron deposit is close to spawn; later types form radial clusters.
    const angle = (type / RESOURCE_TYPES.length) * Math.PI * 2 + random.range(-0.22, 0.22);
    const centreX = type === 0 ? spawn.x - 7 : Math.cos(angle) * worldRadius;
    const centreZ = type === 0 ? spawn.z + 1 : Math.sin(angle) * worldRadius;
    for (let index = 0; index < settings.depositsPerType; index++) {
      for (let attempt = 0; attempt < 160; attempt++) {
        const jitter = type === 0 && index === 0 ? 1 : 5 + Math.floor(attempt / 20) * 2;
        const x = centreX + random.range(-jitter, jitter);
        const z = centreZ + random.range(-jitter, jitter);
        if (!terrain.contains(x, z) || Math.hypot(x, z) > reachableRadius) continue;
        if (Math.hypot(x - spawn.x, z - spawn.z) < 4 + radius || terrain.slopeAt(x, z) > 0.58) continue;
        if (obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < radius + o.radius + 1.3)) continue;
        if (deposits.some((d) => Math.hypot(x - d.x, z - d.z) < radius + d.radius + 1.5)) continue;
        const purity = random.pick<Purity>(['impure', 'normal', 'pure']);
        const multiplier = purity === 'pure' ? settings.pureMultiplier : purity === 'impure' ? settings.impureMultiplier : settings.normalMultiplier;
        deposits.push(Object.freeze({ id: `deposit-${itemId}-${index}`, itemId, x, z, y: terrain.heightAt(x, z), radius,
          purity, productionMultiplier: multiplier, extractionCompatible: true }));
        break;
      }
    }
  });
  return Object.freeze(deposits);
}

/** Adapter to the existing interaction registry; deposit data remains renderer-free. */
export class DepositInteractable implements Interactable {
  readonly descriptor;
  constructor(readonly deposit: ResourceDeposit, private readonly inventory: Inventory,
    registry: ItemRegistry, private readonly gatherQuantity: number, range: number) {
    const item = registry.get(deposit.itemId);
    this.descriptor = Object.freeze({ id: deposit.id, displayName: `${item.name} Deposit`,
      hint: `Purity: ${deposit.purity.toUpperCase()} · Gather`,
      position: Object.freeze({ x: deposit.x, y: deposit.y + 1.1, z: deposit.z }), targetRadius: 1.1, range });
  }
  isAvailable(): boolean { return true; }
  interact(): InteractionOutcome {
    const result = this.inventory.addItem(this.deposit.itemId, this.gatherQuantity);
    const name = this.inventory.registry.get(this.deposit.itemId).name;
    return result.moved === 0
      ? { ok: false, message: `Inventory full — could not collect ${name}.` }
      : { ok: true, message: `Collected ${result.moved} ${name}${result.remainder ? ' (inventory full)' : ''}.` };
  }
}
