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

it('does not treat the empty rounded corner outside a voxel as a solid overlap', () => {
  const voxel = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10,
    blockSize: 1, bottomLevel: -1, sampleHeight: (x, z) => x >= 5 && z >= 5 ? 1 : 0 });
  const collision = new VoxelCollision(voxel, NO_OBSTACLES);
  // Each axis is within the radius, but the Euclidean distance to the corner is larger than it.
  const result = collision.moveCircle(4.7, 4.7, -.2, 0, .4, 0, 1.8);
  expect(result.blocked).toBe(false);
  expect(result.x).toBeCloseTo(4.5); expect(result.z).toBeCloseTo(4.7);
});

it('allows outward recovery from a genuine small wall overlap without teleporting', () => {
  const collision = new VoxelCollision(terrain(), NO_OBSTACLES);
  const result = collision.moveCircle(4.61, 5.5, -.2, 0, .4, 0, 1.8);
  expect(result.blocked).toBe(false); expect(result.x).toBeCloseTo(4.41); expect(result.z).toBe(5.5);
  const inward = collision.moveCircle(4.61, 5.5, .2, .3, .4, 0, 1.8);
  expect(inward.x).toBeCloseTo(4.61); expect(inward.z).toBeCloseTo(5.8);
});

it('lets a player already overlapping a voxel move back onto level ground', () => {
  const voxel = terrain(), config = createGameConfig();
  const p = new PlayerController({ controls: config.controls, player: config.player, terrain: voxel,
    obstacles: new VoxelCollision(voxel, NO_OBSTACLES), spawn: { x: 5.01, z: 5.5, y: 0 } });
  for (let i = 0; i < 20; i++) p.step(.05, { ...input, moveX: -1 });
  expect(p.position.x).toBeLessThan(4.6); expect(p.position.y).toBe(0);
});

it.each([[-1, -1], [-1, 1], [1, -1], [1, 1]])('moves freely past the empty outer corner in quadrant %i,%i', (sx, sz) => {
  const voxel = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10, blockSize: 1, bottomLevel: -1,
    sampleHeight: (x, z) => x >= 5 && x < 6 && z >= 5 && z < 6 ? 1 : 0 });
  const cx = sx < 0 ? 5 : 6, cz = sz < 0 ? 5 : 6;
  const collision = new VoxelCollision(voxel, NO_OBSTACLES);
  const startX = cx + sx * .3, startZ = cz + sz * .3;
  const out = collision.moveCircle(startX, startZ, sx * .15, sz * .15, .4, 0, 1.8);
  expect(out.blocked).toBe(false);
  expect(out.x).toBeCloseTo(startX + sx * .15); expect(out.z).toBeCloseTo(startZ + sz * .15);
});

it('sweeps and slides against a rounded corner without entering the solid', () => {
  const voxel = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10, blockSize: 1, bottomLevel: -1,
    sampleHeight: (x, z) => x >= 5 && x < 6 && z >= 5 && z < 6 ? 1 : 0 });
  const collision = new VoxelCollision(voxel, NO_OBSTACLES);
  const hit = collision.moveCircle(3, 4.7, 4, 0, .4, 0, 1.8);
  expect(hit.collided).toBe(true); expect(hit.blocked).toBe(false);
  const nearestX = Math.max(5, Math.min(6, hit.x)), nearestZ = Math.max(5, Math.min(6, hit.z));
  expect(Math.hypot(hit.x - nearestX, hit.z - nearestZ)).toBeGreaterThanOrEqual(.4 - 1e-7);
  expect(hit.z).toBeLessThan(4.7); // slides around the corner rather than through it
  const headOn = collision.moveCircle(3, 5.5, 5, 0, .4, 0, 1.8);
  expect(headOn.x).toBeCloseTo(4.6); expect(headOn.z).toBeCloseTo(5.5);
});

it('allows diagonal travel around an isolated raised block without snagging', () => {
  const voxel = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10, blockSize: 1, bottomLevel: -1,
    sampleHeight: (x, z) => x >= 5 && x < 6 && z >= 5 && z < 6 ? 1 : 0 });
  const config = createGameConfig();
  const p = new PlayerController({ controls: config.controls, player: config.player, terrain: voxel,
    obstacles: new VoxelCollision(voxel, NO_OBSTACLES), spawn: { x: 4.7, z: 4.7, y: 0 } });
  for (let i = 0; i < 12; i++) p.step(.05, { ...input, moveX: -1, moveZ: 1 });
  expect(p.position.x).toBeLessThan(3.5); expect(p.position.z).toBeLessThan(3.5);
  expect(p.position.y).toBe(0);
});

it('does not end inside an isolated voxel during varied high-speed corner sweeps', () => {
  const voxel = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10, blockSize: 1, bottomLevel: -1,
    sampleHeight: (x, z) => x >= 5 && x < 6 && z >= 5 && z < 6 ? 1 : 0 });
  const collision = new VoxelCollision(voxel, NO_OBSTACLES);
  let state = 0x71a4b3;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const distance = (x: number, z: number) => Math.hypot(x - Math.max(5, Math.min(6, x)), z - Math.max(5, Math.min(6, z)));
  for (let i = 0; i < 1500; i++) {
    const angle = random() * Math.PI * 2, r = .41 + random() * 3;
    const x = 5.5 + Math.cos(angle) * r, z = 5.5 + Math.sin(angle) * r;
    if (distance(x, z) < .4) continue;
    const result = collision.moveCircle(x, z, (random() - .5) * 8, (random() - .5) * 8, .4, 0, 1.8);
    expect(distance(result.x, result.z)).toBeGreaterThanOrEqual(.4 - 1e-6);
  }
});

it('recovers through the full building and voxel collision composition used by the game', () => {
  const voxel = new VoxelTerrain({ originX: 0, originZ: 0, columnsX: 10, columnsZ: 10, blockSize: 1, bottomLevel: -1,
    sampleHeight: (x, z) => x >= 5 && z >= 5 ? 1 : 0 });
  const config = createGameConfig(), items = createDefaultItemRegistry(), inventory = new Inventory(items, 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), inventory, voxel, [], 1, 40);
  const p = new PlayerController({ controls: config.controls, player: config.player, terrain: new BuildingTerrain(voxel, buildings),
    obstacles: new BuildingCollision(new VoxelCollision(voxel, NO_OBSTACLES), buildings), spawn: { x: 4.7, z: 4.7, y: 0 } });
  for (let i = 0; i < 12; i++) p.step(.05, { ...input, moveX: -1, moveZ: 1 });
  expect(p.position.x).toBeLessThan(3.5); expect(p.position.z).toBeLessThan(3.5); expect(p.isGrounded).toBe(true);
});
