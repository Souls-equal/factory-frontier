// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { World } from '../../src/world/World';
import type { GroundItem } from '../../src/logistics/GroundItems';
import { transportPosition, type ConveyorSegment } from '../../src/logistics/ConveyorNetwork';
import type { InventoryReceiver } from '../../src/logistics/Ports';
import type { CameraView } from '../../src/engine/types';
import { createGameConfig } from '../../src/core/Configuration';

const state = vi.hoisted(() => ({ world: null as World | null, segments: [] as readonly ConveyorSegment[], ground: [] as readonly GroundItem[], view: null as CameraView | null, init: 0, sawItem: false }));
vi.mock('../../src/items/Inventory', async (load) => {
  const actual = await load<typeof import('../../src/items/Inventory')>();
  class Stocked extends actual.Inventory {
    constructor(...args: ConstructorParameters<typeof actual.Inventory>) {
      super(...args);
      if (args[1] === 24) { this.addItem('iron-ore', 50); this.addItem('stone', 50); this.addItem('wood', 50); }
    }
  }
  return { ...actual, Inventory: Stocked };
});
vi.mock('../../src/engine/Engine', () => ({ Engine: { create: (_canvas: unknown, _config: unknown, world: World) => {
  state.world = world;
  return { init: () => { state.init++; }, resize: () => {}, applyView: (view: CameraView) => { state.view = view; }, setHighlight: () => {}, render: () => {},
    initBuildings: () => {}, syncBuildings: () => {}, setBuildingPreview: () => {}, setMachineStates: () => {},
    syncConveyors: (segments: readonly ConveyorSegment[], _alpha: number, ground: readonly GroundItem[]) => { state.segments = segments; state.ground = ground; if (segments.some((s) => s.items.length)) state.sawItem = true; },
    dispose: () => {}, stats: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 } };
} } }));
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
let frames: Array<(time: number) => void> = [], time = 0;
function frame() { time += 50; const next = frames.shift(); if (!next) throw new Error('Missing scheduled frame'); next(time); }
beforeEach(() => {
  vi.resetModules(); state.world = null; state.segments = []; state.ground = []; state.view = null; state.init = 0; state.sawItem = false; frames = []; time = 0;
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: (time: number) => void) => { frames.push(callback); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { window.dispatchEvent(new Event('beforeunload')); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('real bootstrap registers and runs the building-backed miner-to-receiver path (mock renderer)', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const world = state.world!, deposit = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const player = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, player);
  expect(miner.reason).toBe('valid'); const x = miner.transform.x, z = miner.transform.z;
  const belt = world.buildings.place('conveyor-straight', x, z - 2, 0, player);
  expect(belt.reason).toBe('valid');
  const terminal = world.buildings.place('receiving-terminal', x, z - 4, 0, player);
  expect(terminal.reason).toBe('valid');
  for (let i = 0; i < 400; i++) frame();
  expect(state.segments).toHaveLength(1); expect(state.sawItem).toBe(true);
  const receiver = state.segments[0]!.receiver as InventoryReceiver;
  expect(receiver.id).toBe(terminal.building!.id); expect(receiver.inventory.getItemCount('iron-ore')).toBeGreaterThan(0);
  expect(world.buildings.demolish(terminal.building!.id)).toBe('output not empty');
});

it('picks up moving belt items with E without opening a conveyor panel (mock renderer)', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const world = state.world!, deposit = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far);
  const first = world.buildings.place('conveyor-cell', miner.transform.x + .5, miner.transform.z - 1.5, 0, far);
  const second = world.buildings.place('conveyor-cell', first.transform.x, first.transform.z - 1, 0, far);
  const belt = world.buildings.place('conveyor-cell', second.transform.x, second.transform.z - 1, 0, far);
  expect([miner.reason, first.reason, second.reason, belt.reason]).toEqual(['valid', 'valid', 'valid', 'valid']);
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!, sensitivity = createGameConfig().controls.lookSensitivity;
  const turn = (dx: number, dy: number) => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000 + dx, clientY: 5000 + dy })); frame();
    window.dispatchEvent(new MouseEvent('mouseup'));
  };
  const initial = state.view!.position, target = belt.transform;
  const yaw = Math.atan2(-(target.x - initial.x), -(target.z - initial.z)); turn(-yaw / sensitivity, 0);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
  for (let i = 0; i < 100; i++) { frame(); const p = state.view!.position; if (Math.hypot(p.x - target.x, p.z - target.z) < 2.5) break; }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  let picked = false;
  for (let i = 0; i < 300 && !picked; i++) {
    frame(); const segment = state.segments.find((s) => s.id === belt.building!.id), item = segment?.items[0]; if (!item) continue;
    const p = transportPosition(item, segment.path), view = state.view!.position;
    const aimYaw = Math.atan2(-(p.x - view.x), -(p.z - view.z));
    const pitch = Math.atan2(p.y + .22 - view.y, Math.hypot(p.x - view.x, p.z - view.z));
    turn(-(aimYaw - state.view!.yaw) / sensitivity, -(pitch - state.view!.pitch) / sensitivity);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', cancelable: true })); frame();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    picked = document.querySelector('[data-ui="interaction-feedback"]')!.textContent === 'Item picked up.';
  }
  expect(picked).toBe(true);
  expect(document.querySelector<HTMLElement>('[data-ui="logistics"]')!.hidden).toBe(true);
});

it('real bootstrap starts a Miner-to-belt line before a terminal exists (mock renderer)', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const world = state.world!, deposit = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far);
  const belt = world.buildings.place('conveyor-straight', miner.transform.x, miner.transform.z - 2, 0, far);
  expect(miner.reason).toBe('valid'); expect(belt.reason).toBe('valid'); expect(belt.connection).toBe('connected');
  for (let i = 0; i < 250; i++) frame();
  const segment = state.segments[0]!;
  expect(segment.source?.id).toBe(miner.building!.id); expect(segment.receiver).toBeNull();
  expect(state.sawItem).toBe(true); expect(segment.state).not.toBe('BLOCKED');
  expect(state.ground.length).toBeGreaterThan(0);
  expect(state.ground.every((item) => item.itemId === 'iron-ore')).toBe(true);
  const original = segment.items.map((item) => item.id), originalGround = state.ground.length;
  const terminal = world.buildings.place('receiving-terminal', miner.transform.x, miner.transform.z - 4, 0, far);
  expect(terminal.reason).toBe('valid');
  frame();
  const remaining = state.segments[0]!.items.map((item) => item.id);
  const received = (state.segments[0]!.receiver as InventoryReceiver).inventory.getItemCount('iron-ore');
  expect(remaining.every((id) => original.includes(id))).toBe(true);
  expect(received).toBeGreaterThan(0);
  expect(remaining.length + received + state.ground.length).toBe(original.length + originalGround);
  for (let i = 0; i < 220; i++) frame();
  expect((state.segments[0]!.receiver as InventoryReceiver).inventory.getItemCount('iron-ore')).toBeGreaterThan(0);
});

it('connects the new one-cell menu belt to the generated Miner and renders dropped ore', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const world = state.world!, deposit = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far).building!;
  const candidates = [-.5, .5].map((lane) => world.buildings.validate('conveyor-cell', miner.transform.x + lane, miner.transform.z - 1.5, 0, far));
  const candidate = candidates.find((result) => result.reason === 'valid')!; expect(candidate).toBeDefined();
  const placed = world.buildings.place('conveyor-cell', candidate.transform.x, candidate.transform.z, 0, far);
  expect(placed.reason).toBe('valid');
  for (let i = 0; i < 250; i++) frame();
  expect(state.segments[0]!.source?.id).toBe(miner.id); expect(state.sawItem).toBe(true);
  expect(state.ground.length).toBeGreaterThan(0); expect(state.ground[0]!.itemId).toBe('iron-ore');
});

it('extends a live cell belt over its dropped items without duplicate interaction IDs', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const world = state.world!, deposit = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far).building!;
  const candidate = [-.5, .5].map((lane) => world.buildings.validate('conveyor-cell', miner.transform.x + lane, miner.transform.z - 1.5, 0, far)).find((entry) => entry.reason === 'valid')!;
  expect(candidate).toBeDefined();
  const first = world.buildings.place('conveyor-cell', candidate.transform.x, candidate.transform.z, 0, far);
  expect(first.reason).toBe('valid');
  for (let i = 0; i < 300; i++) frame();
  const fallen = state.ground.map((item) => item.id); expect(fallen.length).toBeGreaterThan(0);
  const second = world.buildings.place('conveyor-cell', first.transform.x, first.transform.z - 1, 0, far);
  expect(second.reason).toBe('valid');
  let recovered = false;
  for (let i = 0; i < 100; i++) { frame(); recovered ||= state.segments.some((s) => s.id === second.building!.id && s.items.some((item) => fallen.includes(item.id))); }
  expect(recovered).toBe(true);
});

it('inspects a belt with G, pauses the simulation, and does not leak G through a modal', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const world = state.world!, deposit = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far);
  const first = world.buildings.place('conveyor-cell', miner.transform.x + .5, miner.transform.z - 1.5, 0, far);
  const second = world.buildings.place('conveyor-cell', first.transform.x, first.transform.z - 1, 0, far);
  const belt = world.buildings.place('conveyor-cell', second.transform.x, second.transform.z - 1, 0, far);
  expect([miner.reason, first.reason, second.reason, belt.reason]).toEqual(['valid', 'valid', 'valid', 'valid']);
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!, sensitivity = createGameConfig().controls.lookSensitivity;
  const turn = (dx: number, dy: number) => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000 + dx, clientY: 5000 + dy })); frame();
    window.dispatchEvent(new MouseEvent('mouseup'));
  };
  const initial = state.view!.position, target = belt.transform;
  const yaw = Math.atan2(-(target.x - initial.x), -(target.z - initial.z)); turn(-yaw / sensitivity, 0);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
  for (let i = 0; i < 100; i++) { frame(); const p = state.view!.position; if (Math.hypot(p.x - target.x, p.z - target.z) < 2.5) break; }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  for (let i = 0; i < 100; i++) frame();
  const p = state.view!.position;
  const targetYaw = Math.atan2(-(target.x - p.x), -(target.z - p.z));
  const pitch = Math.atan2(target.y + .275 - p.y, Math.hypot(target.x - p.x, target.z - p.z));
  turn(-(targetYaw - state.view!.yaw) / sensitivity, -(pitch - state.view!.pitch) / sensitivity);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', cancelable: true })); frame();
  const panel = document.querySelector<HTMLElement>('[data-ui="logistics"]')!;
  expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Observed outputs (up to 60 s, 1 s bins)');
  expect(panel.textContent).toContain('Simulation paused while inspecting');
  const before = state.segments.map((s) => s.items.map((i) => ({ id: i.id, distance: i.distance })));
  for (let i = 0; i < 40; i++) frame();
  expect(state.segments.map((s) => s.items.map((i) => ({ id: i.id, distance: i.distance })))).toEqual(before);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', cancelable: true })); frame(); expect(panel.hidden).toBe(true);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', cancelable: true })); frame();
  expect(document.querySelector<HTMLElement>('[data-ui="construction"]')!.hidden).toBe(false);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', cancelable: true })); frame(); expect(panel.hidden).toBe(true);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', cancelable: true })); frame(); expect(panel.hidden).toBe(true);
});
