// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { World } from '../../src/world/World';
import type { ConveyorSegment } from '../../src/logistics/ConveyorNetwork';
import type { InventoryReceiver } from '../../src/logistics/Ports';

const state = vi.hoisted(() => ({ world: null as World | null, segments: [] as readonly ConveyorSegment[], init: 0, sawItem: false }));
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
  return { init: () => { state.init++; }, resize: () => {}, applyView: () => {}, setHighlight: () => {}, render: () => {},
    initBuildings: () => {}, syncBuildings: () => {}, setBuildingPreview: () => {}, setMachineStates: () => {},
    syncConveyors: (segments: readonly ConveyorSegment[]) => { state.segments = segments; if (segments.some((s) => s.items.length)) state.sawItem = true; },
    dispose: () => {}, stats: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 } };
} } }));
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
let frames: Array<(time: number) => void> = [], time = 0;
function frame() { time += 50; const next = frames.shift(); if (!next) throw new Error('Missing scheduled frame'); next(time); }
beforeEach(() => {
  vi.resetModules(); state.world = null; state.segments = []; state.init = 0; state.sawItem = false; frames = []; time = 0;
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
