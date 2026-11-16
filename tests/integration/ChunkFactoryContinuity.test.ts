import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { createGameConfig } from '../../src/core/Configuration';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { GroundItems } from '../../src/logistics/GroundItems';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import { PowerManager } from '../../src/power/PowerManager';
import { ChunkManager } from '../../src/world/ChunkManager';
import { createWorld } from '../../src/world/World';

describe('factory continuity across chunk changes', () => {
  it('keeps a powered foundry-to-constructor belt line and storage active while its chunks are absent', () => {
    const config = createGameConfig({ world: { sizeMeters: 80, resolution: 32, heightScale: 0, rimHeight: 0, obstacleCount: 0 } });
    const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24);
    const base = createWorld(config, inventory);
    // An unobstructed test fixture uses the production placement rules and a real flat voxel world.
    const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, base.terrain, [], 1, 39, []);
    buildings.setCreativeMode(true);
    const world = { ...base, buildings };
    const chunks = new ChunkManager(world, 4);
    const far = { x: 1000, z: 1000, radius: .4 };
    const place = (type: string, x: number, z: number) => {
      const result = buildings.place(type, x, z, 0, far);
      expect(result.reason, `${type} ${x},${z}`).toBe('valid'); return result.building!;
    };
    const left = place('conveyor-cell', -.5, 1.5), right = place('conveyor-cell', .5, 1.5);
    const foundry = place('foundry', 0, 0), bridge = place('conveyor-cell', -.5, -1.5);
    const constructor = place('constructor', 0, -3), output = place('conveyor-cell', -.5, -4.5);
    const terminal = place('receiving-terminal', 0, -6);
    place('power-pole', 3, -2); const generator = place('biomass-generator', 5, -2);
    const machines = new MachineManager(buildings, items, () => []), power = new PowerManager(buildings, machines, items);
    const ground = new GroundItems(() => 0);
    const logistics = new LogisticsManager(buildings, machines, items, () => false, 1, undefined, ground, power);
    logistics.sync(); const f = machines.advanced(foundry.id)!, c = machines.constructorMachine(constructor.id)!;
    expect(c.selectRecipe('steel-plate')).toBe(true);
    expect(logistics.network.get(bridge.id)!.source?.id).toBe(foundry.id);
    expect(logistics.network.get(bridge.id)!.receiver?.id).toBe(constructor.id);
    expect(logistics.network.get(output.id)!.receiver?.id).toBe(terminal.id);
    power.generator(generator.id)!.fuel.addItem('wood', 10);
    for (let i = 0; i < 8; i++) { ground.drop(`ore-${i}`, 'iron-ore', { x: -.5, y: .6, z: 1.5 }); ground.drop(`coal-${i}`, 'coal', { x: .5, y: .6, z: 1.5 }); }
    chunks.update(0, 0, 0);
    const current = world.terrain.columnAt(foundry.transform.x, foundry.transform.z)!;
    const cx = Math.floor(current.x / 4), cz = Math.floor(current.z / 4);
    expect(chunks.buildings(chunks.get(cx, cz)!)).toContain(foundry);
    chunks.update(-39, 39, 0); expect(chunks.get(cx, cz)).toBeUndefined();
    for (let i = 0; i < 2200; i++) { power.fixedUpdate(50); logistics.fixedUpdate(50); }
    expect(logistics.terminal(terminal.id)!.getItemCount('steel-plate')).toBe(8);
    expect(f.produced('steel-ingot')).toBe(8); expect(c.produced('steel-plate')).toBe(8);
    expect(ground.all()).toHaveLength(0);
    expect(logistics.network.get(left.id)!.items).toHaveLength(0); expect(logistics.network.get(right.id)!.items).toHaveLength(0);
    chunks.update(0, 0, 0);
    expect(chunks.buildings(chunks.get(cx, cz)!)).toContain(foundry);
    expect(machines.advanced(foundry.id)).toBe(f); expect(machines.constructorMachine(constructor.id)).toBe(c);
    expect(logistics.network.get(bridge.id)!.receiver?.id).toBe(constructor.id);
    expect(power.generator(generator.id)!.fuelTimeMs).toBeLessThan(300000);
    expect(buildings.all()).toHaveLength(9);
  });
});
