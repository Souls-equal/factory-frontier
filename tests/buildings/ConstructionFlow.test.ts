import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { BuildingTerrain } from '../../src/buildings/BuildingTerrain';
import { BuildingCollision } from '../../src/buildings/BuildingCollision';
import { ConstructionController } from '../../src/buildings/ConstructionController';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { ObstacleField } from '../../src/world/ObstacleField';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, size: 100, resolution: 50, cellSize: 2,
  contains: (x,z) => Math.abs(x) <= 50 && Math.abs(z) <= 50, clampXZ: (x,z) => ({x,z}), heightAt: () => 0,
  slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
function setup() {
  const inventory = new Inventory(createDefaultItemRegistry(), 3);
  inventory.addItem('stone', 20); inventory.addItem('wood', 10);
  const world = new ObstacleField([]);
  const system = new BuildingSystem(createDefaultBuildingRegistry(inventory.registry), inventory, terrain, world.definitions, 1, 40);
  const controller = new ConstructionController(system, terrain);
  const collision = new BuildingCollision(world, system);
  const player = { x: 0, z: 4, radius: 0.4 };
  const view = { position: { x: 0, y: 1.7, z: 4 }, yaw: 0, pitch: -Math.PI / 4 };
  return { inventory, system, controller, collision, player, view };
}
describe('construction flow', () => {
  it('previews, rotates, places, blocks movement, targets and demolishes with full refund', () => {
    const { inventory, system, controller, collision, player, view } = setup();
    controller.select('foundation');
    const preview = controller.preview(view, player)!;
    expect(preview.reason).toBe('valid');
    expect(system.all()).toHaveLength(0);
    controller.rotate();
    const rotated = controller.preview(view, player)!; expect(rotated.transform.rotation).toBe(1);
    const result = controller.confirm(view, player)!;
    expect(result.transform).toEqual(rotated.transform); expect(result.reason).toBe('valid');
    expect(controller.selected).toBe('foundation'); expect(system.all()).toHaveLength(1);
    expect(inventory.getItemCount('stone')).toBe(10); expect(inventory.getItemCount('wood')).toBe(5);
    const surface = new BuildingTerrain(terrain, system);
    expect(surface.heightAt(result.transform.x, result.transform.z)).toBeCloseTo(0.4);
    const blocked = collision.moveCircle(0, 4, 0, -5, 0.4, 0, 1.8);
    expect(blocked.collided).toBe(true); expect(blocked.z).toBeGreaterThan(result.transform.footprint.maxZ);
    const target = controller.target(view); expect(target).toBe(result.building?.id);
    expect(system.demolish(target!)).toBe('removed'); expect(system.all()).toHaveLength(0);
    expect(inventory.getItemCount('stone')).toBe(20); expect(inventory.getItemCount('wood')).toBe(10);
    expect(collision.moveCircle(0, 4, 0, -5, 0.4, 0, 1.8).z).toBeCloseTo(-1);
    expect(surface.heightAt(result.transform.x, result.transform.z)).toBe(0);
    expect(system.demolish(target!)).toBe('unknown building');
    expect(inventory.getItemCount('stone')).toBe(20);
  });
  it('cancels without mutations and rejects a duplicate placement', () => {
    const { inventory, system, controller, player, view } = setup();
    const initial = inventory.snapshot(); controller.select('foundation'); controller.cancel();
    expect(controller.preview(view, player)).toBeNull(); expect(inventory.snapshot()).toEqual(initial);
    controller.select('foundation'); controller.confirm(view, player);
    const after = inventory.snapshot();
    expect(controller.confirm(view, player)?.reason).toBe('occupied space');
    expect(controller.active).toBe(true); expect(system.all()).toHaveLength(1); expect(inventory.snapshot()).toEqual(after);
  });
});

describe('building collision regressions', () => {
  it('does not alter natural obstacle movement when no buildings exist', () => {
    const { system } = setup();
    const natural = new ObstacleField([{ id: 'rock', kind: 'boulder', x: 0, y: 0, z: 0, radius: 1, height: 2, yaw: 0, variant: 0 }]);
    const combined = new BuildingCollision(natural, system);
    const result = natural.moveCircle(-3, -0.5, 5, 1, 0.4, 0, 1.8);
    expect(result.collided).toBe(true);
    expect(combined.moveCircle(-3, -0.5, 5, 1, 0.4, 0, 1.8)).toEqual(result);
  });
  it('allows movement across the top surface when the player is above a foundation', () => {
    const { system, controller, collision, player, view } = setup();
    controller.select('foundation'); const placed = controller.confirm(view, player)!;
    const f = placed.transform.footprint;
    const movement = collision.moveCircle(0, f.maxZ + 1, 0, -4, .4, .4, 2.2);
    expect(movement.collided).toBe(false);
    expect(movement.z).toBeCloseTo(f.maxZ - 3);
    expect(system.all()).toHaveLength(1);
  });
});

describe('building/player integration', () => {
  it('blocks sustained walking, permits jumping onto a foundation and releases after demolition', async () => {
    const { createGameConfig } = await import('../../src/core/Configuration');
    const { PlayerController } = await import('../../src/player/PlayerController');
    const { system, controller, collision, player: footprint, view } = setup();
    controller.select('foundation'); const result = controller.confirm(view, footprint)!;
    const config = createGameConfig();
    const player = new PlayerController({ controls: config.controls, player: config.player,
      terrain: new BuildingTerrain(terrain, system), obstacles: collision, spawn: { x: 0, y: 0, z: 4, yaw: 0 } });
    for (let i = 0; i < 60; i++) player.step(.05, { moveX: 0, moveZ: 1, sprint: false, lookDeltaX: 0, lookDeltaY: 0 });
    expect(player.position.z).toBeGreaterThanOrEqual(result.transform.footprint.maxZ + config.player.radius - .001);
    expect(Math.abs(player.verticalSpeed)).toBeLessThan(1);
    player.step(.05, { moveX: 0, moveZ: 1, sprint: false, lookDeltaX: 0, lookDeltaY: 0, jump: true });
    let onTop = false;
    for (let i = 0; i < 20; i++) {
      player.step(.05, { moveX: 0, moveZ: i < 6 ? 1 : 0, sprint: false, lookDeltaX: 0, lookDeltaY: 0 });
      if (player.position.z < result.transform.footprint.maxZ && Math.abs(player.position.y - .4) < .01 && player.isGrounded) onTop = true;
    }
    expect(onTop).toBe(true);
    expect(system.demolish(result.building!.id)).toBe('removed');
    expect(new BuildingTerrain(terrain, system).heightAt(0, 2)).toBe(0);
  });
});

describe('repeat placement for every registered building', () => {
  it.each(['foundation', 'miner-mk1', 'conveyor-straight', 'conveyor-curve', 'conveyor-incline', 'receiving-terminal'])(
    'keeps %s selected, validates and pays each time, and cancels', (id) => {
      const items = createDefaultItemRegistry();
      const inventory = new Inventory(items, 10);
      const registry = createDefaultBuildingRegistry(items);
      const definition = registry.get(id);
      for (const cost of definition.cost) inventory.addItem(cost.itemId, cost.quantity * 2);
      const deposits = [0, 6, 12].map((x, index) => ({ id: `deposit-${index}`, itemId: 'iron-ore',
        x, z: 0, y: 0, radius: .8, purity: 'normal' as const, productionMultiplier: 1, extractionCompatible: true }));
      const system = new BuildingSystem(registry, inventory, terrain, [], 1, 40, deposits);
      const controller = new ConstructionController(system, terrain);
      const player = { x: 30, z: 30, radius: .4 };
      const viewAt = (x: number) => ({ position: { x, y: 3, z: 0 }, yaw: 0, pitch: -Math.PI / 2 });
      controller.select(id); controller.rotate();
      const first = controller.confirm(viewAt(0), player)!;
      expect(first.reason).toBe('valid'); expect(first.transform.rotation).toBe(1);
      expect(controller.selected).toBe(id);
      const afterFirst = inventory.snapshot();
      expect(controller.confirm(viewAt(0), player)?.reason).toBe('occupied space');
      expect(inventory.snapshot()).toEqual(afterFirst);
      const second = controller.confirm(viewAt(6), player)!;
      expect(second.reason).toBe('valid'); expect(second.transform.rotation).toBe(1);
      expect(controller.selected).toBe(id); expect(system.all()).toHaveLength(2);
      for (const cost of definition.cost) expect(inventory.getItemCount(cost.itemId)).toBe(0);
      const afterSecond = inventory.snapshot();
      expect(controller.confirm(viewAt(12), player)?.reason).toBe('insufficient materials');
      expect(inventory.snapshot()).toEqual(afterSecond); expect(system.all()).toHaveLength(2);
      expect(controller.selected).toBe(id);
      controller.cancel();
      expect(controller.confirm(viewAt(12), player)).toBeNull();
      expect(controller.preview(viewAt(12), player)).toBeNull();
    },
  );
});

describe('close placement and contact recovery', () => {
  it('rejects placing a belt within the conservative corner and accepts a clear near placement', () => {
    const { system } = setup();
    const corner = { x: -.3, z: -.3, radius: .4 };
    expect(system.place('conveyor-cell', .5, .5, 0, corner).reason).toBe('player overlap');
    const near = { x: -.401, z: -.3, radius: .4 };
    expect(system.place('conveyor-cell', .5, .5, 0, near).reason).toBe('valid');
  });
  it('lets an overlapping player move out or slide but not further into the building', () => {
    const { system, collision } = setup();
    expect(system.place('conveyor-cell', .5, .5, 0, { x: 8, z: 8, radius: .4 }).reason).toBe('valid');
    const retreat = collision.moveCircle(-.39, .5, -.4, 0, .4, 0, 1.8);
    expect(retreat.x).toBeCloseTo(-.79); expect(retreat.blocked).toBe(false);
    const into = collision.moveCircle(-.39, .5, .4, .2, .4, 0, 1.8);
    expect(into.x).toBeCloseTo(-.39); expect(into.z).toBeCloseTo(.7); expect(into.blocked).toBe(false);
    const corner = collision.moveCircle(-.399999999999, -.399999999999, -.2, -.2, .4, 0, 1.8);
    expect(corner.x).toBeCloseTo(-.6); expect(corner.z).toBeCloseTo(-.6);
    const through = collision.moveCircle(-1, .5, 4, 0, .4, 0, 1.8);
    expect(through.x).toBeCloseTo(-.4); expect(through.collided).toBe(true);
  });
  it('recovers under the real player controller without teleporting or a speed spike', async () => {
    const { createGameConfig } = await import('../../src/core/Configuration');
    const { PlayerController } = await import('../../src/player/PlayerController');
    const { system, collision } = setup();
    expect(system.place('conveyor-cell', .5, .5, 0, { x: 8, z: 8, radius: .4 }).reason).toBe('valid');
    const config = createGameConfig();
    const p = new PlayerController({ controls: config.controls, player: config.player, terrain: new BuildingTerrain(terrain, system), obstacles: collision,
      spawn: { x: -.399999999999, z: .5, y: 0, yaw: 0 } });
    for (let i = 0; i < 30; i++) {
      const before = p.position; p.step(.05, { moveX: -1, moveZ: 0, sprint: false, lookDeltaX: 0, lookDeltaY: 0 });
      expect(Math.hypot(p.position.x - before.x, p.position.z - before.z)).toBeLessThanOrEqual(config.controls.moveSpeed * .05 + 1e-7);
    }
    expect(p.position.x).toBeLessThan(-1);
  });
});

it.each([0, 1, 2, 3])('moves away after placing a cell at contact on side %i', async (side) => {
  const { createGameConfig } = await import('../../src/core/Configuration');
  const { PlayerController } = await import('../../src/player/PlayerController');
  const { system, collision } = setup(), config = createGameConfig();
  const positions = [{ x: -.4, z: .5 }, { x: 1.4, z: .5 }, { x: .5, z: -.4 }, { x: .5, z: 1.4 }];
  const moves = [{ moveX: -1, moveZ: 0 }, { moveX: 1, moveZ: 0 }, { moveX: 0, moveZ: 1 }, { moveX: 0, moveZ: -1 }];
  const pos = positions[side]!, input = moves[side]!;
  const p = new PlayerController({ controls: config.controls, player: config.player, terrain: new BuildingTerrain(terrain, system), obstacles: collision,
    spawn: { ...pos, y: 0, yaw: 0 } });
  const result = system.place('conveyor-cell', .5, .5, 0, { x: p.position.x, z: p.position.z, radius: config.player.radius });
  expect(result.reason).toBe('valid');
  for (let i = 0; i < 20; i++) p.step(.05, { ...input, sprint: false, lookDeltaX: 0, lookDeltaY: 0 });
  expect(Math.hypot(p.position.x - pos.x, p.position.z - pos.z)).toBeGreaterThan(1);
});

it('rechecks escape movement against other solid buildings', () => {
  const { system, collision } = setup(), far = { x: 9, z: 9, radius: .4 };
  expect(system.place('conveyor-cell', .5, .5, 0, far).reason).toBe('valid');
  expect(system.place('conveyor-cell', -1.5, .5, 0, far).reason).toBe('valid');
  const result = collision.moveCircle(-.39, .5, -4, 0, .4, 0, 1.8);
  expect(result.x).toBeCloseTo(-.6); expect(result.collided).toBe(true);
});

describe('foundation height workflow', () => {
  it('retains invalid adjustments, resets after success and follows the floating neighbour', () => {
    const { controller, system, player } = setup();
    const viewAt = (x: number, z: number) => ({ position: { x, y: 3, z }, yaw: 0, pitch: -Math.PI / 2 });
    controller.select('foundation');
    for (let i = 0; i < 4; i++) controller.adjustFoundationHeight(-1);
    expect(controller.confirm(viewAt(0, 0), player)?.reason).toBe('unsupported height');
    expect(controller.foundationHeightOffset).toBe(-.4);
    for (let i = 0; i < 14; i++) controller.adjustFoundationHeight(1);
    const preview = controller.preview(viewAt(0, 0), player)!;
    const placed = controller.confirm(viewAt(0, 0), player)!;
    expect(placed.transform).toEqual(preview.transform); expect(placed.transform.y).toBe(1);
    expect(controller.foundationHeightOffset).toBe(0);
    const neighbour = controller.preview(viewAt(2, 1), player)!;
    expect(neighbour.reason).toBe('valid'); expect(neighbour.transform.y).toBe(1);
    expect(controller.confirm(viewAt(2, 1), player)?.transform).toEqual(neighbour.transform);
    const surface = new BuildingTerrain(terrain, system);
    expect(surface.groundBelow(0, 0, 1.4, .2)).toBeCloseTo(1.4);
    expect(surface.groundBelow(0, 0, .5, .2)).toBe(0);
    controller.select('conveyor-cell'); controller.adjustFoundationHeight(1); expect(controller.foundationHeightOffset).toBe(0);
  });
});

describe('configurable lift construction', () => {
  it.each(['up', 'down'])('adjusts %s height within 1–8, preserving rotation and chosen height after placement', (direction) => {
    const { system, inventory, controller, player, view } = setup();
    controller.select(`lift-${direction}-1`); controller.adjustLiftHeight(-1);
    expect(controller.selected).toBe(`lift-${direction}-1`);
    for (let i = 0; i < 15; i++) controller.adjustLiftHeight(1);
    expect(controller.selected).toBe(`lift-${direction}-8`);
    controller.rotate(); const preview = controller.preview(view, player)!;
    expect(preview.reason).toBe('valid'); expect(preview.transform.rotation).toBe(1);
    const before = inventory.snapshot();
    const result = controller.confirm(view, player)!;
    expect(result.building?.typeId).toBe(`lift-${direction}-8`); expect(result.transform).toEqual(preview.transform);
    expect(controller.selected).toBe(`lift-${direction}-8`); expect(inventory.snapshot()).not.toEqual(before);
    expect(system.registry.get(result.building!.typeId).height).toBeCloseTo(8.9);
    expect(system.demolish(result.building!.id)).toBe('removed'); expect(inventory.snapshot()).toEqual(before);
    controller.adjustLiftHeight(-1); expect(controller.selected).toBe(`lift-${direction}-7`);
    controller.select('foundation'); controller.adjustLiftHeight(1); expect(controller.selected).toBe('foundation');
  });
  it('targets a supported conveyor on a high platform without touching the ground ray', () => {
    const { system, controller } = setup(); system.setCreativeMode(true);
    expect(system.place('foundation', 0, 0, 0, { x: 20, z: 20, radius: .4 }, 6).reason).toBe('valid');
    controller.select('conveyor-cell');
    const view = { position: { x: 0, y: 8.1, z: 2.5 }, yaw: 0, pitch: -Math.PI / 4 };
    const player = { x: 0, z: 2.5, radius: .4 };
    const preview = controller.preview(view, player)!;
    expect(preview.reason).toBe('valid'); expect(preview.transform.y).toBeCloseTo(6.4);
    expect(controller.confirm(view, player)?.transform).toEqual(preview.transform);
  });
});

it('uses the full height for lift collisions and keeps insufficient-material placement atomic', () => {
  const { system, inventory, collision } = setup();
  const far = { x: 20, z: 20, radius: .4 };
  const lift = system.place('lift-up-8', 0, 0, 0, far);
  expect(lift.reason).toBe('valid');
  expect(collision.moveCircle(0, 3, 0, -4, .3, 7, 8.8).collided).toBe(true);
  const before = inventory.snapshot();
  expect(system.place('lift-down-8', 8, 0, 0, far).reason).toBe('insufficient materials');
  expect(inventory.snapshot()).toEqual(before); expect(system.all()).toHaveLength(1);
});

it('does not aim at a high platform beyond construction reach or through a nearer hill', () => {
  const { system, controller } = setup(); system.setCreativeMode(true);
  expect(system.place('foundation', 0, 0, 0, { x: 20, z: 20, radius: .4 }, 6).reason).toBe('valid');
  controller.select('conveyor-cell');
  expect(controller.aim({ position: { x: 0, y: 13.1, z: 0 }, yaw: 0, pitch: -Math.PI / 2 })).toBeNull();
  const ridge = { ...terrain, heightAt: (_x: number, z: number) => z > 3 ? 7.5 : 0 };
  const ridgeController = new ConstructionController(system, ridge, 6); ridgeController.select('conveyor-cell');
  const point = ridgeController.aim({ position: { x: 0, y: 8.1, z: 3.9 }, yaw: 0, pitch: -Math.PI / 4 });
  expect(point!.z).toBeGreaterThan(3);
});

it('aims a conveyor with custom registries that do not include foundations', async () => {
  const { BuildingRegistry } = await import('../../src/buildings/BuildingRegistry');
  const inventory = new Inventory(createDefaultItemRegistry(), 3), defaults = createDefaultBuildingRegistry(inventory.registry);
  const registry = new BuildingRegistry(inventory.registry); registry.register(defaults.get('conveyor-cell'));
  const system = new BuildingSystem(registry, inventory, terrain, [], 1, 40);
  const controller = new ConstructionController(system, terrain); controller.select('conveyor-cell');
  expect(controller.aim({ position: { x: 0, y: 1.7, z: 4 }, yaw: 0, pitch: -Math.PI / 4 })).not.toBeNull();
});
