import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { GatherableField, GatherableCollision, type GatherableDefinition } from '../../src/resources/Gatherables';
import { ObstacleField } from '../../src/world/ObstacleField';
import { EnvironmentView } from '../../src/engine/EnvironmentView';
import { MachineManager } from '../../src/machines/MachineManager';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';

const items = createDefaultItemRegistry();
const tree: GatherableDefinition = { id: 'tree', kind: 'tree', itemId: 'wood', x: 0, y: 0, z: 0, radius: .45, quantity: 20 };
const stone: GatherableDefinition = { id: 'stone', kind: 'stone', itemId: 'stone', x: 0, y: 0, z: 0, radius: .3, quantity: 5 };

describe('starter resources', () => {
  it('generates deterministic, distinct, unobstructed starter resources in representative worlds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const config = createGameConfig({ world: { seed } });
      const world = createWorld(config), definitions = world.gatherables.definitions;
      expect(definitions).toEqual(createWorld(config).gatherables.definitions);
      expect(new Set(definitions.map((d) => d.id)).size).toBe(definitions.length);
      expect(definitions.filter((d) => d.kind === 'tree').length).toBeGreaterThanOrEqual(5);
      expect(definitions.filter((d) => d.kind === 'stone').length).toBeGreaterThanOrEqual(10);
      expect(definitions.filter((d) => d.itemId === 'wood').reduce((n, d) => n + d.quantity, 0)).toBeGreaterThanOrEqual(20);
      expect(definitions.filter((d) => d.itemId === 'stone').reduce((n, d) => n + d.quantity, 0)).toBeGreaterThanOrEqual(30);
      for (const d of definitions) {
        expect(d.y).toBe(world.terrain.heightAt(d.x, d.z));
        expect(Math.hypot(d.x, d.z)).toBeLessThan(config.controls.playAreaRadius);
        for (const o of world.obstacleDefinitions) expect(Math.hypot(d.x - o.x, d.z - o.z)).toBeGreaterThanOrEqual(d.radius + o.radius + .8 - 1e-8);
        for (const other of definitions.filter((v) => v !== d)) expect(Math.hypot(d.x - other.x, d.z - other.z)).toBeGreaterThanOrEqual(d.radius + other.radius + .8 - 1e-8);
      }
    }
    expect(createWorld(createGameConfig({ world: { seed: 1 } })).gatherables.definitions).not.toEqual(createWorld(createGameConfig({ world: { seed: 2 } })).gatherables.definitions);
  }, 15000);
  it('preserves partial and full inventory remainder and removes the target only when empty', () => {
    const field = new GatherableField([stone]), inventory = new Inventory(items, 3);
    inventory.addItem('stone', 197); inventory.removeItem('stone', 1); inventory.addItem('coal', 100);
    const object = field.interactables(inventory, 3.6)[0]!;
    expect(object.interact().message).toContain('Collected 4'); expect(field.remaining(stone.id)).toBe(1);
    expect(object.isAvailable()).toBe(true); expect(object.interact().ok).toBe(false); expect(field.remaining(stone.id)).toBe(1);
    inventory.removeItem('stone', 1); expect(object.interact().message).toContain('Collected 1');
    expect(field.remaining(stone.id)).toBe(0); expect(object.isAvailable()).toBe(false); expect(object.interact().ok).toBe(false);
    expect(inventory.getItemCount('stone')).toBe(200); expect(inventory.getItemCount('coal')).toBe(100);
  });
  it('keeps a felled tree solid and visible while inventory is full, then removes its collision after collection', () => {
    const field = new GatherableField([tree]), inventory = new Inventory(items, 1); inventory.addItem('coal', 100);
    const object = field.interactables(inventory, 3.6)[0]!;
    const collision = new GatherableCollision(new ObstacleField([]), field);
    const move = () => collision.moveCircle(-2, 0, 4, 0, .3, 0, 1.8);
    expect(move().x).toBeLessThan(0); expect(object.interact().message).toContain('2 more');
    expect(object.interact().message).toContain('1 more'); expect(object.interact().ok).toBe(false);
    expect(field.remaining(tree.id)).toBe(20); expect(field.placementObstacles()).toHaveLength(1); expect(move().x).toBeLessThan(0);
    inventory.removeItem('coal', 100); expect(object.interact().ok).toBe(true);
    expect(field.placementObstacles()).toHaveLength(0); expect(move().x).toBeCloseTo(2);
  });
  it('blocks placement while a loose object exists and clears it after pickup', () => {
    const terrain: TerrainQuery = { bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, size: 40, resolution: 20, cellSize: 2,
      contains: (x, z) => Math.abs(x) <= 20 && Math.abs(z) <= 20, clampXZ: (x, z) => ({ x, z }),
      heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
    const inventory = new Inventory(items, 5); inventory.addItem('stone', 10); inventory.addItem('wood', 5);
    const field = new GatherableField([stone]);
    const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 19, [], () => field.placementObstacles());
    const player = { x: 8, z: 8, radius: .4 };
    expect(buildings.validate('foundation', 0, 0, 0, player).reason).toBe('occupied space');
    field.interactables(inventory, 3.6)[0]!.interact();
    expect(buildings.place('foundation', 0, 0, 0, player).reason).toBe('valid');
  });
  it('syncs the scene graph with collection without disposing shared geometry early', () => {
    const world = createWorld(createGameConfig()), view = new EnvironmentView(world);
    const d = world.gatherables.definitions.find((g) => g.kind === 'branch')!;
    const model = view.group.getObjectByName(`environment:gatherable:${d.id}`)!;
    expect(model.visible).toBe(true); view.setHighlight(d.id);
    expect(view.group.getObjectByName(`environment:gatherable:${d.id}:highlight-ring`)?.visible).toBe(true);
    const inventory = new Inventory(items, 24); world.gatherables.interactables(inventory, 3.6).find((x) => x.descriptor.id === d.id)!.interact();
    view.syncGatherables(); expect(model.visible).toBe(false); view.dispose();
  });
  it('starts from empty inventory, gathers resources, builds and runs the full default chain', () => {
    const config = createGameConfig(), inventory = new Inventory(items, 24), world = createWorld(config, inventory);
    for (const object of world.gatherables.interactables(inventory, config.interaction.range)) {
      while (object.isAvailable()) expect(object.interact().ok).toBe(true);
    }
    expect(inventory.getItemCount('iron-ore')).toBe(0);
    expect(inventory.getItemCount('stone')).toBeGreaterThanOrEqual(26); expect(inventory.getItemCount('wood')).toBeGreaterThanOrEqual(18);
    const deposit = world.deposits.find((d) => d.itemId === 'iron-ore')!, far = { x: 100, z: 100, radius: .4 };
    const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far);
    expect(miner.reason).toBe('valid'); expect(inventory.getItemCount('iron-ore')).toBe(0);
    const { x, z } = miner.transform; let terminalId = '';
    for (const [type, px, pz, rotation] of [['conveyor-straight', x, z - 2, 0], ['conveyor-curve', x, z - 4, 0], ['conveyor-incline', x + 2, z - 4, 3], ['receiving-terminal', x + 4, z - 4, 3]] as const) {
      const placed = world.buildings.place(type, px, pz, rotation, far); expect(placed.reason, type).toBe('valid');
      expect(placed.connection).toBe('connected'); if (type === 'receiving-terminal') terminalId = placed.building!.id;
    }
    const machines = new MachineManager(world.buildings, items, () => world.deposits), logistics = new LogisticsManager(world.buildings, machines, items);
    for (let i = 0; i < 1200; i++) { machines.fixedUpdate(50); logistics.fixedUpdate(50); }
    expect(logistics.terminal(terminalId)!.getItemCount('iron-ore')).toBeGreaterThan(0);
  });
});
