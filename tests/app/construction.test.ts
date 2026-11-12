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
    key('KeyC'); key('KeyC', true); frame(166);
    expect(state.buildings).toHaveLength(1); expect(state.buildings[0]?.transform).toEqual(transform);
    expect(state.selected).toBe('foundation'); expect(state.preview?.reason).toBe('occupied space');
    key('KeyF'); frame(191); expect(state.buildings).toHaveLength(1); // demolition is disabled while placing
    key('KeyC'); key('Escape'); frame(216); expect(state.selected).toBeNull(); expect(state.buildings).toHaveLength(1);
    key('KeyF'); frame(266); expect(state.buildings).toHaveLength(0);
    expect(document.querySelector('[data-ui="interaction-feedback"]')?.textContent).toContain('materials refunded');
    key('KeyQ'); expect(menu.textContent).toContain('Stone: 20 / 10');
    key('Escape'); expect(menu.hidden).toBe(true);
    key('Tab'); expect(document.querySelector<HTMLElement>('[data-ui="inventory"]')!.hidden).toBe(false);
    expect(document.querySelector('[data-ui="inventory"]')?.textContent).toContain('Stone ×20');
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
    key('KeyC'); frame(166);
    expect(state.buildings).toHaveLength(1); expect(state.buildings[0]!.transform).toEqual(expected);
    expect(state.selected).toBe('conveyor-cell'); expect(state.preview?.reason).toBe('occupied space');
    key('KeyC'); frame(216); expect(state.buildings).toHaveLength(1);
    key('Escape'); frame(266); key('KeyF'); frame(316); expect(state.buildings).toHaveLength(0);
    key('KeyQ'); expect(menu.textContent).toContain('Stone: 20 / 4');
  });

});
