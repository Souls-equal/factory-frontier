import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../src/buildings/BuildingSystem';
import { ConstructionController } from '../../src/buildings/ConstructionController';
import { createDefaultBuildingRegistry } from '../../src/buildings/BuildingRegistry';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { LogisticsManager } from '../../src/logistics/LogisticsManager';
import { MachineManager } from '../../src/machines/MachineManager';
import { pathForBuilding } from '../../src/logistics/ConveyorDefinitions';
import { directLiftLink } from '../../src/logistics/DirectLiftConnections';
import { ConveyorNetwork, DEFAULT_CONVEYOR_SETTINGS } from '../../src/logistics/ConveyorNetwork';
import type { TerrainQuery } from '../../src/world/terrain/TerrainHeightfield';

const terrain: TerrainQuery = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, size: 60, resolution: 30, cellSize: 2,
  contains: (x,z) => Math.abs(x) <= 30 && Math.abs(z) <= 30, clampXZ: (x,z) => ({x,z}),
  heightAt: () => 0, slopeAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }) };
const far = { x: 20, z: 20, radius: .4 };
function setup() {
  const items = createDefaultItemRegistry(), player = new Inventory(items, 10);
  const buildings = new BuildingSystem(createDefaultBuildingRegistry(items), player, terrain, [], 1, 29); buildings.setCreativeMode(true);
  const machines = new MachineManager(buildings, items, () => []), logistics = new LogisticsManager(buildings, machines, items);
  const place = (type: string, x: number, z: number, r = 0, offset?: number) => {
    const result = buildings.place(type, x, z, r, far, offset); expect(result.reason).toBe('valid'); return result.building!;
  };
  const tick = (n: number) => { for (let i = 0; i < n; i++) logistics.fixedUpdate(50); };
  return { items, buildings, logistics, place, tick };
}

describe('direct lift links', () => {
  it.each([0, 1, 2, 3])('matches direction, height and placement order at rotation %i', (r) => {
    for (const a of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8]) for (const b of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8]) for (const reverse of [false, true]) {
      const { buildings, logistics, place } = setup();
      const direction = [[0,-1],[-1,0],[0,1],[1,0]][r]!;
      const x = direction[0]! * 2, z = direction[1]! * 2;
      const difference = Math.max(0, -b) - Math.max(0, a);
      const firstBase = Math.max(0, difference), secondBase = Math.max(0, -difference);
      if (firstBase) place('foundation', 0, 0, 0, firstBase - .4);
      if (secondBase) place('foundation', x, z, 0, secondBase - .4);
      const type = (n: number) => `lift-${n > 0 ? 'up' : 'down'}-${Math.abs(n)}`;
      let first, second;
      if (reverse) {
        second = place(type(b), x, z, r);
        expect(buildings.validate(type(a), 0, 0, r, far)).toMatchObject({ reason: 'valid', connection: 'connected' });
        first = place(type(a), 0, 0, r);
      } else {
        first = place(type(a), 0, 0, r);
        expect(buildings.validate(type(b), x, z, r, far)).toMatchObject({ reason: 'valid', connection: 'connected' });
        second = place(type(b), x, z, r);
      }
      expect(directLiftLink(first, second, 1)).toBe(true);
      expect(directLiftLink(second, first, 1)).toBe(false);
      logistics.sync();
      expect(logistics.network.get(first.id)!.output).toBe(second.id);
      expect(logistics.network.get(second.id)!.input).toBe(first.id);
    }
  });
  it('does not connect incompatible heights or directions', () => {
    const { buildings, logistics, place } = setup();
    const a = place('lift-up-1', 0, 0), b = place('lift-up-1', 0, -2);
    expect(buildings.validate('lift-down-1', 2, 0, 1, far).connection).not.toBe('connected');
    expect(directLiftLink(a, b, 1)).toBe(false); logistics.sync();
    expect(logistics.network.get(a.id)!.output).toBeNull(); expect(logistics.network.get(b.id)!.input).toBeNull();
  });
  it('does not allow a belt to occupy a direct lift link', () => {
    const { buildings, place } = setup();
    place('lift-up-1', 0, 0); place('lift-down-1', 0, -2);
    expect(buildings.validate('conveyor-cell', -.5, -1.5, 0, far).reason).not.toBe('valid');
    expect(buildings.validate('conveyor-cell', -.5, -.5, 0, far).reason).not.toBe('valid');
  });
  it('requires normal support for a raised second lift', () => {
    const { buildings, place } = setup();
    place('lift-up-2', 0, 0);
    expect(buildings.validate('lift-up-1', 0, -2, 0, far).connection).toBe('disconnected');
    place('foundation', 0, -2, 0, 1.6);
    expect(buildings.validate('lift-up-1', 0, -2, 0, far)).toMatchObject({ reason: 'valid', connection: 'connected' });
  });
  it('connects through the interactive controller preview', () => {
    const { buildings, logistics, place } = setup(); const first = place('lift-up-1', 0, 0);
    const controller = new ConstructionController(buildings, terrain); controller.select('lift-down-1');
    const view = { position: { x: 0, y: 3, z: -2 }, yaw: 0, pitch: -Math.PI / 2 };
    expect(controller.preview(view, far)).toMatchObject({ reason: 'valid', connection: 'connected' });
    const second = controller.confirm(view, far)!.building!; logistics.sync(); expect(logistics.network.get(first.id)!.output).toBe(second.id);
  });
  it.each([false, true])('preserves spacing and items through blockage and recovery (reverse=%s)', (reverse) => {
    const { buildings, logistics, place, tick } = setup();
    const source = place('storage-container', 0, 2);
    const [a, b] = reverse ? (() => { const b = place('lift-down-1', 0, -2), a = place('lift-up-1', 0, 0); return [a,b] as const; })() :
      [place('lift-up-1', 0, 0), place('lift-down-1', 0, -2)] as const;
    const sink = place('storage-container', 0, -4);
    logistics.sync(); const src = logistics.terminal(source.id)!, dst = logistics.terminal(sink.id)!;
    src.addItem('coal', 40); dst.addItem('stone', 800);
    for (let i = 0; i < 1200; i++) {
      tick(1); const left = logistics.network.get(a.id)!, right = logistics.network.get(b.id)!;
      const head = left.items[0], tail = right.items.at(-1);
      if (head && tail) expect(left.path.length - head.distance + tail.distance).toBeGreaterThanOrEqual(Math.max(left.settings.spacing, right.settings.spacing) - 1e-8);
      expect(src.getItemCount('coal') + dst.getItemCount('coal') + left.items.length + right.items.length).toBe(40);
    }
    expect(logistics.network.get(a.id)!.state).toBe('BLOCKED');
    expect(buildings.demolish(a.id)).toBe('output not empty');
    dst.removeItem('stone', 800); tick(1800);
    expect(dst.getItemCount('coal')).toBe(40); expect(src.getItemCount('coal')).toBe(0);
    expect(logistics.network.flowStats(a.id)!.total).toBe(40); expect(logistics.network.flowStats(b.id)!.total).toBe(40);
  });
  it('rejects unsafe occupied links and topology projection until spacing clears', () => {
    const { place } = setup();
    const a = place('lift-up-1', 0, 0), b = place('lift-down-1', 0, -2);
    const pa = pathForBuilding(a, 1)!, pb = pathForBuilding(b, 1)!;
    const network = new ConveyorNetwork();
    network.addCell(a.id, pa, DEFAULT_CONVEYOR_SETTINGS); network.addCell(b.id, pb, DEFAULT_CONVEYOR_SETTINGS);
    expect(network.insertDropped('a', 'coal', a.id)).toBe(true);
    network.fixedUpdate(2000);
    let available = true;
    expect(network.attachCellSource(b.id, { id: 'source', pose: { position: pb.point(0), direction: pb.direction('input') },
      peek: () => available ? 'coal' : null, take: () => { available = false; return true; } }, 0)).toBe(true);
    network.fixedUpdate(50); network.resetConnections();
    const paths = new Map([[a.id, pa], [b.id, pb]]);
    expect(network.canReconfigure(paths, DEFAULT_CONVEYOR_SETTINGS)).toBe(false);
    expect(network.connectCell(a.id, b.id, 0)).toBe(false);
    network.fixedUpdate(550);
    expect(network.canReconfigure(paths, DEFAULT_CONVEYOR_SETTINGS)).toBe(true);
    expect(network.connectCell(a.id, b.id, 0)).toBe(true);
    network.fixedUpdate(50);
    expect(network.get(a.id)!.items.length + network.get(b.id)!.items.length).toBe(2);
  });
  it('transfers through three alternating lifts and can dismantle them when empty', () => {
    const { buildings, logistics, place, tick } = setup();
    const source = place('storage-container', 0, 2);
    const lifts = [place('lift-up-1', 0, 0), place('lift-down-1', 0, -2), place('lift-up-1', 0, -4)];
    place('foundation', 0, -6, 0, .6); const sink = place('storage-container', 0, -6);
    logistics.sync(); logistics.terminal(source.id)!.addItem('coal', 12); tick(800);
    expect(logistics.terminal(sink.id)!.getItemCount('coal')).toBe(12);
    expect(lifts.map((l) => logistics.network.flowStats(l.id)!.total)).toEqual([12,12,12]);
    for (const lift of lifts) { expect(buildings.demolish(lift.id)).toBe('removed'); logistics.sync(); expect(logistics.network.get(lift.id)).toBeUndefined(); }
  });
});
