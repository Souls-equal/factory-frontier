import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { MachineManager } from '../../src/machines/MachineManager';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { GroundItems } from '../../src/logistics/GroundItems';
import { PowerManager } from '../../src/power/PowerManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x,z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({x,z}),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({x:0,y:1,z:0}) };
const far = { x: 20, z: 20, radius: .4 };
function setup() {
  const items = createDefaultItemRegistry(), player = new Inventory(items, 24);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 29, []); buildings.setCreativeMode(true);
  let paused = false;
  const machines = new MachineManager(buildings, items, () => [], undefined, () => paused);
  const power = new PowerManager(buildings, machines, items, () => paused), ground = new GroundItems(() => 0);
  const logistics = new LogisticsManager(buildings, machines, items, () => paused, 1, undefined, ground, power);
  const place = (type: string, x: number, z: number, r = 0, offset?: number) => {
    const result = buildings.place(type, x, z, r, far, offset); expect(result.reason, `${type} ${x},${z}`).toBe('valid'); return result.building!;
  };
  const tick = (n: number) => { for (let i = 0; i < n; i++) { power.fixedUpdate(50); logistics.fixedUpdate(50); } };
  return { items, player, buildings, machines, power, logistics, ground, place, tick, pause: (value: boolean) => { paused = value; } };
}
const dirs = [{x:0,z:-1},{x:-1,z:0},{x:0,z:1},{x:1,z:0}];

describe('powered advanced manufacturing networks', () => {
  it.each(['assembler', 'foundry'])('delivers both inputs into a %s, blocks unsupported cargo and protects reserved slots', (type) => {
    const s = setup(), building = s.place(type, 0, 0), left = s.place('conveyor-cell', -.5, 1.5), right = s.place('conveyor-cell', .5, 1.5);
    s.logistics.sync(); const machine = s.machines.advanced(building.id)!;
    const a = machine.recipe.input.itemId, b = machine.recipe.additionalInputs![0]!.itemId;
    const receiverA = s.logistics.network.get(left.id)!.receiver!, receiverB = s.logistics.network.get(right.id)!.receiver!;
    expect(receiverA.id).toBe(building.id); expect(receiverB.id).toBe(building.id);
    expect(receiverA.canAccept('wood')).toBe(false); expect(receiverA.accept('wood')).toBe(false);
    for (let i = 0; i < 100; i++) expect(receiverA.accept(a)).toBe(true);
    expect(receiverA.canAccept(a)).toBe(false); expect(receiverB.canAccept(b)).toBe(true);
    expect(receiverB.accept(b)).toBe(true); expect(machine.input.getItemCount(b)).toBe(1);
    expect(s.buildings.demolish(building.id)).toBe('output not empty');
    expect(machine.state).toBe('NO_POWER'); s.tick(100); expect(machine.output.usedSlots).toBe(0);
  });
  it.each([0,1,2,3])('attaches both rear lanes and the front output of an assembler at rotation %i', r => {
    for (const reverse of [false, true]) {
      const s = setup(), d = dirs[r]!;
      const lane = (sign: number) => ({ x: -1.5*d.x + sign*d.z, z: -1.5*d.z - sign*d.x });
      const a = lane(-.5), b = lane(.5), out = { x: 1.5*d.x + .5*d.z, z: 1.5*d.z - .5*d.x };
      let building, left, right;
      if (reverse) { left = s.place('conveyor-cell', a.x, a.z, r); right = s.place('conveyor-cell', b.x, b.z, r); building = s.place('assembler', 0, 0, r); }
      else { building = s.place('assembler', 0, 0, r); left = s.place('conveyor-cell', a.x, a.z, r); right = s.place('conveyor-cell', b.x, b.z, r); }
      const outlet = s.place('conveyor-cell', out.x, out.z, r); s.logistics.sync();
      expect(s.logistics.network.get(left.id)!.receiver?.id).toBe(building.id);
      expect(s.logistics.network.get(right.id)!.receiver?.id).toBe(building.id);
      expect(s.logistics.network.get(outlet.id)!.source?.id).toBe(building.id);
    }
  });
  it('distinguishes a smelter lacking coal from a machine lacking electricity in factory statistics', () => {
    const s = setup(), smelter = s.place('smelter', 0, 0), assembler = s.place('assembler', 4, 0);
    s.logistics.sync(); const sm = s.machines.smelter(smelter.id)!, machine = s.machines.advanced(assembler.id)!;
    sm.input.addItem('iron-ore', 1); sm.setPowered(true); machine.setPowered(false);
    const stats = s.machines.statistics('iron-ingot'); expect(stats.missingFuel).toBe(1); expect(stats.noPower).toBe(1);
  });
  it('transports separate plate and rod streams into an assembler and delivers completed parts', () => {
    const s = setup(), a = s.place('conveyor-cell', -.5, 1.5), b = s.place('conveyor-cell', .5, 1.5);
    const building = s.place('assembler', 0, 0), out = s.place('conveyor-cell', -.5, -1.5), sink = s.place('receiving-terminal', 0, -3);
    s.place('power-pole', 3, 0); const generator = s.place('biomass-generator', 5, 0); s.logistics.sync();
    s.power.generator(generator.id)!.fuel.addItem('wood', 4);
    for (let i = 0; i < 6; i++) { s.ground.drop(`plate-${i}`, 'iron-plate', { x:-.5,y:.6,z:1.5 }); s.ground.drop(`rod-${i}`, 'iron-rod', { x:.5,y:.6,z:1.5 }); }
    s.tick(800); const m = s.machines.advanced(building.id)!;
    expect(s.logistics.terminal(sink.id)!.getItemCount('reinforced-component')).toBe(6);
    expect(m.consumed('iron-plate')).toBe(6); expect(m.consumed('iron-rod')).toBe(6);
    expect(s.logistics.network.get(a.id)!.items).toHaveLength(0); expect(s.logistics.network.get(b.id)!.items).toHaveLength(0);
    expect(s.logistics.network.get(out.id)!.items).toHaveLength(0); expect(s.ground.all()).toHaveLength(0);
  });
  it('connects an elevated lift directly into an advanced input', () => {
    const s = setup(), source = s.place('storage-container', 0, 2), lift = s.place('lift-up-1', 0, 0);
    s.place('foundation', 0, -2, 0, .6); const building = s.place('assembler', 0, -2);
    s.logistics.sync(); const segment = s.logistics.network.get(lift.id)!;
    expect(segment.receiver?.id).toBe(building.id); s.logistics.terminal(source.id)!.addItem('iron-rod', 3); s.tick(300);
    expect(s.machines.advanced(building.id)!.input.getItemCount('iron-rod')).toBe(3);
  });
  it('switches to a different input safely and rejects old cargo without losing it', () => {
    const s = setup(), building = s.place('constructor', 0, 0), belt = s.place('conveyor-cell', -.5, 1.5); s.logistics.sync();
    const m = s.machines.constructorMachine(building.id)!, receiver = s.logistics.network.get(belt.id)!.receiver!;
    expect(receiver.accept('iron-ingot')).toBe(true); expect(m.selectRecipe('steel-plate')).toBe(false);
    m.input.removeItem('iron-ingot', 1); expect(m.selectRecipe('steel-plate')).toBe(true);
    expect(receiver.canAccept('iron-ingot')).toBe(false); expect(receiver.accept('steel-ingot')).toBe(true);
    expect(m.input.getItemCount('steel-ingot')).toBe(1);
  });
  it('runs iron ore + coal through foundry and steel constructor to terminal with pause and conservation', () => {
    const s = setup(), left = s.place('conveyor-cell', -.5, 1.5), right = s.place('conveyor-cell', .5, 1.5);
    const foundry = s.place('foundry', 0, 0), bridge = s.place('conveyor-cell', -.5, -1.5);
    const constructor = s.place('constructor', 0, -3), output = s.place('conveyor-cell', -.5, -4.5), terminal = s.place('receiving-terminal', 0, -6);
    s.place('power-pole', 3, -2); const generator = s.place('biomass-generator', 5, -2);
    s.logistics.sync(); const f = s.machines.advanced(foundry.id)!, c = s.machines.constructorMachine(constructor.id)!;
    expect(c.selectRecipe('steel-plate')).toBe(true);
    expect(s.logistics.network.get(bridge.id)!.source?.id).toBe(foundry.id);
    expect(s.logistics.network.get(bridge.id)!.receiver?.id).toBe(constructor.id);
    expect(s.logistics.network.get(output.id)!.receiver?.id).toBe(terminal.id);
    for (let i = 0; i < 8; i++) { s.ground.drop(`ore-${i}`, 'iron-ore', {x:-.5,y:.6,z:1.5}); s.ground.drop(`coal-${i}`, 'coal', {x:.5,y:.6,z:1.5}); }
    s.tick(300); expect(f.state).toBe('NO_POWER'); expect(f.output.usedSlots).toBe(0);
    s.power.generator(generator.id)!.fuel.addItem('wood', 10);
    const total = () => s.ground.all().length + s.logistics.network.all().reduce((n, v) => n + v.items.length, 0) +
      f.input.getItemCount('iron-ore') + f.input.getItemCount('coal') + 2 * (f.output.getItemCount('steel-ingot') + c.input.getItemCount('steel-ingot') + c.output.getItemCount('steel-plate') + s.logistics.terminal(terminal.id)!.getItemCount('steel-plate')) +
      s.logistics.network.all().reduce((n, v) => n + v.items.filter(item => item.itemId === 'steel-ingot' || item.itemId === 'steel-plate').length, 0);
    for (let i = 0; i < 2200; i++) { s.tick(1); if (i % 25 === 0) expect(total()).toBe(16); }
    expect(s.logistics.terminal(terminal.id)!.getItemCount('steel-plate')).toBe(8);
    expect(f.produced('steel-ingot')).toBe(8); expect(c.produced('steel-plate')).toBe(8); expect(total()).toBe(16);
    const stats = s.machines.statistics('steel-ingot'); expect(stats.machines).toBe(2);
    expect(stats.productionRate).toBeGreaterThan(0); expect(stats.consumptionRate).toBeGreaterThan(0);
    expect(stats.missingInput).toBe(2); expect(stats.averageUtilization).toBeGreaterThan(0);
    expect(s.logistics.network.get(left.id)!.receiver?.id).toBe(foundry.id); expect(s.logistics.network.get(right.id)!.receiver?.id).toBe(foundry.id);
  });
  it('recovers blocked output, retains input through pause and produces reinforced components', () => {
    const s = setup(), building = s.place('assembler', 0, 0), sink = s.place('receiving-terminal', 0, -3);
    s.place('power-pole', 3, 0); const generator = s.place('biomass-generator', 5, 0); s.logistics.sync();
    const m = s.machines.advanced(building.id)!, terminal = s.logistics.terminal(sink.id)!;
    s.power.generator(generator.id)!.fuel.addItem('wood', 4); m.input.addItem('iron-plate', 4); m.input.addItem('iron-rod', 4);
    terminal.addItem('stone', 100); m.output.addItem('reinforced-component', 100); s.tick(200);
    expect(m.state).toBe('OUTPUT_FULL'); expect(m.input.getItemCount('iron-plate')).toBe(4);
    const fuel = s.power.generator(generator.id)!.fuelTimeMs, elapsed = m.elapsedMs; s.pause(true); s.tick(200);
    expect(s.power.generator(generator.id)!.fuelTimeMs).toBe(fuel); expect(m.elapsedMs).toBe(elapsed); expect(m.input.getItemCount('iron-rod')).toBe(4); s.pause(false);
    m.output.removeItem('reinforced-component', 100); terminal.removeItem('stone', 100); const out = s.place('conveyor-cell', -.5, -1.5); s.tick(600);
    expect(terminal.getItemCount('reinforced-component')).toBe(4); expect(m.produced('reinforced-component')).toBe(4);
    expect(s.logistics.network.get(out.id)!.items).toHaveLength(0); expect(s.ground.all()).toHaveLength(0);
  });
});
