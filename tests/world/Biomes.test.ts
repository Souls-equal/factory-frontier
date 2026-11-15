import { describe, expect, it } from 'vitest';
import { BiomeField, type Biome } from '../../src/world/Biomes';
import { createWorld } from '../../src/world/World';
import { createGameConfig } from '../../src/core/Configuration';
import { EnvironmentView } from '../../src/engine/EnvironmentView';
import { Group, Mesh } from 'three';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { generateGatherables } from '../../src/resources/Gatherables';

describe('phase 10 biome regions', () => {
  it('samples deterministically, independently of order, and varies with seed', () => {
    const first = new BiomeField(123, { x: 0, z: 9 });
    const again = new BiomeField(123, { x: 0, z: 9 });
    const other = new BiomeField(456, { x: 0, z: 9 });
    const points = Array.from({ length: 441 }, (_, i) => ({ x: (i % 21 - 10) * 10, z: (Math.floor(i / 21) - 10) * 10 }));
    const samples = points.map(p => first.at(p.x, p.z));
    expect(points.slice().reverse().map(p => again.at(p.x, p.z)).reverse()).toEqual(samples);
    expect(new Set(samples)).toEqual(new Set<Biome>(['grassland', 'forest', 'desert', 'highlands']));
    expect(points.map(p => other.at(p.x, p.z))).not.toEqual(samples);
    expect(first.at(0, 9)).toBe('grassland');
    const defaults = new BiomeField(20261111, { x: 0, z: 9 });
    const accessible = points.filter(p => Math.hypot(p.x, p.z) < 115);
    expect(new Set(accessible.map(p => defaults.at(p.x, p.z)))).toEqual(new Set<Biome>(['grassland', 'forest', 'desert', 'highlands']));
    expect(() => first.at(NaN, 0)).toThrow(RangeError);
  });
  it('applies biome materials to actual terrain geometry without changing collision', () => {
    const world = createWorld(createGameConfig({ world: { seed: 123, obstacleCount: 0 } }));
    const before = world.terrain.getRenderData();
    const view = new EnvironmentView(world);
    const chunks = (view.group.getObjectByName('environment:terrain') as Group).children as Mesh[];
    const used = new Set<number>();
    let total = 0;
    for (const mesh of chunks) {
      const region = world.terrain.getRenderData(mesh.userData.range), uv = mesh.geometry.getAttribute('uv');
      for (let face = 0; face < region.faceCount; face++) used.add(Math.floor(uv.getX(face * 4) * 8));
      expect(mesh.geometry.getAttribute('position').array).toEqual(region.positions); total += region.faceCount;
    }
    expect(total).toBe(before.faceCount);
    expect(used.has(0)).toBe(true); expect(used.has(3)).toBe(true); expect(used.has(4)).toBe(true);
    expect(used.has(5)).toBe(true); expect(used.has(6)).toBe(true); expect(used.has(7)).toBe(true);
    view.dispose();
  });
  it('collects wild objects and updates state through the existing interaction system', () => {
    const world = createWorld(createGameConfig({ world: { seed: 123 } }));
    const wild = world.gatherables.definitions.find(d => d.id.startsWith('gatherable-wild-'))!;
    const inventory = new Inventory(createDefaultItemRegistry(), 4);
    const interaction = world.gatherables.interactables(inventory, 3.6).find(i => i.descriptor.id === wild.id)!;
    while (interaction.isAvailable()) expect(interaction.interact().ok).toBe(true);
    expect(inventory.getItemCount(wild.itemId)).toBe(wild.quantity);
    expect(world.gatherables.placementObstacles().some(o => o.id === wild.id)).toBe(false);
  });
  it('adds deterministic, collectable wild resources biased by biome outside the starter clearing', () => {
    const counts = new Map<Biome, { tree: number; stone: number }>();
    for (let seed = 0; seed < 12; seed++) {
      const config = createGameConfig({ world: { seed } });
      const world = createWorld(config);
      const wild = world.gatherables.definitions.filter(d => d.id.startsWith('gatherable-wild-'));
      const oldStarters = generateGatherables(world.terrain, world.obstacleDefinitions, world.deposits, seed, world.spawn, config.controls.playAreaRadius);
      expect(world.gatherables.definitions.slice(0, oldStarters.length)).toEqual(oldStarters);
      expect(wild).toEqual(createWorld(config).gatherables.definitions.filter(d => d.id.startsWith('gatherable-wild-')));
      expect(wild.length).toBeLessThanOrEqual(24);
      for (const object of wild) {
        expect(Math.hypot(object.x - world.spawn.x, object.z - world.spawn.z)).toBeGreaterThanOrEqual(30);
        const biome = world.biomes.at(object.x, object.z);
        const count = counts.get(biome) ?? { tree: 0, stone: 0 };
        if (object.kind === 'tree') count.tree++; else if (object.kind === 'stone') count.stone++;
        counts.set(biome, count);
        expect(world.gatherables.active(object.id)).toBe(true);
      }
    }
    expect(counts.get('forest')!.tree).toBeGreaterThan(counts.get('forest')!.stone);
    expect(counts.get('highlands')!.stone).toBeGreaterThan(counts.get('highlands')!.tree);
    expect(counts.get('desert')!.tree).toBe(0);
    expect(counts.get('desert')!.stone).toBeGreaterThan(0);
  }, 15000);
});
