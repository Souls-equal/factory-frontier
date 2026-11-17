import { describe, expect, it, vi } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { TerrainChunkView } from '../../src/engine/TerrainChunkView';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { MachineManager } from '../../src/machines/MachineManager';
import { Engine } from '../../src/engine/Engine';
import { FakeRenderBackend } from '../helpers/FakeRenderBackend';

const config = createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } });
const names = (view: TerrainChunkView) => view.group.children.map(c => c.name).sort();

describe('terrain chunk streaming', () => {
  it('loads and unloads without duplicates, preserves shared material and exactly recreates geometry and colours', () => {
    const world = createWorld(config), view = new TerrainChunkView(world, 3, 8);
    const focus = { x: -25, z: -25 }; view.setFocus(focus.x, focus.z);
    const first = names(view), mesh = view.group.children[0] as Mesh;
    const geometry = mesh.geometry, pos = geometry.getAttribute('position').array.slice(),
      colors = geometry.getAttribute('color').array.slice(), uv = geometry.getAttribute('uv').array.slice();
    const id = mesh.name, material = mesh.material as MeshStandardMaterial;
    const disposal = vi.spyOn(geometry, 'dispose'), materialDisposal = vi.spyOn(material, 'dispose');
    view.setFocus(-24.9, -24.9); expect(names(view)).toEqual(first);
    view.setFocus(35, 35); expect(names(view)).not.toContain(id); expect(disposal).toHaveBeenCalledOnce();
    expect(materialDisposal).not.toHaveBeenCalled();
    expect(new Set(names(view)).size).toBe(names(view).length);
    view.setFocus(focus.x, focus.z);
    const restored = view.group.getObjectByName(id) as Mesh;
    expect(restored).toBeDefined(); expect(restored.geometry).not.toBe(geometry);
    expect(restored.geometry.getAttribute('position').array).toEqual(pos);
    expect(restored.geometry.getAttribute('color').array).toEqual(colors);
    expect(restored.geometry.getAttribute('uv').array).toEqual(uv);
    expect(restored.material).toBe(material); expect(names(view)).toEqual(first);
    view.dispose(); expect(materialDisposal).toHaveBeenCalledOnce();
  });
  it('covers the full fog radius while moving across chunk edges and respects finite bounds', () => {
    const world = createWorld(config), view = new TerrainChunkView(world, 10, 8);
    for (const [x, z] of [[-39, -39], [-.001, 0], [0, 0], [7.999, 8], [39, 39]]) {
      view.setFocus(x!, z!);
      const t = world.terrain;
      for (let dz = -10; dz <= 10; dz += 2) for (let dx = -10; dx <= 10; dx += 2) {
        if (Math.hypot(dx, dz) > 10) continue;
        const col = t.columnAt(x! + dx, z! + dz); if (!col) continue;
        expect(view.group.getObjectByName(`environment:terrain:${Math.floor(col.x / 8)},${Math.floor(col.z / 8)}`)).toBeDefined();
      }
    }
    view.setFocus(0, 0, 3); const nearCount = view.group.children.length;
    view.setFocus(0, 0, 30); expect(view.group.children.length).toBeGreaterThan(nearCount);
    view.dispose();
  });
  it('leaves buildings, collected resources and active production intact when their terrain is unloaded', () => {
    const items = createDefaultItemRegistry(), inventory = new Inventory(items, 24), world = createWorld(config, inventory);
    world.buildings.setCreativeMode(true);
    const far = { x: 1000, z: 1000, radius: .4 };
    let placed: ReturnType<typeof world.buildings.place> | undefined;
    for (let z = -15; z < 20 && !placed; z++) for (let x = -15; x < 15; x++) {
      const result = world.buildings.place('constructor', x, z, 0, far);
      if (result.reason === 'valid') { placed = result; break; }
    }
    expect(placed?.building).toBeDefined();
    const machines = new MachineManager(world.buildings, items, () => world.deposits); machines.sync();
    const machine = machines.constructorMachine(placed!.building!.id)!;
    machine.input.addItem('iron-ingot', 3);
    const branch = world.gatherables.definitions.find(d => d.kind === 'branch')!;
    const target = world.gatherables.interactables(inventory, 4).find(i => i.descriptor.id === branch.id)!;
    expect(target.interact().ok).toBe(true); expect(world.gatherables.active(branch.id)).toBe(false);
    const view = new TerrainChunkView(world, 3, 8), { x, z } = placed!.transform;
    view.setFocus(x, z);
    const col = world.terrain.columnAt(x, z)!;
    const name = `environment:terrain:${Math.floor(col.x / 8)},${Math.floor(col.z / 8)}`;
    expect(view.group.getObjectByName(name)).toBeDefined();
    view.setFocus(x < 0 ? 39 : -39, z < 0 ? 39 : -39);
    expect(view.group.getObjectByName(name)).toBeUndefined();
    machines.fixedUpdate(4000);
    expect(machine.produced('iron-plate')).toBe(2); expect(machine.input.getItemCount('iron-ingot')).toBe(1);
    view.setFocus(x, z);
    expect(view.group.getObjectByName(name)).toBeDefined();
    expect(world.buildings.get(placed!.building!.id)).toBe(placed!.building);
    expect(machines.constructorMachine(placed!.building!.id)).toBe(machine);
    expect(world.gatherables.active(branch.id)).toBe(false);
    view.dispose();
  });
  it('connects the real engine camera pose to terrain streaming', () => {
    const cfg = createGameConfig({ world: { sizeMeters: 240, obstacleCount: 0 }, render: { fogNear: 0, fogFar: 4 } });
    const world = createWorld(cfg), engine = new Engine({ config: cfg, world, renderer: new FakeRenderBackend() });
    const group = engine.scene.getObjectByName('environment:terrain')!;
    const before = group.children.map(c => c.name).sort();
    engine.applyView({ position: { x: 110, y: 10, z: 110 }, yaw: 0, pitch: 0 });
    expect(group.children.map(c => c.name).sort()).not.toEqual(before);
    const normalCount = group.children.length;
    engine.resize(20000, 200, 1);
    engine.applyView({ position: { x: 110, y: 10, z: 110 }, yaw: 0, pitch: 0 });
    expect(group.children.length).toBeGreaterThan(normalCount);
    engine.dispose();
  });
});

it('applies a player-selected fog distance to real engine streaming transitions', async () => {
  const { viewDistanceOverride } = await import('../../src/core/ViewDistance');
  const cfg = createGameConfig({ world: { sizeMeters: 240, obstacleCount: 0 },
    render: viewDistanceOverride(new URLSearchParams('viewDistance=24')) });
  const world = createWorld(cfg), engine = new Engine({ config: cfg, world, renderer: new FakeRenderBackend() });
  const terrain = engine.scene.getObjectByName('environment:terrain')!;
  const view = (x: number, z: number) => engine.applyView({ position: { x, y: 10, z }, yaw: 0, pitch: 0 });
  view(-110, -110);
  expect(terrain.getObjectByName('environment:terrain:0,0')).toBeDefined();
  view(110, 110);
  expect(terrain.getObjectByName('environment:terrain:0,0')).toBeUndefined();
  view(-110, -110);
  expect(terrain.getObjectByName('environment:terrain:0,0')).toBeDefined();
  engine.dispose();
});
