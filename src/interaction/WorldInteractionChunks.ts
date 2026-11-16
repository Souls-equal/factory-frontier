import type { Inventory } from '../items/Inventory';
import { DepositInteractable } from '../resources/ResourceDeposit';
import { ChunkManager } from '../world/ChunkManager';
import type { World } from '../world/World';
import type { Interactable } from './Interactable';
import { InteractionSystem } from './InteractionSystem';
import { createWorldInteractables } from './WorldInteractables';

/**
 * Stream static-world interaction adapters near the authoritative player.
 * Resource state, prop state, building state and collisions are NOT owned here.
 * Factory and moving-item interactions are registered separately.
 */
export class WorldInteractionChunks {
  private readonly chunks: ChunkManager;
  private readonly registered = new Map<string, readonly (() => void)[]>();
  private readonly props: ReadonlyMap<string, Interactable>;
  private readonly coverage: number;

  constructor(private readonly world: World, private readonly interaction: InteractionSystem,
    private readonly inventory: Inventory, private readonly range: number, chunkColumns = 16) {
    if (!Number.isFinite(range) || range <= 0) throw new RangeError('Invalid interaction range.');
    this.chunks = new ChunkManager(world, chunkColumns);
    // Unlike resource adapters, the two props contain mutable interaction state.
    this.props = new Map(createWorldInteractables(world.interactables).map(prop => [prop.descriptor.id, prop]));
    const largestRadius = Math.max(1.1, .65, ...world.interactables.map(prop => prop.targetRadius));
    this.coverage = range + largestRadius;
  }

  update(x: number, z: number): void {
    const changes = this.chunks.update(x, z, this.coverage);
    for (const chunk of changes.unloaded) {
      for (const unregister of this.registered.get(chunk.id) ?? []) unregister();
      this.registered.delete(chunk.id);
    }
    try {
      for (const chunk of changes.loaded) {
        const entries: Interactable[] = chunk.interactables.map(definition => this.props.get(definition.id)!);
        for (const deposit of chunk.deposits) entries.push(new DepositInteractable(deposit, this.inventory.registry, this.range,
          () => !this.world.buildings.all().some(building => building.depositId === deposit.id), this.world.biomes.at(deposit.x, deposit.z)));
        entries.push(...this.world.gatherables.interactables(this.inventory, this.range, chunk.gatherables));
        const unregister: Array<() => void> = [];
        try {
          for (const entry of entries) unregister.push(this.interaction.register(entry));
        } catch (error) {
          for (const remove of unregister) remove();
          throw error;
        }
        this.registered.set(chunk.id, unregister);
      }
    } catch (error) {
      // Reset the lifecycle so an id conflict can be corrected and retried.
      this.dispose();
      throw error;
    }
  }

  dispose(): void {
    for (const entries of this.registered.values()) for (const unregister of entries) unregister();
    this.registered.clear(); this.chunks.clear();
  }
}
