import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { MachineManager } from '../../src/machines/MachineManager';
import { PowerManager } from '../../src/power/PowerManager';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';
const terrain: TerrainQuery = { bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, size: 100, resolution: 50, cellSize: 2,
  contains: (x, z) => Math.abs(x) <= 50 && Math.abs(z) <= 50, clampXZ: (x, z) => ({ x, z }),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const deposit: ResourceDeposit = { id: 'd', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
function setup() {
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 5);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, terrain, [], 1, 49, [deposit]);
  buildings.setCreativeMode(true); let paused = false;
  const machines = new MachineManager(buildings, items, () => [deposit]);
  const power = new PowerManager(buildings, machines, items, () => paused);
  const place = (id: string, x: number, z: number) => {
    const result = buildings.place(id, x, z, 0, { x: 40, z: 40, radius: .4 });
    expect(result.reason, `${id} at ${x},${z}`).toBe('valid'); return result.building!;
  };
  return { buildings, inventory, machines, power, place, pause: (p: boolean) => { paused = p; } };
}
describe('building-backed power integration', () => {
  it('powers real machines, stops on fuel exhaustion and restarts with preserved progress', () => {
    const { power, place, machines, buildings } = setup();
    const m = place('miner-mk1', 0, 0), p = place('power-pole', 3, 0), g = place('biomass-generator', 5, 0);
    power.fixedUpdate(4000); expect(machines.get(m.id)!.state).toBe('NO_POWER'); expect(power.wires()).toHaveLength(2);
    const gen = power.generator(g.id)!; gen.fuel.addItem('wood', 1); power.fixedUpdate(1000);
    expect(machines.get(m.id)!.progress).toBe(.5); expect(power.networkFor(p.id)).toMatchObject({ status: 'online', suppliedWatts: 10000, availableWatts: 30000 });
    power.fixedUpdate(30000); expect(machines.get(m.id)!.output.getItemCount('iron-ore')).toBe(15);
    expect(machines.get(m.id)!.state).toBe('NO_POWER');
    gen.fuel.addItem('wood', 1); power.fixedUpdate(2000); expect(machines.get(m.id)!.output.getItemCount('iron-ore')).toBe(16);
    expect(buildings.demolish(p.id)).toBe('removed'); power.fixedUpdate(2000); expect(machines.get(m.id)!.state).toBe('NO_POWER');
  });
  it('preserves fuel on topology updates, pauses correctly, and blocks demolition with stored wood', () => {
    const { power, place, buildings, pause, inventory } = setup();
    const m = place('miner-mk1', 0, 0), p = place('power-pole', 3, 0), g = place('biomass-generator', 5, 0);
    power.sync(); const gen = power.generator(g.id)!; gen.fuel.addItem('wood', 2); power.fixedUpdate(1000);
    expect(buildings.demolish(g.id)).toBe('output not empty');
    pause(true); power.fixedUpdate(5000); expect(gen.remainingMs).toBe(29000);
    place('power-pole', 8, 0); power.fixedUpdate(5000); expect(power.generator(g.id)).toBe(gen); expect(gen.remainingMs).toBe(29000);
    pause(false); power.fixedUpdate(1000); expect(gen.remainingMs).toBe(28000);
    expect(gen.retrieveFuel(inventory).moved).toBe(1);
    expect(buildings.demolish(g.id)).toBe('removed'); power.sync();
    expect(power.generator(g.id)).toBeUndefined(); expect(power.networkFor(m.id).status).toBe('offline');
    expect(power.wires().some(w => w.a === g.id || w.b === g.id)).toBe(false); expect(buildings.get(p.id)).toBeDefined();
  });
  it('merges pole networks, sheds overload and recovers by disabling a machine', () => {
    const { power, place, machines } = setup();
    const m = place('miner-mk1', 0, 0), p = place('power-pole', 3, 0), g = place('biomass-generator', 5, 0);
    const s = place('smelter', 0, 4), c = place('constructor', 0, 7), c2 = place('constructor', 0, 10);
    const p2 = place('power-pole', 3, 9);
    power.sync(); power.generator(g.id)!.fuel.addItem('wood', 1); power.fixedUpdate(1000);
    expect(power.networkFor(p.id)).toMatchObject({ status: 'overloaded', demandWatts: 40000, shortfallWatts: 10000, suppliedWatts: 0 });
    expect(machines.get(m.id)!.state).toBe('NO_POWER'); expect(power.generator(g.id)!.fuelTimeMs).toBe(30000);
    machines.constructorMachine(c2.id)!.setEnabled(false); power.fixedUpdate(1000);
    expect(power.networkFor(p2.id)).toMatchObject({ status: 'online', demandWatts: 30000, suppliedWatts: 30000 });
    expect(machines.get(m.id)!.state).toBe('RUNNING'); expect(machines.smelter(s.id)!.powered).toBe(true); expect(machines.constructorMachine(c.id)!.powered).toBe(true);
  });
  it('reattaches an endpoint to the nearest pole and splits it off when appropriate', () => {
    const { power, place, machines, buildings } = setup();
    const m = place('miner-mk1', 0, 0), left = place('power-pole', -6, 0);
    const right = place('power-pole', 5, 0), gen = place('biomass-generator', -8, 0);
    power.sync(); power.generator(gen.id)!.fuel.addItem('wood', 1); power.fixedUpdate(1000);
    expect(power.networkFor(m.id).status).toBe('online');
    expect(power.wires().find(w => w.b === m.id)?.a).toBe(left.id); // equal-distance tie uses ID
    const nearer = place('power-pole', 2, 3); power.fixedUpdate(1000);
    // The closer pole bridges both pole groups, so power remains available.
    expect(power.wires().find(w => w.b === m.id)?.a).toBe(nearer.id);
    expect(power.networkFor(right.id).status).toBe('online');
    expect(buildings.demolish(nearer.id)).toBe('removed'); power.fixedUpdate(1000);
    expect(power.networkFor(right.id).status).toBe('offline');
    expect(machines.get(m.id)!.state).toBe('RUNNING');
    expect(power.wires().find(w => w.b === m.id)?.a).toBe(left.id);
  });

});
