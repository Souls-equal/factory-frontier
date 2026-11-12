import type { Interactable, InteractionOutcome } from '../interaction/Interactable';
import type { Inventory } from '../items/Inventory';
import { ObstacleField, type CollisionQuery, type MovementResult, type ObstacleDefinition } from '../world/ObstacleField';
import { createRandom } from '../world/rng';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';
import type { ResourceDeposit } from './ResourceDeposit';

export type GatherableKind = 'tree' | 'branch' | 'stone';
export interface GatherableDefinition {
  readonly id: string;
  readonly kind: GatherableKind;
  readonly itemId: 'wood' | 'stone';
  readonly x: number; readonly y: number; readonly z: number;
  readonly radius: number;
  readonly quantity: number;
}

// Starter objects are deliberately east of spawn, away from the first iron
// deposit and its default conveyor route. All are small objects, not blocks.
const STARTERS: readonly { kind: GatherableKind; x: number; z: number }[] = [
  { kind: 'branch', x: 2.5, z: -1 }, { kind: 'stone', x: 2, z: 2 },
  { kind: 'branch', x: 4, z: 2 }, { kind: 'stone', x: 5, z: -2 },
  { kind: 'branch', x: 5, z: -4 }, { kind: 'stone', x: 6, z: 4 },
  { kind: 'branch', x: 7, z: 1 }, { kind: 'stone', x: 8, z: -2 },
  { kind: 'stone', x: 9, z: 5 }, { kind: 'branch', x: 3, z: 5 },
  { kind: 'stone', x: 3, z: 7 }, { kind: 'stone', x: 6, z: 7 },
  { kind: 'stone', x: 11, z: 1 }, { kind: 'tree', x: 10, z: 3 },
  { kind: 'tree', x: 9, z: -5 }, { kind: 'tree', x: 12, z: 7 },
];

/** Seeded bounded layout; rejects collisions and never changes the terrain. */
export function generateGatherables(terrain: TerrainQuery, obstacles: readonly ObstacleDefinition[],
  deposits: readonly ResourceDeposit[], seed: number, spawn: { x: number; z: number }, playAreaRadius: number): readonly GatherableDefinition[] {
  const rng = createRandom(seed ^ 0x2f813bf1);
  const result: GatherableDefinition[] = [];
  for (const [index, starter] of STARTERS.entries()) {
    const radius = starter.kind === 'tree' ? .45 : starter.kind === 'stone' ? .3 : .25;
    for (let attempt = 0; attempt < 32; attempt++) {
      const jitter = attempt === 0 ? .12 : 1.2;
      const x = spawn.x + starter.x + rng.range(-jitter, jitter);
      const z = spawn.z + starter.z + rng.range(-jitter, jitter);
      if (!terrain.contains(x, z) || Math.hypot(x, z) + radius + .5 >= playAreaRadius ||
          Math.hypot(x - spawn.x, z - spawn.z) < 2.3) continue;
      if (obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < radius + o.radius + .8) ||
          deposits.some((d) => Math.hypot(x - d.x, z - d.z) < radius + d.radius + 1.5) ||
          result.some((other) => Math.hypot(x - other.x, z - other.z) < radius + other.radius + .8)) continue;
      result.push(Object.freeze({ id: `gatherable-${starter.kind}-${index}`, kind: starter.kind,
        itemId: starter.kind === 'stone' ? 'stone' : 'wood', x, y: terrain.heightAt(x, z), z, radius,
        quantity: starter.kind === 'tree' ? 20 : 5 }));
      break;
    }
  }
  return Object.freeze(result);
}

/** Mutable finite resource state; visuals and collision query it, never own it. */
export class GatherableField {
  private readonly states = new Map<string, { remaining: number; chops: number }>();
  private revisionValue = 0;
  constructor(readonly definitions: readonly GatherableDefinition[]) {
    for (const d of definitions) {
      if (this.states.has(d.id)) throw new Error(`Duplicate gatherable: ${d.id}`);
      this.states.set(d.id, { remaining: d.quantity, chops: d.kind === 'tree' ? 3 : 0 });
    }
  }
  get revision(): number { return this.revisionValue; }
  remaining(id: string): number { return this.states.get(id)?.remaining ?? 0; }
  active(id: string): boolean { return this.remaining(id) > 0; }
  /** Active shapes for placement validation; loose objects do not block movement. */
  placementObstacles(): readonly ObstacleDefinition[] {
    return this.definitions.filter((d) => this.active(d.id)).map((d) => this.obstacle(d));
  }
  treeObstacles(): readonly ObstacleDefinition[] {
    return this.definitions.filter((d) => d.kind === 'tree' && this.active(d.id)).map((d) => this.obstacle(d));
  }
  private obstacle(d: GatherableDefinition): ObstacleDefinition {
    return { id: d.id, kind: 'prop', x: d.x, y: d.y, z: d.z, radius: d.radius,
      height: d.kind === 'tree' ? 3 : .3, yaw: 0, variant: 0 };
  }
  interactables(inventory: Inventory, range: number): readonly Interactable[] {
    return this.definitions.map((d) => ({
      descriptor: Object.freeze({ id: d.id, displayName: d.kind === 'tree' ? 'Tree' : d.kind === 'branch' ? 'Fallen Branch' : 'Loose Stone',
        hint: d.kind === 'tree' ? 'Chop for wood · 3 presses' : d.kind === 'branch' ? 'Collect wood' : 'Collect stone',
        position: Object.freeze({ x: d.x, y: d.y + (d.kind === 'tree' ? 1.15 : .25), z: d.z }),
        targetRadius: d.kind === 'tree' ? .65 : .4, range }),
      isAvailable: () => this.active(d.id),
      interact: () => this.collect(d, inventory),
    }));
  }
  private collect(d: GatherableDefinition, inventory: Inventory): InteractionOutcome {
    const state = this.states.get(d.id)!;
    if (state.remaining <= 0) return { ok: false, message: 'Already collected.' };
    if (state.chops > 1) {
      state.chops--;
      return { ok: true, message: `Tree: ${state.chops} more ${state.chops === 1 ? 'chop' : 'chops'}.` };
    }
    state.chops = 0;
    const transfer = inventory.addItem(d.itemId, state.remaining);
    state.remaining = transfer.remainder;
    if (!transfer.moved) return { ok: false, message: `Inventory full — ${state.remaining} ${d.itemId} remains.` };
    if (!state.remaining) this.revisionValue++;
    return { ok: true, message: `Collected ${transfer.moved} ${d.itemId}${state.remaining ? ` · ${state.remaining} remains` : ''}.` };
  }
}

/** Rebuild the spatial hash only when a tree disappears. */
export class GatherableCollision implements CollisionQuery {
  private seenRevision = -1;
  private field: ObstacleField;
  constructor(private readonly base: ObstacleField, private readonly gatherables: GatherableField) { this.field = base; }
  moveCircle(x: number, z: number, dx: number, dz: number, radius: number, feetY: number, headY: number): MovementResult {
    if (this.seenRevision !== this.gatherables.revision) {
      this.field = new ObstacleField([...this.base.definitions, ...this.gatherables.treeObstacles()]);
      this.seenRevision = this.gatherables.revision;
    }
    return this.field.moveCircle(x, z, dx, dz, radius, feetY, headY);
  }
}
