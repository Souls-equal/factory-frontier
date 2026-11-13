// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BuildingSystem, type BuildingInstance, type PlacementResult } from '../../src/buildings/BuildingSystem';
const state = vi.hoisted(() => ({ point: { x: -.5, z: 2.5 } as { x: number; z: number } | null,
  buildings: [] as readonly BuildingInstance[], extra: [] as readonly BuildingInstance[], preview: null as PlacementResult | null, init: 0 }));
vi.mock('../../src/items/Inventory', async (load) => {
  const actual = await load<typeof import('../../src/items/Inventory')>();
  class StockedInventory extends actual.Inventory {
    constructor(...args: ConstructorParameters<typeof actual.Inventory>) { super(...args); this.addItem('stone', 80); this.addItem('wood', 40); }
  }
  return { ...actual, Inventory: StockedInventory };
});
vi.mock('../../src/buildings/ConstructionController', async (load) => {
  const actual = await load<typeof import('../../src/buildings/ConstructionController')>();
  class AimedController extends actual.ConstructionController { override aim() { return state.point; } }
  return { ...actual, ConstructionController: AimedController };
});
vi.mock('../../src/world/World', async (load) => {
  const actual = await load<typeof import('../../src/world/World')>();
  return { ...actual, createWorld: (...args: Parameters<typeof actual.createWorld>) => {
    const world = actual.createWorld(...args); const p = { x: 20, z: 20, radius: .4 };
    const buildings = new BuildingSystem(world.buildings.registry, args[1]!, world.terrain, [], 1, 80);
    buildings.setCreativeMode(true);
    const source = buildings.place('storage-container', 0, 4, 0, p);
    const sink = buildings.place('receiving-terminal', 0, -2, 0, p);
    if (source.reason !== 'valid' || sink.reason !== 'valid') throw new Error(`Test setup: ${source.reason}, ${sink.reason}`);
    buildings.setCreativeMode(false); return { ...world, buildings };
  } };
});
vi.mock('../../src/engine/Engine', () => ({ Engine: { create: () => ({
  init: () => { state.init++; }, resize: () => {}, applyView: () => {}, setHighlight: () => {}, render: () => {},
  initBuildings: () => {}, syncBuildings: (buildings: readonly BuildingInstance[]) => { state.buildings = buildings; },
  setBuildingPreview: (_: string | null, preview?: PlacementResult) => { state.preview = preview ?? null; },
  setRoutePreview: (cells: readonly BuildingInstance[]) => { state.extra = cells; },
  dispose: () => {}, stats: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 },
}) } }));
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
let frames: Array<(t: number) => void> = [];
const frame = (time: number) => { const next = frames.shift(); if (!next) throw new Error('missing frame'); next(time); };
const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
const click = () => { const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); };
beforeEach(() => {
  vi.resetModules(); state.init = 0; state.point = { x: -.5, z: 2.5 }; state.buildings = []; state.extra = []; state.preview = null; frames = [];
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';
  vi.stubGlobal('requestAnimationFrame', vi.fn((fn: (t: number) => void) => { frames.push(fn); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { window.dispatchEvent(new Event('beforeunload')); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('wires click, waypoint preview, undo and Enter to an atomic route through the actual bootstrap', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame(16);
  key('KeyQ'); document.querySelector<HTMLButtonElement>('[data-building="conveyor-cell"]')!.click();
  key('KeyT'); frame(66); expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Valid start');
  click(); frame(116); expect(state.buildings).toHaveLength(2);
  state.point = { x: -.5, z: .5 }; click(); frame(166);
  expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('2 points');
  key('Backspace'); frame(216); expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('1 points');
  state.point = { x: -.5, z: -.5 }; frame(266);
  expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Valid route');
  expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Stone ×16');
  expect(state.preview?.reason).toBe('valid'); expect(state.extra).toHaveLength(3);
  key('Enter'); frame(316); expect(state.buildings).toHaveLength(6);
  expect(document.querySelector('[data-ui="interaction-feedback"]')!.textContent).toContain('Route built: 4 cells');
  expect(state.extra).toHaveLength(0); key('Escape'); frame(366); expect(state.preview).toBeNull();
  key('KeyQ'); expect(document.querySelector('[data-ui="construction"]')!.textContent).toContain('Stone: 64 / 4');
});

it('confirms an open end, warns about drops, then starts a second route from the first', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await import('../../src/main'); await vi.waitFor(() => expect(state.init).toBe(1)); frame(16);
  key('KeyQ'); document.querySelector<HTMLButtonElement>('[data-building="conveyor-cell"]')!.click();
  key('KeyT'); frame(66); click(); frame(116);
  state.point = { x: -.5, z: .5 }; frame(166);
  expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Open end: items may fall');
  expect(state.preview?.reason).toBe('valid');
  key('Enter'); frame(216); expect(state.buildings).toHaveLength(5);
  expect(document.querySelector('[data-ui="interaction-feedback"]')!.textContent).toContain('Open end: items can fall');
  state.point = { x: -.5, z: -.5 }; frame(266);
  expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Valid start');
  click(); frame(316);
  expect(document.querySelector('[data-ui="construction-status"]')!.textContent).toContain('Connected end');
  key('Enter'); frame(366); expect(state.buildings).toHaveLength(6);
  expect(document.querySelector('[data-ui="interaction-feedback"]')!.textContent).toContain('Route built: 1 cells');
});
