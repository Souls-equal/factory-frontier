import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { PlayerController, NO_OBSTACLES } from '../../src/player/PlayerController';
import { VoxelCollision } from '../../src/world/terrain/VoxelCollision';
import { ObstacleField } from '../../src/world/ObstacleField';
import { VoxelTerrain } from '../../src/world/terrain/VoxelTerrain';
import { terrainSupport } from '../../src/buildings/TerrainSupport';
import { BuildingTerrain } from '../../src/buildings/BuildingTerrain';
import { BuildingCollision } from '../../src/buildings/BuildingCollision';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

function terrain() { return new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10,
  blockSize: 1, bottomLevel: -1, sampleHeight: (x) => x >= 5 ? 1 : 0 }); }
const input = { moveX: 1, moveZ: 0, sprint: false, lookDeltaX: 0, lookDeltaY: 0 };
function player() {
  const voxel = terrain(), config = createGameConfig();
  const items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, voxel, [], 1, 40);
  const collisions = new BuildingCollision(new VoxelCollision(voxel, NO_OBSTACLES), buildings);
  return new PlayerController({ controls: config.controls, player: config.player,
    terrain: new BuildingTerrain(voxel, buildings), obstacles: collisions, spawn: { x: 3, z: 5.5, y: 0 } });
}

describe('voxel movement and placement', () => {
  it('blocks sustained walking against a one-block wall without pushing through', () => {
    const p = player();
    for (let i = 0; i < 60; i++) p.step(.05, input);
    expect(p.position.x).toBeCloseTo(4.6, 5); expect(p.position.y).toBe(0);
    expect(p.horizontalSpeed).toBeLessThan(.001);
  });
  it('jumps onto a one-metre ledge, lands, and remains supported', () => {
    const p = player();
    for (let i = 0; i < 20; i++) p.step(.05, input);
    p.step(.05, { ...input, jump: true });
    for (let i = 0; i < 25; i++) p.step(.05, { ...input, jump: false });
    expect(p.position.x).toBeGreaterThan(5); expect(p.position.y).toBe(1);
    expect(p.isGrounded).toBe(true);
  });
  it('sweeps high-speed movement and slides along the wall', () => {
    const collision = new VoxelCollision(terrain(), NO_OBSTACLES);
    const result = collision.moveCircle(3, 2, 5, 3, .4, 0, 1.8);
    expect(result.x).toBeCloseTo(4.6, 6); expect(result.z).toBeCloseTo(5, 6);
    expect(result.collided).toBe(true);
    const over = collision.moveCircle(3, 2, 5, 3, .4, 1, 2.8);
    expect(over.x).toBe(8); expect(over.z).toBe(5);
  });
  it('slides along adjacent columns without snagging at their seams', () => {
    const voxel = terrain(), config = createGameConfig();
    const p = new PlayerController({ controls: config.controls, player: config.player, terrain: voxel,
      obstacles: new VoxelCollision(voxel, NO_OBSTACLES), spawn: { x: 4, z: 1.5, y: 0 } });
    for (let i = 0; i < 20; i++) p.step(.05, { ...input, moveZ: -1 });
    expect(p.position.x).toBeLessThanOrEqual(4.600001);
    expect(p.position.z).toBeGreaterThan(4);
  });
  it('keeps natural obstacles active when composed with voxel walls', () => {
    const rock = new ObstacleField([{ id: 'rock', kind: 'boulder', x: 2, y: 0, z: 3,
      radius: .5, height: 2, yaw: 0, variant: 0 }]);
    const collision = new VoxelCollision(terrain(), rock);
    const result = collision.moveCircle(2, 5, 0, -4, .4, 0, 1.8);
    expect(result.collided).toBe(true); expect(result.z).toBeGreaterThanOrEqual(3.9 - 1e-6);
  });
  it('falls and lands when walking down from a higher column', () => {
    const voxel = terrain(), config = createGameConfig();
    const p = new PlayerController({ controls: config.controls, player: config.player, terrain: voxel,
      obstacles: new VoxelCollision(voxel, NO_OBSTACLES), spawn: { x: 6.5, z: 5.5, y: 1 } });
    for (let i = 0; i < 20; i++) p.step(.05, { ...input, moveX: -1 });
    expect(p.position.x).toBeLessThan(5); expect(p.position.y).toBe(0); expect(p.isGrounded).toBe(true);
  });
  it('lands on a ledge when only the player footprint overlaps its top', () => {
    const voxel = terrain();
    expect(voxel.groundBelow(4.8, 5.5, 1.1, .4)).toBe(1);
    expect(voxel.groundBelow(4.8, 5.5, .5, .4)).toBe(0);
    expect(voxel.groundBelow(4.4, 5.5, 1.1, .4)).toBe(0);
  });
  it('does not climb a two-block wall by jumping', () => {
    const voxel = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10,
      blockSize: 1, bottomLevel: -1, sampleHeight: (x) => x >= 5 ? 2 : 0 });
    const config = createGameConfig();
    const p = new PlayerController({ controls: config.controls, player: config.player, terrain: voxel,
      obstacles: new VoxelCollision(voxel, NO_OBSTACLES), spawn: { x: 3, z: 5.5, y: 0 } });
    for (let i = 0; i < 20; i++) p.step(.05, input);
    p.step(.05, { ...input, jump: true });
    for (let i = 0; i < 30; i++) p.step(.05, { ...input, jump: false });
    expect(p.position.x).toBeLessThanOrEqual(4.600001); expect(p.position.y).toBe(0);
  });
  it('samples only columns with positive-area overlap for building support', () => {
    const voxel = terrain();
    expect(terrainSupport(voxel, { minX: 3, maxX: 5, minZ: 2, maxZ: 4 })).toEqual({ low: 0, high: 0, slope: 0 });
    expect(terrainSupport(voxel, { minX: 4.99, maxX: 6, minZ: 2, maxZ: 4 })).toEqual({ low: 0, high: 1, slope: 0 });
  });
});
