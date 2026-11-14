// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildingInstance, PlacementResult } from '../../src/buildings/BuildingSystem';
import type { CameraView } from '../../src/engine/types';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';

const state = vi.hoisted(() => ({ buildings: [] as readonly BuildingInstance[], preview: null as PlacementResult | null,
  view: null as CameraView | null, init: 0 }));
vi.mock('../../src/items/Inventory', async (load) => {
  const actual = await load<typeof import('../../src/items/Inventory')>();
  class StockedInventory extends actual.Inventory {
    constructor(...args: ConstructorParameters<typeof actual.Inventory>) { super(...args); if (args[1] === 24) { this.addItem('iron-ore', 30); this.addItem('stone', 20); this.addItem('wood', 20); this.addItem('coal', 10); this.addItem('iron-ingot', 4); } }
  }
  return { ...actual, Inventory: StockedInventory };
});
vi.mock('../../src/engine/Engine', () => ({ Engine: { create: () => ({
  init: () => { state.init++; }, resize: () => {}, applyView: (v: CameraView) => { state.view = v; }, setHighlight: () => {}, render: () => {},
  initBuildings: () => {}, syncBuildings: (b: readonly BuildingInstance[]) => { state.buildings = b; },
  setBuildingPreview: (_: string | null, p?: PlacementResult) => { state.preview = p ?? null; }, setMachineStates: () => {},
  dispose: () => {}, stats: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 },
}) } }));
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
let frames: Array<(t: number) => void> = []; let time = 0;
const frame = (delta = 50) => { time += delta; const fn = frames.shift(); if (!fn) throw new Error('missing frame'); fn(time); };
const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
beforeEach(() => {
  vi.resetModules(); state.buildings = []; state.preview = null; state.view = null; state.init = 0; frames = []; time = 0;
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';
  vi.stubGlobal('requestAnimationFrame', vi.fn((fn: (t: number) => void) => { frames.push(fn); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { window.dispatchEvent(new Event('beforeunload')); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('miner through real bootstrap with mocked rendering', () => {
  it('constructs on a deposit and stays stopped without electricity', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
    const config = createGameConfig(), world = createWorld(config);
    const deposit = world.deposits.find((d) => d.itemId === 'iron-ore')!;
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const turn = (dx: number, dy: number) => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000 + dx, clientY: 5000 + dy }));
      frame(); window.dispatchEvent(new MouseEvent('mouseup'));
    };
    const yaw = Math.atan2(-(deposit.x - world.spawn.x), -(deposit.z - world.spawn.z));
    turn(-yaw / config.controls.lookSensitivity, 0);
    key('KeyW');
    for (let i = 0; i < 30; i++) {
      frame(); const v = state.view!;
      if (Math.hypot(v.position.x - deposit.x, v.position.z - deposit.z) < 3.3) break;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    for (let i = 0; i < 6; i++) frame();
    const pos = state.view!.position, distance = Math.hypot(pos.x - deposit.x, pos.z - deposit.z);
    const pitch = Math.atan2(deposit.y - pos.y, distance);
    turn(0, -pitch / config.controls.lookSensitivity);
    key('KeyQ'); const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    const entry = menu.querySelector<HTMLButtonElement>('[data-building="miner-mk1"]')!;
    expect(entry.disabled).toBe(false); entry.click(); frame();
    expect(state.preview?.reason).toBe('valid'); expect(state.preview?.depositId).toBe(deposit.id);
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    frame(); expect(state.buildings).toHaveLength(1); expect(state.buildings[0]?.typeId).toBe('miner-mk1');
    key('Escape'); frame();
    for (let i = 0; i < 200; i++) frame();
    key('KeyE'); frame(); const panel = document.querySelector<HTMLElement>('[data-ui="machine"]')!;
    expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Iron Ore'); expect(panel.textContent).toContain(deposit.purity);
    expect(panel.textContent).toContain('NO_POWER'); expect(panel.textContent).toContain('Output: 0');
    const details = panel.querySelector('[data-machine-details]')!.textContent;
    for (let i = 0; i < 100; i++) frame();
    expect(panel.querySelector('[data-machine-details]')!.textContent).toBe(details);
    panel.querySelector<HTMLButtonElement>('[data-machine-toggle]')!.click(); expect(panel.textContent).toContain('DISABLED');
    panel.querySelector<HTMLButtonElement>('[data-machine-toggle]')!.click(); expect(panel.textContent).toContain('NO_POWER');
    expect(panel.querySelector<HTMLButtonElement>('[data-machine-retrieve]')!.disabled).toBe(true);
    panel.querySelector<HTMLButtonElement>('[data-machine-close]')!.click();
    key('KeyF'); frame(); expect(state.buildings).toHaveLength(0);
  });
});

describe('smelter through real bootstrap with mocked rendering', () => {
  it('offers construction, places a smelter and opens its live controls', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: 5200 }));
    frame(); window.dispatchEvent(new MouseEvent('mouseup'));
    key('KeyQ'); const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    const entry = menu.querySelector<HTMLButtonElement>('[data-building="smelter"]')!;
    expect(entry).not.toBeNull(); expect(entry.disabled).toBe(false); entry.click(); frame();
    expect(state.preview?.reason).toBe('valid');
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); frame();
    expect(state.buildings).toHaveLength(1); expect(state.buildings[0]?.typeId).toBe('smelter');
    key('Escape'); frame(); key('KeyE'); frame();
    const panel = document.querySelector<HTMLElement>('[data-ui="machine"]')!;
    expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Smelter');
    expect(panel.textContent).toContain('NO_POWER');
    panel.querySelector<HTMLButtonElement>('[data-machine-feed]')!.click();
    expect(panel.textContent).toContain('Input: 30'); expect(panel.textContent).toContain('NO_POWER');
    panel.querySelector<HTMLButtonElement>('[data-machine-feed-fuel]')!.click(); expect(panel.textContent).toContain('Coal: 10');
    panel.querySelector<HTMLButtonElement>('[data-machine-close]')!.click();
    for (let i = 0; i < 50; i++) frame();
    key('KeyE'); frame(); expect(panel.textContent).toContain('Output: 0'); expect(panel.textContent).toContain('NO_POWER');
  });
});

describe('constructor through real bootstrap with mocked rendering', () => {
  it('constructs, inspects and retains input without electricity', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: 5200 }));
    frame(); window.dispatchEvent(new MouseEvent('mouseup'));
    key('KeyQ'); const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    const entry = menu.querySelector<HTMLButtonElement>('[data-building="constructor"]')!;
    expect(entry.disabled).toBe(false); entry.click(); frame(); expect(state.preview?.reason).toBe('valid');
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); frame();
    expect(state.buildings[0]?.typeId).toBe('constructor'); key('Escape'); frame(); key('KeyE'); frame();
    const panel = document.querySelector<HTMLElement>('[data-ui="machine"]')!;
    expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Constructor');
    expect(panel.textContent).toContain('Iron Ingot → 1 Iron Plate'); expect(panel.textContent).toContain('NO_POWER');
    panel.querySelector<HTMLButtonElement>('[data-machine-feed]')!.click(); expect(panel.textContent).toContain('Input: 4');
    panel.querySelector<HTMLButtonElement>('[data-machine-close]')!.click();
    for (let i = 0; i < 50; i++) frame();
    key('KeyE'); frame(); expect(panel.textContent).toContain('Output: 0'); expect(panel.textContent).toContain('NO_POWER');
  });
});

describe('splitter through real bootstrap with mocked rendering', () => {
  it('offers construction, places the splitter and opens inspection', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: 5200 })); frame();
    window.dispatchEvent(new MouseEvent('mouseup'));
    key('KeyQ'); const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    const entry = menu.querySelector<HTMLButtonElement>('[data-building="splitter"]')!;
    expect(entry.disabled).toBe(false); entry.click(); frame(); expect(state.preview?.reason).toBe('valid');
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); frame();
    expect(state.buildings[0]?.typeId).toBe('splitter'); key('Escape'); frame();
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: 4920 })); frame();
    window.dispatchEvent(new MouseEvent('mouseup')); key('KeyE'); frame();
    const panel = document.querySelector<HTMLElement>('[data-ui="logistics"]')!;
    expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Splitter'); expect(panel.textContent).toContain('buffer empty');
  });
});

it.each(['power-pole', 'biomass-generator', 'merger', 'lift-up-1', 'lift-up-2', 'lift-down-1', 'lift-down-2'])('exposes and places %s through the actual construction menu (mock renderer)', async (id) => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame();
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: 5200 })); frame(); window.dispatchEvent(new MouseEvent('mouseup'));
  key('KeyQ'); const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
  const entry = menu.querySelector<HTMLButtonElement>(`[data-building="${id}"]`)!;
  expect(entry.disabled).toBe(false); entry.click(); frame(); expect(state.preview?.reason).toBe('valid');
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); frame();
  expect(state.buildings[0]?.typeId).toBe(id);
  if (id === 'biomass-generator') {
    key('Escape'); frame();
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: 4920 })); frame(); window.dispatchEvent(new MouseEvent('mouseup'));
    key('KeyE'); frame();
    const panel = document.querySelector<HTMLElement>('[data-ui="machine"]')!;
    expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Biomass Generator');
    expect(panel.textContent).toContain('Network: isolated');
    panel.querySelector<HTMLButtonElement>('[data-machine-feed-fuel]')!.click();
    expect(panel.textContent).toContain('Wood: 10');
    panel.querySelector<HTMLButtonElement>('[data-machine-close]')!.click();
    key('KeyF'); frame(); expect(state.buildings).toHaveLength(1); // wood cannot be lost on demolition
  }
  if (id === 'merger') {
    key('Escape'); frame();
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 5000, clientY: 5000 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: 4920 })); frame(); window.dispatchEvent(new MouseEvent('mouseup'));
    key('KeyE'); frame(); const panel = document.querySelector<HTMLElement>('[data-ui="logistics"]')!;
    expect(panel.hidden).toBe(false); expect(panel.textContent).toContain('Merger');
  }
});
