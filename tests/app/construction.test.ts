// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildingInstance, PlacementResult } from '../../src/buildings/BuildingSystem';

const state = vi.hoisted(() => ({ buildings: [] as readonly BuildingInstance[], preview: null as PlacementResult | null,
  selected: null as string | null, viewZ: 0, init: 0, disposed: 0 }));
vi.mock('../../src/items/Inventory', async (load) => {
  const actual = await load<typeof import('../../src/items/Inventory')>();
  class StockedInventory extends actual.Inventory {
    constructor(...args: ConstructorParameters<typeof actual.Inventory>) { super(...args); this.addItem('stone', 20); this.addItem('wood', 10); }
  }
  return { ...actual, Inventory: StockedInventory };
});
vi.mock('../../src/engine/Engine', () => ({ Engine: { create: () => ({
  init: () => { state.init++; }, resize: () => {}, applyView: (view: { position: { z: number } }) => { state.viewZ = view.position.z; }, setHighlight: () => {}, render: () => {},
  initBuildings: () => {}, syncBuildings: (buildings: readonly BuildingInstance[]) => { state.buildings = buildings; },
  setBuildingPreview: (selected: string | null, preview?: PlacementResult) => { state.selected = selected; state.preview = preview ?? null; },
  dispose: () => { state.disposed++; }, stats: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 },
}) } }));
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
let frames: Array<(t: number) => void> = [];
const frame = (time: number) => { const fn = frames.shift(); if (!fn) throw new Error('missing frame'); fn(time); };
const key = (code: string, repeat = false) => window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat, cancelable: true }));
const clickCanvas = () => {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
};
beforeEach(() => {
  vi.resetModules(); state.buildings = []; state.preview = null; state.selected = null; state.init = 0; state.disposed = 0; frames = [];
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';
  vi.stubGlobal('requestAnimationFrame', vi.fn((fn: (t: number) => void) => { frames.push(fn); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { window.dispatchEvent(new Event('beforeunload')); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('construction bootstrap wiring', () => {
  it('isolates movement and interaction while menu is open and cancels placement safely', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1));
    frame(16); const initialZ = state.viewZ;
    key('KeyW'); frame(66); frame(116); frame(166);
    expect(state.viewZ).toBeLessThan(initialZ);
    key('KeyQ'); key('KeyW'); key('Space'); key('KeyE');
    frame(216); const stoppedZ = state.viewZ; frame(266); frame(316);
    expect(state.viewZ).toBeCloseTo(stoppedZ);
    const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    menu.querySelector<HTMLButtonElement>('[data-building="foundation"]')!.click();
    frame(366); expect(state.selected).toBe('foundation');
    key('Escape'); frame(416); expect(state.selected).toBeNull(); expect(state.buildings).toHaveLength(0);
    key('KeyQ'); expect(menu.textContent).toContain('Stone: 20 / 10');
  });
  it('opens modal, selects, previews, places once, demolishes and refunds', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1));
    frame(16);
    const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    key('KeyQ'); expect(menu.hidden).toBe(false);
    const entry = menu.querySelector<HTMLButtonElement>('[data-building="foundation"]')!;
    expect(entry.disabled).toBe(false); expect(entry.textContent).toContain('Stone: 20 / 10');
    key('Tab'); expect(document.querySelector<HTMLElement>('[data-ui="inventory"]')!.hidden).toBe(true);
    entry.click(); expect(menu.hidden).toBe(true);
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 500, clientY: 500 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 857 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    frame(66);
    expect(state.selected).toBe('foundation'); expect(state.preview?.reason).toBe('valid');
    const initialHeight = state.preview!.transform.y;
    key('PageUp'); frame(91); expect(state.preview!.transform.y).toBeCloseTo(initialHeight + .1);
    expect(document.querySelector('[data-ui="construction-status"]')?.textContent).toContain('Page Up/Down');
    key('PageDown'); key('KeyR'); frame(116); expect(state.preview?.transform.rotation).toBe(1);
    expect(state.preview!.transform.y).toBeCloseTo(initialHeight);
    const transform = state.preview!.transform;
    key('KeyC'); frame(141); expect(state.buildings).toHaveLength(0);
    clickCanvas(); frame(166);
    expect(state.buildings).toHaveLength(1); expect(state.buildings[0]?.transform).toEqual(transform);
    expect(state.selected).toBe('foundation'); expect(state.preview?.reason).toBe('occupied space');
    key('KeyF'); frame(191); expect(state.buildings).toHaveLength(1); // demolition is disabled while placing
    clickCanvas(); key('Escape'); frame(216); expect(state.selected).toBeNull(); expect(state.buildings).toHaveLength(1);
    key('KeyF'); frame(266); expect(state.buildings).toHaveLength(0);
    expect(document.querySelector('[data-ui="interaction-feedback"]')?.textContent).toContain('materials refunded');
    key('KeyQ'); expect(menu.textContent).toContain('Stone: 20 / 10');
    key('Escape'); expect(menu.hidden).toBe(true);
    key('Tab'); expect(document.querySelector<HTMLElement>('[data-ui="inventory"]')!.hidden).toBe(false);
    expect(document.querySelector('[data-ui="inventory"]')?.textContent).toContain('Stone ×20');
  });
  it('places on primary press with captured mouse, ignores menu clicks and does not repeat while held', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame(16);
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    key('KeyQ');
    clickCanvas(); frame(66); expect(state.buildings).toHaveLength(0);
    const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    menu.querySelector<HTMLButtonElement>('[data-building="foundation"]')!.click();
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 500, clientY: 500, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 857 }));
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0, clientX: 500, clientY: 857 }));
    frame(116); expect(state.preview?.reason).toBe('valid');
    const expected = state.preview!.transform;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    frame(166); expect(state.buildings).toHaveLength(1); expect(state.buildings[0]!.transform).toEqual(expected);
    frame(216); expect(state.buildings).toHaveLength(1);
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    key('Escape'); frame(266); key('KeyQ');
    expect(menu.textContent).toContain('Stone: 10 / 10');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  it('exposes conveyor construction, rotation and repeat-placement with atomic costs', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame(16);
    key('KeyQ'); const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
    const entry = menu.querySelector<HTMLButtonElement>('[data-building="conveyor-cell"]')!;
    expect(entry.disabled).toBe(false); expect(entry.textContent).toContain('Logistics'); entry.click();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 500, clientY: 500 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 857 })); window.dispatchEvent(new MouseEvent('mouseup'));
    frame(66); expect(state.preview?.reason).toBe('valid'); expect(state.preview?.connection).toBe('disconnected');
    key('KeyR'); frame(116); expect(state.preview?.transform.rotation).toBe(1);
    const expected = state.preview!.transform;
    clickCanvas(); frame(166);
    expect(state.buildings).toHaveLength(1); expect(state.buildings[0]!.transform).toEqual(expected);
    expect(state.selected).toBe('conveyor-cell'); expect(state.preview?.reason).toBe('occupied space');
    clickCanvas(); frame(216); expect(state.buildings).toHaveLength(1);
    key('Escape'); frame(266); key('KeyF'); frame(316); expect(state.buildings).toHaveLength(0);
    key('KeyQ'); expect(menu.textContent).toContain('Stone: 20 / 4');
  });

});

it('enables creative from the build menu and places and demolishes without charging or refunding', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame(16);
  key('KeyQ'); const menu = document.querySelector<HTMLElement>('[data-ui="construction"]')!;
  const toggle = menu.querySelector<HTMLInputElement>('[data-construction-creative]')!;
  expect(toggle.checked).toBe(false); toggle.click(); expect(toggle.checked).toBe(true);
  expect(menu.querySelector('[data-building="foundation"]')!.textContent).toContain('no construction materials required');
  menu.querySelector<HTMLButtonElement>('[data-building="foundation"]')!.click();
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 500, clientY: 500 }));
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 857 }));
  window.dispatchEvent(new MouseEvent('mouseup')); frame(66);
  expect(state.preview?.reason).toBe('valid'); expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Creative');
  clickCanvas(); frame(116); expect(state.buildings).toHaveLength(1); expect(state.buildings[0]?.freePlacement).toBe(true);
  key('Escape'); frame(166); key('KeyF'); frame(216); expect(state.buildings).toHaveLength(0);
  expect(document.querySelector('[data-ui="interaction-feedback"]')?.textContent).toContain('no materials to refund');
  key('KeyQ'); expect(toggle.checked).toBe(true); toggle.click();
  expect(menu.textContent).toContain('Stone: 20 / 10'); expect(menu.textContent).toContain('Wood: 10 / 5');
});

it('exposes route mode, refuses an invalid start and returns safely to single placement', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame(16);
  key('KeyQ'); document.querySelector<HTMLButtonElement>('[data-building="conveyor-cell"]')!.click();
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 500, clientY: 500 }));
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 857 })); window.dispatchEvent(new MouseEvent('mouseup'));
  frame(66); expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('T route mode');
  key('KeyT'); frame(116);
  expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Invalid start');
  expect(document.querySelector('[data-ui="controls-hint"]')!.textContent).toContain('Enter build');
  clickCanvas(); frame(166); expect(state.buildings).toHaveLength(0);
  expect(document.querySelector('[data-ui="interaction-feedback"]')!.textContent).toContain('Cannot add point');
  key('Enter'); frame(216); expect(state.buildings).toHaveLength(0);
  expect(document.querySelector('[data-ui="interaction-feedback"]')!.textContent).toContain('Select a starting');
  key('KeyT'); frame(266); expect(state.preview?.reason).toBe('valid');
  clickCanvas(); frame(316); expect(state.buildings).toHaveLength(1);
  key('Escape'); frame(366); expect(state.selected).toBeNull();
});
