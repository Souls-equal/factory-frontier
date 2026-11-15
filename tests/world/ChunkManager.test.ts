import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { ChunkManager } from '../../src/world/ChunkManager';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { MachineManager } from '../../src/machines/MachineManager';
import { PowerManager } from '../../src/power/PowerManager';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';

const config = createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 4 } });
const ids = (items: readonly { readonly id: string }[]) => items.map(item => item.id).sort();

describe('world chunk manager', () => {
  it('partitions metadata by centre without duplicates, including partial edge chunks', () => {
    const world = createWorld(config), chunks = new ChunkManager(world, 7);
    expect(chunks.update(0, 0, 1000).loaded.length).toBe(144);
    const all = chunks.all();
    expect(new Set(ids(all)).size).toBe(all.length);
    expect(ids(all.flatMap(c => c.deposits))).toEqual(ids(world.deposits));
    expect(ids(all.flatMap(c => c.gatherables))).toEqual(ids(world.gatherables.definitions));
    expect(ids(all.flatMap(c => c.obstacles))).toEqual(ids(world.obstacleDefinitions));
    expect(ids(all.flatMap(c => c.interactables))).toEqual(ids(world.interactables));
    const edge = chunks.get(11, 11)!;
    expect(edge.range).toEqual({ minX: 77, maxX: 80, minZ: 77, maxZ: 80 });
    expect(edge.centreBiome).toBe(world.biomes.at((edge.bounds.minX + edge.bounds.maxX) / 2, (edge.bounds.minZ + edge.bounds.maxZ) / 2));
    expect(chunks.update(0, 0, 1000)).toEqual({ loaded: [], unloaded: [] });
    expect(chunks.update(NaN, 0, 0)).toEqual({ loaded: [], unloaded: [] });
    expect(chunks.all()).toHaveLength(144);
    chunks.clear(); expect(chunks.all()).toHaveLength(0);
    expect(chunks.update(0, 0, 1000).loaded).toHaveLength(144);
  });

  it('regenerates the same metadata after unload, independently of visit order', () => {
    const a = createWorld(config), b = createWorld(config), first = new ChunkManager(a, 8), second = new ChunkManager(b, 8);
    first.update(-35, -35, 0);
    const original = first.get(0, 0)!;
    first.update(35, 35, 0);
    expect(first.get(0, 0)).toBeUndefined();
    first.update(-35, -35, 0); second.update(35, 35, 0); second.update(-35, -35, 0);
    expect(first.get(0, 0)).toEqual(original);
    expect(first.get(0, 0)).not.toBe(original);
    expect(first.get(0, 0)).toEqual(second.get(0, 0));
    expect(() => new ChunkManager(a, 0)).toThrow(RangeError);
  });

  it('returns live building footprints including buildings crossing a chunk border', () => {
    const world = createWorld(config), chunks = new ChunkManager(world, 1);
    world.buildings.setCreativeMode(true);
    const far = { x: 1000, z: 1000, radius: .4 };
    let building: ReturnType<typeof world.buildings.place>['building'];
    for (let z = -15; z < 15 && !building; z++) for (let x = -15; x < 15 && !building; x++)
      building = world.buildings.place('foundation', x, z, 0, far).building;
    expect(building).toBeDefined();
    chunks.update(building!.transform.x, building!.transform.z, 3);
    const containing = chunks.all().filter(c => chunks.buildings(c).some(b => b.id === building!.id));
    expect(containing.length).toBeGreaterThan(1);
    expect(world.buildings.demolish(building!.id)).toBe('removed');
    expect(containing.every(c => chunks.buildings(c).length === 0)).toBe(true);
  });

  it('keeps a powered machine, fuel, transported item and gathered resource when a chunk unloads', () => {
    const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24), world = createWorld(config, inventory);
    const far = { x: 1000, z: 1000, radius: .4 };
    world.buildings.setCreativeMode(true);
    // Find a clear, level site in the actual generated world without modifying placement rules.
    let machineBuilding: ReturnType<typeof world.buildings.place>['building'];
    let belt: ReturnType<typeof world.buildings.place>['building'];
    for (let z = -20; z <= 20 && !belt; z++) for (let x = -20; x <= 20 && !belt; x++) {
      const m = world.buildings.place('constructor', x, z, 0, far);
      if (!m.building) continue;
      const c = world.buildings.place('conveyor-cell', m.transform.x - .5, m.transform.z - 1.5, 0, far);
      if (c.building) { machineBuilding = m.building; belt = c.building; }
      else world.buildings.demolish(m.building.id);
    }
    expect(machineBuilding).toBeDefined(); expect(belt).toBeDefined();
    const placeNearby = (type: string, x: number, z: number) => {
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
        if (Math.hypot(dx, dz) > 6) continue;
        const result = world.buildings.place(type, x + dx, z + dz, 0, far);
        if (result.building) return result.building;
      }
      throw new Error(`No valid ${type} site`);
    };
    const pole = placeNearby('power-pole', machineBuilding!.transform.x, machineBuilding!.transform.z);
    const generator = placeNearby('biomass-generator', pole.transform.x, pole.transform.z);
    const machines = new MachineManager(world.buildings, items, () => world.deposits);
    const power = new PowerManager(world.buildings, machines, items);
    const logistics = new LogisticsManager(world.buildings, machines, items, () => false, 1, undefined, undefined, power);
    logistics.sync();
    const machine = machines.constructorMachine(machineBuilding!.id)!, gen = power.generator(generator.id)!;
    gen.fuel.addItem('wood', 3); machine.input.addItem('iron-ingot', 5);
    const branch = world.gatherables.definitions.find(d => d.kind === 'branch')!;
    expect(world.gatherables.interactables(inventory, 4).find(i => i.descriptor.id === branch.id)!.interact().ok).toBe(true);
    const chunks = new ChunkManager(world, 8), x = machineBuilding!.transform.x, z = machineBuilding!.transform.z;
    chunks.update(x, z, 0);
    const col = world.terrain.columnAt(x, z)!, cx = Math.floor(col.x / 8), cz = Math.floor(col.z / 8);
    expect(chunks.buildings(chunks.get(cx, cz)!)).toContain(machineBuilding);
    expect(logistics.network.insertDropped('manual-item', 'stone', belt!.id)).toBe(true);
    chunks.update(x < 0 ? 39 : -39, z < 0 ? 39 : -39, 0);
    expect(chunks.get(cx, cz)).toBeUndefined();
    // Keep the belt item on the same segment while production begins.
    power.fixedUpdate(50); logistics.fixedUpdate(50);
    expect(logistics.network.findItem('manual-item')).toBeDefined();
    for (let i = 0; i < 81; i++) { power.fixedUpdate(50); logistics.fixedUpdate(50); }
    expect(machine.produced('iron-plate')).toBeGreaterThan(0);
    expect(gen.fuelTimeMs).toBeGreaterThan(0);
    chunks.update(x, z, 0);
    expect(chunks.buildings(chunks.get(cx, cz)!)).toContain(machineBuilding);
    expect(machines.constructorMachine(machineBuilding!.id)).toBe(machine);
    expect(world.gatherables.active(branch.id)).toBe(false);
    expect(logistics.network.get(belt!.id)).toBeDefined();
    expect(logistics.network.findItem('manual-item')).toBeDefined();
  });
});
