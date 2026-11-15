import { describe, expect, it } from 'vitest';
import { snapFootprint } from '../../src/buildings/Transform';
import { terrainSupport } from '../../src/buildings/TerrainSupport';
import { createGameConfig, type GameConfig } from '../../src/core/Configuration';
import { createWorld, type World } from '../../src/world/World';
import { generateDeposits, DepositInteractable } from '../../src/resources/ResourceDeposit';
import { DEPOSIT_BIOME_PREFERENCES, distributeBiomeDeposits } from '../../src/resources/BiomeDeposits';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { MachineManager } from '../../src/machines/MachineManager';
import { PowerManager } from '../../src/power/PowerManager';

function baseline(world: World, config: GameConfig) {
  const terrain = world.terrain, miner = world.buildings.registry.get('miner-mk1');
  const suitable = (x: number, z: number) => {
    const f = snapFootprint(miner, x, z, 0, config.construction.gridSize).footprint;
    if (!terrain.contains(f.minX, f.minZ) || !terrain.contains(f.maxX, f.maxZ) ||
      [[f.minX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.minZ], [f.maxX, f.maxZ]]
        .some(([px, pz]) => Math.hypot(px!, pz!) > config.controls.playAreaRadius)) return false;
    const support = terrainSupport(terrain, f);
    return !!support && support.slope <= miner.maxSlope && support.high - support.low <= miner.maxGroundVariation;
  };
  const obstacles = world.obstacleDefinitions.filter(o => !o.id.startsWith('deposit-'));
  return { obstacles, suitable, deposits: generateDeposits(terrain, obstacles, config.world.seed, world.spawn,
    config.resources, config.controls.playAreaRadius, suitable) };
}

describe('biome-aware exploratory deposits', () => {
  it('preserves the first resource of every type and redistributes only valid secondary sites', () => {
    let moved = 0, preferred = 0;
    for (let seed = 0; seed < 15; seed++) {
      const config = createGameConfig({ world: { seed } }), items = createDefaultItemRegistry();
      const inventory = new Inventory(items, 24); inventory.addItem('stone', 100); inventory.addItem('wood', 100);
      const world = createWorld(config, inventory), old = baseline(world, config).deposits;
      const seen = new Set<string>();
      expect(world.deposits.length).toBe(old.length);
      for (let i = 0; i < old.length; i++) {
        const before = old[i]!, after = world.deposits[i]!;
        expect(after.id).toBe(before.id); expect(after.itemId).toBe(before.itemId);
        expect(after.purity).toBe(before.purity); expect(after.productionMultiplier).toBe(before.productionMultiplier);
        if (!seen.has(before.itemId)) { seen.add(before.itemId); expect(after).toEqual(before); }
        else if (after.x !== before.x || after.z !== before.z) {
          moved++;
          expect(DEPOSIT_BIOME_PREFERENCES[after.itemId]).toContain(world.biomes.at(after.x, after.z));
          expect(Math.hypot(after.x - world.spawn.x, after.z - world.spawn.z)).toBeGreaterThanOrEqual(30);
        }
        if (DEPOSIT_BIOME_PREFERENCES[after.itemId]!.includes(world.biomes.at(after.x, after.z))) preferred++;
        expect(world.buildings.validate('miner-mk1', after.x, after.z, 0, { x: 1000, z: 1000, radius: .4 }).reason,
          `seed ${seed}: ${after.id}`).toBe('valid');
      }
      expect(world.deposits).toEqual(createWorld(config).deposits);
    }
    expect(moved).toBeGreaterThan(40); expect(preferred).toBeGreaterThan(moved);
  }, 20000);
  it('keeps every original when no preferred biome, buildable location, or exploration area exists', () => {
    const config = createGameConfig(), world = createWorld(config), old = baseline(world, config);
    const original = JSON.stringify(old.deposits);
    const run = (biomes: { at: () => 'grassland' | 'highlands' }, radius: number, suitable: () => boolean) =>
      distributeBiomeDeposits(old.deposits, world.terrain, old.obstacles, biomes, config.world.seed, world.spawn, radius, suitable);
    expect(run({ at: () => 'grassland' }, 120, () => true)).toEqual(old.deposits);
    expect(run({ at: () => 'highlands' }, 120, () => false)).toEqual(old.deposits);
    expect(run({ at: () => 'highlands' }, 25, () => true)).toEqual(old.deposits);
    expect(JSON.stringify(old.deposits)).toBe(original);
  });
  it('preserves the baseline layout when configured for one deposit of each type', () => {
    const config = createGameConfig({ resources: { depositsPerType: 1 } }), world = createWorld(config);
    expect(world.deposits).toEqual(baseline(world, config).deposits);
  });
  it('runs a powered Miner on a relocated iron deposit at its original purity rate', () => {
    const config = createGameConfig(), items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
    const world = createWorld(config, inventory), old = baseline(world, config).deposits;
    const iron = world.deposits.find(d => d.id === 'deposit-iron-ore-1')!;
    const previous = old.find(d => d.id === iron.id)!;
    expect({ x: iron.x, z: iron.z }).not.toEqual({ x: previous.x, z: previous.z });
    world.buildings.setCreativeMode(true);
    const player = { x: 1000, z: 1000, radius: .4 };
    const placed = world.buildings.place('miner-mk1', iron.x, iron.z, 0, player);
    expect(placed.reason).toBe('valid');
    const machines = new MachineManager(world.buildings, items, () => world.deposits, config.miner);
    const power = new PowerManager(world.buildings, machines, items);
    const { x, z } = placed.transform;
    let generatorId: string | undefined;
    for (let dz = -7; dz <= 7 && !generatorId; dz++) for (let dx = -7; dx <= 7 && !generatorId; dx++) {
      const pole = world.buildings.place('power-pole', x + dx, z + dz, 0, player);
      if (pole.reason !== 'valid') continue;
      for (let gz = -3; gz <= 3 && !generatorId; gz++) for (let gx = -3; gx <= 3 && !generatorId; gx++) {
        const generator = world.buildings.place('biomass-generator', pole.transform.x + gx, pole.transform.z + gz, 0, player);
        if (generator.reason !== 'valid') continue;
        power.sync();
        const wires = power.wires();
        if (wires.some(w => w.b === placed.building!.id) && wires.some(w => w.b === generator.building!.id))
          generatorId = generator.building!.id;
        else expect(world.buildings.demolish(generator.building!.id)).toBe('removed');
      }
      if (!generatorId) expect(world.buildings.demolish(pole.building!.id)).toBe('removed');
    }
    expect(generatorId).toBeDefined();
    power.sync(); power.generator(generatorId!)!.fuel.addItem('wood', 1);
    power.fixedUpdate(10_000);
    const miner = machines.get(placed.building!.id)!;
    expect(miner.powered).toBe(true);
    expect(miner.produced).toBe(Math.floor(config.miner.baseRatePerMinute * iron.productionMultiplier * 10_000 / 60_000));
    expect(miner.output.getItemCount('iron-ore')).toBe(miner.produced);
    expect(miner.produced).toBeGreaterThan(0);
  });
  it('includes a biome label when a deposit is inspected without removing purity or extraction guidance', () => {
    const world = createWorld(createGameConfig()), deposit = world.deposits[0]!;
    const object = new DepositInteractable(deposit, createDefaultItemRegistry(), 4, () => true, 'highlands');
    expect(object.descriptor.hint).toContain('Biome: Highlands');
    expect(object.descriptor.hint).toContain(`Purity: ${deposit.purity.toUpperCase()}`);
    expect(object.descriptor.hint).toContain('Requires Miner');
  });
});
