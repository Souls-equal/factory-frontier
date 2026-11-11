import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { InteractionSystem } from '../../src/interaction/InteractionSystem';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { DepositInteractable, RESOURCE_TYPES } from '../../src/resources/ResourceDeposit';
import { createWorld } from '../../src/world/World';

const config = createGameConfig();
describe('seeded resource deposits', () => {
  it('generates repeatable layouts with all six resource types', () => {
    const first = createWorld(config), second = createWorld(config);
    expect(first.deposits).toEqual(second.deposits);
    expect(first.deposits).toHaveLength(12);
    expect(new Set(first.deposits.map((d) => d.itemId))).toEqual(new Set(RESOURCE_TYPES));
    expect(new Set(first.deposits.map((d) => d.id)).size).toBe(first.deposits.length);
    const other = createWorld(createGameConfig({ world: { seed: 1000 } }));
    expect(other.deposits).not.toEqual(first.deposits);
  });
  it('avoids spawn, other obstacles, and other deposits and sits on the terrain', () => {
    const world = createWorld(config);
    for (const d of world.deposits) {
      expect(world.terrain.contains(d.x, d.z)).toBe(true);
      expect(d.y).toBeCloseTo(world.terrain.heightAt(d.x, d.z), 7);
      expect(Math.hypot(d.x - world.spawn.x, d.z - world.spawn.z)).toBeGreaterThan(4 + d.radius);
      expect(world.obstacleDefinitions.find((o) => o.id === `${d.id}-collider`)).toBeDefined();
      for (const o of world.obstacleDefinitions.filter((o) => !o.id.startsWith('deposit-'))) {
        expect(Math.hypot(d.x - o.x, d.z - o.z)).toBeGreaterThanOrEqual(d.radius + o.radius + 1.3 - 1e-8);
      }
      expect(d.productionMultiplier).toBe(({ impure: 0.5, normal: 1, pure: 2 })[d.purity]);
      expect(d.extractionCompatible).toBe(true);
    }
    const iron = world.deposits.find((d) => d.itemId === 'iron-ore');
    expect(iron).toBeDefined();
    expect(Math.hypot((iron?.x ?? 100) - world.spawn.x, (iron?.z ?? 100) - world.spawn.z)).toBeLessThan(9);
  });
  it('places each default resource for a range of world seeds without overlaps', () => {
    for (let seed = 0; seed < 20; seed++) {
      const world = createWorld(createGameConfig({ world: { seed } }));
      expect(new Set(world.deposits.map((d) => d.itemId))).toEqual(new Set(RESOURCE_TYPES));
      for (let a = 0; a < world.deposits.length; a++) {
        for (let b = a + 1; b < world.deposits.length; b++) {
          const first = world.deposits[a], second = world.deposits[b];
          if (!first || !second) throw new Error('missing deposit');
          expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThanOrEqual(first.radius + second.radius + 1.5 - 1e-8);
        }
      }
    }
  });

  it('keeps placements inside a smaller configured player bound', () => {
    const config = createGameConfig({ controls: { playAreaRadius: 25 } });
    const world = createWorld(config);
    expect(world.deposits.length).toBeGreaterThan(0);
    for (const deposit of world.deposits) {
      expect(Math.hypot(deposit.x, deposit.z) + deposit.radius).toBeLessThan(config.controls.playAreaRadius);
    }
  });
  it('rejects invalid resource configuration', () => {
    expect(() => createGameConfig({ resources: { inventorySlots: 0 } })).toThrow();
    expect(() => createGameConfig({ resources: { gatherQuantity: 0 } })).toThrow();
    expect(() => createGameConfig({ resources: { pureMultiplier: -1 } })).toThrow();
  });
  it('honours configurable count and purity multipliers', () => {
    const custom = createGameConfig({ resources: { depositsPerType: 1, pureMultiplier: 7, normalMultiplier: 3, impureMultiplier: 0.2 } });
    const deposits = createWorld(custom).deposits;
    expect(deposits).toHaveLength(6);
    for (const d of deposits) expect(d.productionMultiplier).toBe(({ impure: 0.2, normal: 3, pure: 7 })[d.purity]);
  });
});

describe('gathering through the existing interaction system', () => {
  it('targets, gathers once per request, reports partial collection and full inventory', () => {
    const deposit = createWorld(config).deposits[0];
    if (!deposit) throw new Error('missing deposit');
    const registry = createDefaultItemRegistry(); const inventory = new Inventory(registry, 1);
    const item = new DepositInteractable(deposit, inventory, registry, 5, 3.6);
    const view = { position: { x: deposit.x, y: deposit.y + 1.1, z: deposit.z + 2 }, yaw: 0, pitch: 0 };
    const interaction = new InteractionSystem({ range: 3.6, viewProvider: () => view });
    interaction.register(item); interaction.fixedUpdate(50);
    expect(interaction.target?.id).toBe(deposit.id);
    expect(interaction.target?.hint).toContain(deposit.purity.toUpperCase());
    interaction.requestInteraction(); interaction.fixedUpdate(50);
    expect(inventory.getItemCount(deposit.itemId)).toBe(5);
    for (let i = 0; i < 20; i++) interaction.fixedUpdate(50);
    expect(inventory.getItemCount(deposit.itemId)).toBe(5);
    inventory.addItem(deposit.itemId, 93);
    interaction.requestInteraction(); interaction.fixedUpdate(50);
    expect(inventory.getItemCount(deposit.itemId)).toBe(100);
    expect(interaction.lastOutcome?.message).toContain('Collected 2');
    interaction.requestInteraction(); interaction.fixedUpdate(50);
    expect(interaction.lastOutcome?.ok).toBe(false);
    expect(interaction.lastOutcome?.message).toContain('Inventory full');
    expect(inventory.getItemCount(deposit.itemId)).toBe(100);
  });
  it('cannot gather when out of range', () => {
    const deposit = createWorld(config).deposits[0]; if (!deposit) throw new Error('missing');
    const registry = createDefaultItemRegistry(); const inventory = new Inventory(registry, 2);
    const interaction = new InteractionSystem({ range: 3.6, viewProvider: () => ({ position: { x: deposit.x, y: deposit.y + 1.1, z: deposit.z + 20 }, yaw: 0, pitch: 0 }) });
    interaction.register(new DepositInteractable(deposit, inventory, registry, 5, 3.6));
    interaction.requestInteraction(); interaction.fixedUpdate(50);
    expect(interaction.target).toBeNull(); expect(inventory.usedSlots).toBe(0);
  });
});
