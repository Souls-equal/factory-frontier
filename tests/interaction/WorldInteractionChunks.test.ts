import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import type { CameraView } from '../../src/engine/types';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { DepositInteractable } from '../../src/resources/ResourceDeposit';
import { createWorld } from '../../src/world/World';
import { InteractionSystem } from '../../src/interaction/InteractionSystem';
import { createWorldInteractables } from '../../src/interaction/WorldInteractables';
import { WorldInteractionChunks } from '../../src/interaction/WorldInteractionChunks';

const config = createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } });
const range = 3.6;
function setup() {
  const inventory = new Inventory(createDefaultItemRegistry(), 24), world = createWorld(config, inventory);
  let view: CameraView = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 };
  const interaction = new InteractionSystem({ range, viewProvider: () => view });
  const stream = new WorldInteractionChunks(world, interaction, inventory, range, 8);
  const move = (x: number, y: number, z: number, yaw = 0) => {
    view = { position: { x, y, z }, yaw, pitch: 0 }; stream.update(x, z);
  };
  const use = () => { interaction.requestInteraction(); interaction.fixedUpdate(50); return interaction.lastOutcome; };
  return { world, inventory, interaction, stream, move, use, view: () => view };
}

describe('world interactions by chunk', () => {
  it('matches a fully registered interaction system across object and chunk boundaries', () => {
    const s = setup(), baseline = new InteractionSystem({ range, viewProvider: s.view });
    const entries = [
      ...createWorldInteractables(s.world.interactables),
      ...s.world.deposits.map(d => new DepositInteractable(d, s.inventory.registry, range,
        () => !s.world.buildings.all().some(b => b.depositId === d.id), s.world.biomes.at(d.x, d.z))),
      ...s.world.gatherables.interactables(s.inventory, range),
    ];
    for (const entry of entries) baseline.register(entry);
    // Visit targets in alternating order and approach from all four directions.
    for (const entry of [...entries.slice().reverse(), ...entries]) {
      const p = entry.descriptor.position;
      for (const distance of [.01, 3.5, 4.2]) for (const [dx, dz, yaw] of [[distance, 0, Math.PI / 2], [-distance, 0, -Math.PI / 2], [0, distance, 0], [0, -distance, Math.PI]]) {
        s.move(p.x + dx!, p.y, p.z + dz!, yaw!);
        expect(s.interaction.refreshTarget()).toEqual(baseline.refreshTarget());
      }
    }
    s.move(-39, 0, -39);
    expect(s.interaction.size).toBeLessThan(entries.length);
    s.stream.dispose(); expect(s.interaction.size).toBe(0);
    s.stream.dispose();
  });

  it('retains partial tree chops and prop state through unload, return and collection', () => {
    const s = setup(), tree = s.world.gatherables.definitions.find(d => d.kind === 'tree')!;
    s.move(tree.x, tree.y + 1.15, tree.z);
    expect(s.interaction.refreshTarget()?.id).toBe(tree.id);
    expect(s.use()?.message).toContain('2 more');
    s.move(-39, 0, -39); s.move(tree.x, tree.y + 1.15, tree.z);
    expect(s.use()?.message).toContain('1 more');
    s.move(-39, 0, -39); s.move(tree.x, tree.y + 1.15, tree.z);
    expect(s.use()?.message).toContain('Collected 20');
    expect(s.world.gatherables.active(tree.id)).toBe(false);
    s.move(-39, 0, -39); s.move(tree.x, tree.y + 1.15, tree.z);
    expect(s.interaction.refreshTarget()?.id).not.toBe(tree.id);
    const beacon = s.world.interactables.find(d => d.kind === 'survey-beacon')!;
    s.move(beacon.x, beacon.y, beacon.z); expect(s.use()?.message).toContain('ping #1');
    s.move(39, 0, 39); s.move(beacon.x, beacon.y, beacon.z);
    expect(s.use()?.message).toContain('ping #2');
  });

  it('reflects a miner placed on a deposit while its interaction adapter is unloaded', () => {
    const s = setup(), deposit = s.world.deposits.find(d => d.itemId === 'iron-ore')!;
    s.move(deposit.x, deposit.y + 1.1, deposit.z);
    expect(s.interaction.refreshTarget()?.id).toBe(deposit.id);
    s.move(39, 0, -39);
    s.world.buildings.setCreativeMode(true);
    const placed = s.world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, { x: 1000, z: 1000, radius: .4 });
    expect(placed.reason).toBe('valid');
    s.move(deposit.x, deposit.y + 1.1, deposit.z);
    expect(s.interaction.refreshTarget()?.id).not.toBe(deposit.id);
  });

  it('does not unregister unrelated interactions and can retry after registration conflicts', () => {
    const s = setup(), beacon = s.world.interactables[0]!;
    const external = { descriptor: { id: beacon.id, displayName: 'other', hint: '', position: {x: 0, y: 0, z: 0}, targetRadius: 1, range },
      isAvailable: () => true, interact: () => ({ ok: true, message: 'other' }) };
    const remove = s.interaction.register(external);
    expect(() => s.move(beacon.x, beacon.y, beacon.z)).toThrow(/already registered/);
    expect(s.interaction.size).toBe(1);
    remove();
    s.move(beacon.x, beacon.y, beacon.z); expect(s.interaction.size).toBeGreaterThan(0);
    const count = s.interaction.size;
    remove(); expect(s.interaction.size).toBe(count);
    s.stream.dispose(); expect(s.interaction.size).toBe(0);
  });
});
