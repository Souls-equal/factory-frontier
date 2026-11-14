import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { GroundItems } from '../../src/logistics/GroundItems';
import { cellTouchesReceiver, cellTouchesSource } from '../../src/logistics/CellConveyor';
import { directLiftInput, directLiftOutput } from '../../src/logistics/DirectLiftConnections';
import { InventorySource } from '../../src/logistics/Ports';
import { MachineManager } from '../../src/machines/MachineManager';
import { PowerManager } from '../../src/power/PowerManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x, z) => ({ x, z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const far = { x: 20, z: 20, radius: .4 };
function setup() {
  const items = createDefaultItemRegistry(), player = new Inventory(items, 12);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 29, []); buildings.setCreativeMode(true);
  let paused = false;
  const machines = new MachineManager(buildings, items, () => [], undefined, () => paused);
  const power = new PowerManager(buildings, machines, items, () => paused), ground = new GroundItems(() => 0);
  const logistics = new LogisticsManager(buildings, machines, items, () => paused, 1, undefined, ground, power);
  const place = (type: string, x: number, z: number, rotation = 0, offset?: number) => {
    const result = buildings.place(type, x, z, rotation, far, offset); expect(result.reason, `${type} ${x},${z}`).toBe('valid'); return result.building!;
  };
  const tick = (n: number) => { for (let i = 0; i < n; i++) { power.fixedUpdate(50); logistics.fixedUpdate(50); } };
  return { buildings, machines, power, ground, logistics, place, tick, pause: (v: boolean) => { paused = v; } };
}
const directions = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }];

describe('conveyor-fed biomass generator', () => {
  it.each([0, 1, 2, 3])('connects the rear in both build orders and both lanes, rotation %i', (r) => {
    for (const lane of [-.5, .5]) for (const beltFirst of [false, true]) {
      const s = setup(), d = directions[r]!;
      const x = -1.5 * d.x + lane * d.z, z = -1.5 * d.z - lane * d.x;
      let generator, belt;
      if (beltFirst) { belt = s.place('conveyor-cell', x, z, r); generator = s.place('biomass-generator', 0, 0, r); }
      else { generator = s.place('biomass-generator', 0, 0, r); belt = s.place('conveyor-cell', x, z, r); }
      s.logistics.sync(); const segment = s.logistics.network.get(belt.id)!;
      expect(segment.receiver?.id).toBe(generator.id);
      expect(segment.receiver!.canAccept('wood')).toBe(true); expect(segment.receiver!.canAccept('coal')).toBe(false);
      expect(segment.receiver!.accept('coal')).toBe(false);
      expect(segment.receiver!.accept('wood')).toBe(true); expect(s.power.generator(generator.id)!.fuel.getItemCount('wood')).toBe(1);
      expect(s.buildings.demolish(generator.id)).toBe('output not empty');
    }
  });
  it('blocks non-wood and full fuel without losses, pauses, resumes and supplies actual power', () => {
    const s = setup(), source = s.place('storage-container', 0, 3), belt = s.place('conveyor-cell', -.5, 1.5), generator = s.place('biomass-generator', 0, 0);
    s.place('power-pole', 3, 0); const consumer = s.place('constructor', 4, -2);
    s.logistics.sync(); const from = s.logistics.terminal(source.id)!, fuel = s.power.generator(generator.id)!.fuel;
    const machine = s.machines.constructorMachine(consumer.id)!; machine.input.addItem('iron-ingot', 1);
    from.addItem('coal', 1); s.tick(120); const segment = s.logistics.network.get(belt.id)!;
    expect(segment.state).toBe('BLOCKED'); expect(fuel.usedSlots).toBe(0); expect(machine.output.usedSlots).toBe(0);
    expect(from.getItemCount('coal') + segment.items.filter(i => i.itemId === 'coal').length).toBe(1);
    expect(s.ground.all()).toHaveLength(0);
    // Recover the blocked cargo by removing the receiver and belt after emptying via a replacement storage.
    expect(s.buildings.demolish(belt.id)).toBe('output not empty');
    expect(s.buildings.demolish(generator.id)).toBe('removed');
    const sink = s.place('storage-container', 0, 0); s.tick(120); expect(s.logistics.terminal(sink.id)!.getItemCount('coal')).toBe(1);
    expect(s.buildings.demolish(sink.id)).toBe('output not empty');
    s.logistics.terminal(sink.id)!.removeItem('coal', 1); expect(s.buildings.demolish(sink.id)).toBe('removed');
    const replacement = s.place('biomass-generator', 0, 0); s.logistics.sync(); const gen = s.power.generator(replacement.id)!;
    gen.fuel.addItem('wood', 100); from.addItem('wood', 4); machine.setEnabled(false); s.tick(200);
    expect(segment.state).toBe('BLOCKED'); expect(from.getItemCount('wood') + segment.items.length + gen.fuel.getItemCount('wood')).toBe(104);
    const before = segment.items.map(i => ({ ...i })); s.pause(true); s.tick(100); expect(segment.items).toEqual(before); expect(gen.fuel.getItemCount('wood')).toBe(100); s.pause(false);
    gen.fuel.removeItem('wood', 4); s.tick(250); expect(gen.fuel.getItemCount('wood')).toBe(100); expect(from.getItemCount('wood') + segment.items.length).toBe(0);
    machine.setEnabled(true); s.tick(80); expect(machine.output.getItemCount('iron-plate')).toBe(1);
    expect(gen.remainingMs).toBeGreaterThan(0); expect(s.ground.all()).toHaveLength(0);
  });
  it('does not create a source or connect from the wrong face', () => {
    const s = setup(), gen = s.place('biomass-generator', 0, 0);
    const front = s.place('conveyor-cell', -.5, -1.5); const wrong = s.place('conveyor-cell', -.5, 1.5, 2);
    s.logistics.sync(); expect(s.logistics.network.get(front.id)!.source).toBeNull(); expect(s.logistics.network.get(wrong.id)!.receiver).toBeNull();
    expect(s.buildings.validate('conveyor-cell', .5, -1.5, 0, far).connection).not.toBe('connected');
    expect(s.power.generator(gen.id)!.fuel.usedSlots).toBe(0);
  });
  it.each([0, 1, 2, 3])('accepts direct elevated lift output at rotation %i', (r) => {
    const s = setup(), d = directions[r]!;
    const source = s.place('storage-container', -2*d.x, -2*d.z, r), lift = s.place('lift-up-1', 0, 0, r);
    s.place('foundation', 2*d.x, 2*d.z, 0, .6); const generator = s.place('biomass-generator', 2*d.x, 2*d.z, r);
    s.logistics.sync(); expect(s.logistics.network.get(lift.id)!.receiver?.id).toBe(generator.id);
    s.logistics.terminal(source.id)!.addItem('wood', 3); s.tick(300);
    expect(s.power.generator(generator.id)!.fuel.getItemCount('wood')).toBe(3);
  });
  it('rejects mismatched elevations and never treats a generator as a lift source', () => {
    const s = setup(), gen = s.place('biomass-generator', 0, 0), belt = s.place('conveyor-cell', -.5, 1.5);
    const elevated = { ...gen, transform: { ...gen.transform, y: gen.transform.y + 1 } };
    expect(cellTouchesReceiver(belt, gen, 1)).toBe(true);
    expect(cellTouchesReceiver(belt, elevated, 1)).toBe(false);
    expect(cellTouchesSource(belt, gen, 1)).toBe(false);
    const lift = s.place('lift-up-1', 4, 4);
    const liftSink = { ...gen, transform: { ...gen.transform, x: 4, z: 2, y: 1 } };
    expect(directLiftOutput(lift, liftSink, 1)).toBe(true);
    expect(directLiftOutput(lift, { ...liftSink, transform: { ...liftSink.transform, y: 0 } }, 1)).toBe(false);
    const liftSource = { ...gen, transform: { ...gen.transform, x: 4, z: 6 } };
    expect(directLiftInput(lift, liftSource, 1)).toBe(false);
  });
  it('marks a route into the generator as connected but not a route from its front', () => {
    const s = setup(); s.place('biomass-generator', 0, 0); s.place('storage-container', 0, 5);
    const incoming = s.buildings.previewConveyorRoute([{ x: -.5, z: 3.5 }, { x: -.5, z: 1.5 }], far);
    expect(incoming.reason).toBe('valid'); expect(incoming.endConnection).toBe('connected');
    const outgoing = s.buildings.previewConveyorRoute([{ x: -.5, z: -1.5 }, { x: -.5, z: -3.5 }], far);
    expect(outgoing.reason).toBe('missing source');
  });
  it.each(['conveyor-straight', 'conveyor-auto'])('transports wood on a compatible %s', (type) => {
    const s = setup(), generator = s.place('biomass-generator', 0, 0), belt = s.place(type, 0, 2);
    s.logistics.sync(); const segment = s.logistics.network.get(belt.id)!;
    expect(segment.receiver?.id).toBe(generator.id);
    const stock = new Inventory(createDefaultItemRegistry(), 1); stock.addItem('wood', 3);
    const pose = { position: segment.path.point(0), direction: segment.path.direction('input') };
    expect(s.logistics.network.attachSource(belt.id, new InventorySource('test-source', pose, stock, 'wood'))).toBe(true);
    s.tick(250); expect(stock.getItemCount('wood')).toBe(0);
    expect(s.power.generator(generator.id)!.fuel.getItemCount('wood')).toBe(3);
  });
});
