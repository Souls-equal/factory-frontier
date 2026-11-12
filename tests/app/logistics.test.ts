// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { World } from '../../src/world/World';
import type { ConveyorSegment } from '../../src/logistics/ConveyorNetwork';
import type { InventoryReceiver } from '../../src/logistics/Ports';
import type { CameraView } from '../../src/engine/types';
import { createGameConfig } from '../../src/core/Configuration';

const state = vi.hoisted(() => ({ world: null as World | null, segments: [] as readonly ConveyorSegment[], view: null as CameraView | null, init: 0, sawItem: false }));
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
    syncConveyors: (segments: readonly ConveyorSegment[]) => { state.segments = segments; if (segments.some((s) => s.items.length)) state.sawItem = true; },
    dispose: () => {}, stats: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 } };
} } }));
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
let frames: Array<(time: number) => void> = [], time = 0;
function frame() { time += 50; const next = frames.shift(); if (!next) throw new Error('Missing scheduled frame'); next(time); }
beforeEach(() => {
  vi.resetModules(); state.world = null; state.segments = []; state.view = null; state.init = 0; state.sawItem = false; frames = []; time = 0;
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

it('targets and inspects a real belt and pauses gameplay through bootstrap modal wiring (mock renderer)', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const world = state.world!, deposit = world.deposits.find((entry) => entry.itemId === 'iron-ore')!;
  const far = { x: 80, z: 80, radius: .4 };
  const miner = world.buildings.place('miner-mk1', deposit.x, deposit.z, 0, far);
  const belt = world.buildings.place('conveyor-straight', miner.transform.x, miner.transform.z - 2, 0, far);
  const terminal = world.buildings.place('receiving-terminal', miner.transform.x, miner.transform.z - 4, 0, far);
  expect([miner.reason, belt.reason, terminal.reason]).toEqual(['valid', 'valid', 'valid']);
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!, sensitivity = createGameConfig().controls.lookSensitivity;
  const turn = (dx: number, dy: number) => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000 + dx, clientY: 5000 + dy })); frame();
    window.dispatchEvent(new MouseEvent('mouseup'));
  };
  const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
  const initial = state.view!.position, target = belt.transform;
  const yaw = Math.atan2(-(target.x - initial.x), -(target.z - initial.z)); turn(-yaw / sensitivity, 0);
  key('KeyW');
  for (let i = 0; i < 70; i++) { frame(); const p = state.view!.position; if (Math.hypot(p.x - target.x, p.z - target.z) < 3.1) break; }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); for (let i = 0; i < 6; i++) frame();
  const pos = state.view!.position, distance = Math.hypot(pos.x - target.x, pos.z - target.z);
  const pitch = Math.atan2(target.y + .6 - pos.y, distance); turn(0, -pitch / sensitivity);
  for (let i = 0; i < 200; i++) frame();
  key('KeyE'); frame(); const panel = document.querySelector<HTMLElement>('[data-ui="logistics"]')!;
  expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Conveyor: straight');
  expect(panel.textContent).toContain(`Input: ${miner.building!.id}`); expect(panel.textContent).toContain(`Output: ${terminal.building!.id}`);
  const snapshot = () => ({ items: state.segments[0]!.items.map(({ id, distance }) => ({ id, distance })),
    received: (state.segments[0]!.receiver as InventoryReceiver).inventory.snapshot(), position: { ...state.view!.position }, buildings: world.buildings.all().length });
  const before = snapshot(); key('KeyW'); key('KeyC'); key('KeyF'); key('KeyQ');
  for (let i = 0; i < 100; i++) frame(); expect(snapshot()).toEqual(before);
  expect(document.querySelector<HTMLElement>('[data-ui="construction"]')!.hidden).toBe(true);
  key('Escape'); expect(panel.hidden).toBe(true); for (let i = 0; i < 100; i++) frame();
  expect(snapshot().received).not.toEqual(before.received);
});
