import { describe, expect, it } from 'vitest';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
import { Miner } from '../../src/machines/Miner';
import { ConstructorMachine } from '../../src/machines/ConstructorMachine';
import { Smelter } from '../../src/machines/Smelter';
import { createDefaultRecipeRegistry } from '../../src/production/Recipes';
import { BiomassGenerator, BIOMASS } from '../../src/power/BiomassGenerator';
import { PowerSimulation } from '../../src/power/PowerSimulation';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

const position = { x: 0, y: 0, z: 0 };
const items = createDefaultItemRegistry();
const deposit: ResourceDeposit = { id: 'd', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: 1, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
const miner = (id = 'm') => new Miner(id, 'd', 'iron-ore', () => deposit, items);
function setup(fuel = 1) {
  const sim = new PowerSimulation(10), gen = new BiomassGenerator('g', items), machine = miner();
  if (fuel) gen.fuel.addItem('wood', fuel); sim.addPole('p', position); sim.addGenerator(gen, position); sim.addConsumer(machine, position, 10_000);
  sim.connect('p', 'g'); sim.connect('p', 'm');
  return { sim, gen, machine };
}

describe('biomass and electrical machine simulation', () => {
  it('transfers bounded wood safely and preserves an already burning item', () => {
    const gen = new BiomassGenerator('g', items), player = new Inventory(items, 1);
    player.addItem('wood', 100); expect(gen.feed(player).moved).toBe(100);
    expect(gen.burn(1000)).toBe(1000); expect(gen.remainingMs).toBe(29000);
    expect(gen.retrieveFuel(player).moved).toBe(99); expect(gen.fuelTimeMs).toBe(29000);
    gen.setEnabled(false); expect(gen.burn(500)).toBe(0); expect(gen.remainingMs).toBe(29000);
    expect(() => gen.burn(-1)).toThrow(RangeError);
  });
  it('stops exactly at exhaustion even within a large tick and resumes after refuelling', () => {
    const { sim, gen, machine } = setup();
    sim.fixedUpdate(40000);
    expect(machine.output.getItemCount('iron-ore')).toBe(15);
    expect(gen.fuelTimeMs).toBe(0); expect(machine.state).toBe('NO_POWER');
    expect(sim.networkFor('m')).toMatchObject({ status: 'offline', demandWatts: 10000, suppliedWatts: 0 });
    gen.fuel.addItem('wood', 1); sim.fixedUpdate(2000);
    expect(machine.output.getItemCount('iron-ore')).toBe(16); expect(gen.remainingMs).toBe(28000);
  });
  it('does not burn fuel while disconnected, disabled, idle or overloaded', () => {
    const { sim, gen, machine } = setup();
    sim.disconnect('p', 'm'); sim.fixedUpdate(1000); expect(gen.fuelTimeMs).toBe(BIOMASS.burnMs); expect(machine.state).toBe('NO_POWER');
    sim.connect('p', 'm'); machine.setEnabled(false); sim.fixedUpdate(1000); expect(gen.fuelTimeMs).toBe(BIOMASS.burnMs);
    machine.setEnabled(true); const other = miner('other'); sim.addConsumer(other, position, 25000); sim.connect('p', 'other');
    sim.fixedUpdate(1000); expect(sim.networkFor('p').status).toBe('overloaded'); expect(gen.fuelTimeMs).toBe(BIOMASS.burnMs);
    expect(machine.state).toBe('NO_POWER'); expect(other.state).toBe('NO_POWER');
    other.setEnabled(false); sim.fixedUpdate(1000); expect(gen.remainingMs).toBe(29000); expect(machine.state).toBe('RUNNING');
  });
  it('merges and splits networks and handles parallel generators at exhaustion boundaries', () => {
    const { sim, gen, machine } = setup(); const other = new BiomassGenerator('h', items);
    other.fuel.addItem('wood', 2); sim.addPole('q', position); sim.addGenerator(other, position); sim.connect('q', 'h');
    sim.connect('p', 'q'); sim.fixedUpdate(30000);
    expect(gen.fuelTimeMs).toBe(0); expect(other.fuelTimeMs).toBe(30000); expect(machine.powered).toBe(true);
    expect(sim.networkFor('p')).toMatchObject({ capacityWatts: 60000, availableWatts: 30000, status: 'online' });
    sim.disconnect('p', 'q'); sim.fixedUpdate(2000); expect(machine.state).toBe('NO_POWER'); expect(other.fuelTimeMs).toBe(30000);
    sim.connect('p', 'q'); sim.fixedUpdate(2000); expect(machine.state).toBe('RUNNING');
    sim.remove('q'); sim.refresh(); expect(machine.state).toBe('NO_POWER'); expect(sim.networkFor('h').status).toBe('isolated');
  });
  it('preserves processor progress and ingredients during a power loss', () => {
    const { sim, gen } = setup(0), c = new ConstructorMachine('c', items, createDefaultRecipeRegistry(items).get('iron-plate'));
    c.input.addItem('iron-ingot', 3); sim.addConsumer(c, position, 10000); sim.connect('p', 'c');
    sim.fixedUpdate(5000); expect(c.state).toBe('NO_POWER'); expect(c.input.getItemCount('iron-ingot')).toBe(3);
    gen.fuel.addItem('wood', 1); sim.fixedUpdate(1000); expect(c.progress).toBe(.5);
    sim.disconnect('p', 'c'); sim.fixedUpdate(5000); expect(c.progress).toBe(.5); expect(c.output.getItemCount('iron-plate')).toBe(0);
    sim.connect('p', 'c'); sim.fixedUpdate(1000); expect(c.output.getItemCount('iron-plate')).toBe(1);
  });
  it('retains the smelter coal requirement in addition to electric power', () => {
    const { sim, gen } = setup(0), smelter = new Smelter('s', items, createDefaultRecipeRegistry(items).get('iron-ingot'));
    smelter.input.addItem('iron-ore', 2); smelter.fuel.addItem('coal', 2);
    sim.addConsumer(smelter, position, 10000); sim.connect('p', 's'); sim.fixedUpdate(5000);
    expect(smelter.fuel.getItemCount('coal')).toBe(2); expect(smelter.output.getItemCount('iron-ingot')).toBe(0);
    gen.fuel.addItem('wood', 1); sim.fixedUpdate(2000);
    expect(smelter.fuel.getItemCount('coal')).toBe(1); expect(smelter.output.getItemCount('iron-ingot')).toBe(1);
  });
  it('produces the same result for a long tick and equivalent smaller ticks', () => {
    const a = setup(), b = setup(); a.sim.fixedUpdate(45000);
    for (let i = 0; i < 45; i++) b.sim.fixedUpdate(1000);
    expect(a.machine.output.getItemCount('iron-ore')).toBe(b.machine.output.getItemCount('iron-ore'));
    expect(a.machine.progress).toBe(b.machine.progress); expect(a.gen.fuelTimeMs).toBe(b.gen.fuelTimeMs);
    expect(a.sim.networkFor('m')).toEqual(b.sim.networkFor('m'));
  });
  it('validates time and duplicate nodes and can remove consumers safely', () => {
    const { sim, machine } = setup(); expect(() => sim.fixedUpdate(-1)).toThrow(RangeError);
    expect(() => sim.fixedUpdate(Infinity)).toThrow(RangeError); expect(() => sim.addPole('m', position)).toThrow(RangeError);
    sim.fixedUpdate(0); expect(machine.powered).toBe(true); expect(sim.remove('m')).toBe(true); expect(machine.powered).toBe(false);
    expect(sim.remove('m')).toBe(false);
  });
});
