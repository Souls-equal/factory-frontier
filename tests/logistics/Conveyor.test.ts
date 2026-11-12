import { describe, expect, it } from 'vitest';
import { ConveyorNetwork } from '../../src/logistics/ConveyorNetwork';
import { ConveyorPath } from '../../src/logistics/ConveyorPath';
import { InventorySource, InventoryReceiver } from '../../src/logistics/Ports';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

const path = (z: number, y = 0) => new ConveyorPath({ shape: 'straight', x: 0, y, z, rotation: 0, size: 2 });
function setup(quantity = 20) {
  const items = createDefaultItemRegistry(); const source = new Inventory(items, 1), destination = new Inventory(items, 1);
  source.addItem('iron-ore', quantity);
  const net = new ConveyorNetwork(); const a = net.add('a', path(0)), b = net.add('b', path(-2));
  expect(net.connect('a', 'b')).toBe(true);
  expect(net.attachSource('a', new InventorySource('miner', { position: a.path.point(0), direction: a.path.direction('input') }, source, 'iron-ore'))).toBe(true);
  expect(net.attachReceiver('b', new InventoryReceiver('receiver', { position: b.path.point(b.path.length), direction: b.path.direction('output') }, destination))).toBe(true);
  const total = () => source.getItemCount('iron-ore') + destination.getItemCount('iron-ore') + net.all().reduce((sum, s) => sum + s.items.length, 0);
  return { net, a, b, source, destination, total };
}
function step(net: ConveyorNetwork, count: number) { for (let i = 0; i < count; i++) net.fixedUpdate(50); }

describe('conveyor geometry', () => {
  it('aligns endpoints and tangents across straight, curved and inclined paths', () => {
    const straight = path(0), curve = new ConveyorPath({ shape: 'curve-right', x: 0, y: 0, z: -2, size: 2, rotation: 0 });
    const incline = new ConveyorPath({ shape: 'incline', x: 2, y: 0, z: -2, size: 2, rotation: 3, rise: 1 });
    expect(straight.compatible(curve)).toBe(true); expect(curve.compatible(incline)).toBe(true);
    expect(curve.point(0).x).toBeCloseTo(0); expect(curve.point(0).z).toBeCloseTo(-1);
    expect(curve.point(curve.length).x).toBeCloseTo(1); expect(curve.point(curve.length).z).toBeCloseTo(-2);
    const mid = curve.point(curve.length / 2); expect(mid.x).toBeCloseTo(1 - Math.SQRT1_2); expect(mid.z).toBeCloseTo(-1 - Math.SQRT1_2);
    expect(incline.point(incline.length).y).toBe(1); expect(incline.length).toBeCloseTo(Math.sqrt(5));
    const wrongHeight = new ConveyorPath({ shape: 'incline', x: 2, y: 1, z: -2, size: 2, rotation: 3, rise: 1 });
    expect(curve.compatible(wrongHeight)).toBe(false);
  });
  it('rejects wrong direction, proximity and invalid config', () => {
    expect(path(0).compatible(new ConveyorPath({ shape: 'straight', x: 0, y: 0, z: -2, size: 2, rotation: 2 }))).toBe(false);
    expect(path(0).compatible(path(-2.001))).toBe(false);
    expect(() => new ConveyorPath({ shape: 'straight', x: 0, y: 0, z: 0, size: 0, rotation: 0 })).toThrow();
  });
});

describe('deterministic conveyor simulation', () => {
  it('moves source items into receiver with conservation and spacing', () => {
    const { net, source, destination, a, b, total } = setup();
    for (let i = 0; i < 400; i++) {
      net.fixedUpdate(50); expect(total()).toBe(20);
      for (const s of [a, b]) for (let j = 1; j < s.items.length; j++) expect(s.items[j-1]!.distance - s.items[j]!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
      if (a.items[0] && b.items.at(-1)) expect(a.path.length - a.items[0]!.distance + b.items.at(-1)!.distance).toBeGreaterThanOrEqual(.5 - 1e-8);
    }
    expect(destination.getItemCount('iron-ore')).toBeGreaterThan(0); expect(source.getItemCount('iron-ore')).toBeLessThan(20);
  });
  it('blocks at a full receiver and resumes without deleting or duplicating', () => {
    const { net, a, b, destination, total } = setup(10); destination.addItem('iron-ore', 100);
    step(net, 500); expect(b.state).toBe('BLOCKED'); expect(total()).toBe(110);
    expect(net.remove('b')).toBe(false); const before = a.items.map((x) => x.distance);
    step(net, 100); expect(a.items.map((x) => x.distance)).toEqual(before); expect(total()).toBe(110);
    destination.removeItem('iron-ore', 50); step(net, 300);
    expect(destination.getItemCount('iron-ore')).toBeGreaterThan(50); expect(total()).toBe(60);
  });
  it('carries items to an open end, blocks safely and resumes when the route is completed', () => {
    const { net, source, destination, total } = setup(10);
    expect(net.remove('b')).toBe(true); step(net, 150);
    const a = net.get('a')!;
    expect(source.getItemCount('iron-ore')).toBeLessThan(10); expect(total()).toBe(10);
    expect(a.state).toBe('BLOCKED'); expect(a.items[0]!.distance).toBeCloseTo(a.path.length);
    const b = net.add('b2', path(-2)); expect(net.connect('a', b.id)).toBe(true); expect(net.connect('a', b.id)).toBe(false);
    expect(net.attachReceiver(b.id, new InventoryReceiver('receiver', { position: b.path.point(b.path.length), direction: b.path.direction('output') }, destination))).toBe(true);
    step(net, 300); expect(destination.getItemCount('iron-ore')).toBeGreaterThan(0); expect(total()).toBe(10);
  });
  it('enforces throughput independent of available source stock', () => {
    const { net, source, destination, total } = setup(100); step(net, 1200);
    expect(destination.getItemCount('iron-ore')).toBeLessThanOrEqual(60);
    expect(source.getItemCount('iron-ore')).toBeGreaterThanOrEqual(40); expect(total()).toBe(100);
  });
  it('does not advance while paused', () => {
    let paused = true; const net = new ConveyorNetwork(() => paused);
    const source = new Inventory(createDefaultItemRegistry(), 1); source.addItem('iron-ore', 2);
    const dest = new Inventory(source.registry, 1); net.add('a', path(0));
    net.attachSource('a', new InventorySource('s', { position: path(0).point(0), direction: path(0).direction('input') }, source, 'iron-ore')); net.attachReceiver('a', new InventoryReceiver('d', { position: path(0).point(path(0).length), direction: path(0).direction('output') }, dest));
    step(net, 100); expect(source.getItemCount('iron-ore')).toBe(2);
    paused = false; step(net, 100); expect(dest.getItemCount('iron-ore')).toBe(2);
  });
});

describe('machine integration in isolated simulation', () => {
  it('moves real miner production through a curve and incline without loss', async () => {
    const { Miner } = await import('../../src/machines/Miner');
    const registry = createDefaultItemRegistry();
    const deposit = { id: 'ore', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal' as const, productionMultiplier: 1, extractionCompatible: true };
    const miner = new Miner('miner', 'ore', 'iron-ore', () => deposit, registry);
    const receiver = new Inventory(registry, 1), net = new ConveyorNetwork();
    const a = net.add('straight', path(0));
    const curve = net.add('curve', new ConveyorPath({ shape: 'curve-right', x: 0, y: 0, z: -2, size: 2, rotation: 0 }));
    const slope = net.add('slope', new ConveyorPath({ shape: 'incline', x: 2, y: 0, z: -2, size: 2, rotation: 3, rise: 1 }));
    expect(net.connect(a.id, curve.id)).toBe(true); expect(net.connect(curve.id, slope.id)).toBe(true);
    net.attachSource(a.id, new InventorySource('miner-out', { position: a.path.point(0), direction: a.path.direction('input') }, miner.output, miner.itemId));
    net.attachReceiver(slope.id, new InventoryReceiver('receiving', { position: slope.path.point(slope.path.length), direction: slope.path.direction('output') }, receiver));
    let sawCurve = false, sawSlope = false;
    for (let i = 0; i < 1200; i++) {
      miner.fixedUpdate(50); net.fixedUpdate(50);
      const total = miner.output.getItemCount('iron-ore') + receiver.getItemCount('iron-ore') + net.all().reduce((sum, s) => sum + s.items.length, 0);
      expect(total).toBe(Math.floor((i + 1) * 50 / 2000));
      if (curve.items.length) sawCurve = true;
      if (slope.items.length) { sawSlope = true; expect(slope.path.point(slope.items[0]!.distance).y).toBeGreaterThanOrEqual(0); }
    }
    expect(sawCurve).toBe(true); expect(sawSlope).toBe(true); expect(receiver.getItemCount('iron-ore')).toBeGreaterThan(0);
  });
});

describe('port and segment restrictions', () => {
  it('rejects incompatible or duplicate ports and preserves source items', () => {
    const items = createDefaultItemRegistry(), inv = new Inventory(items, 1); inv.addItem('iron-ore', 3);
    const net = new ConveyorNetwork(), a = net.add('a', path(0));
    const wrong = new InventorySource('bad', { position: { x: .01, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } }, inv, 'iron-ore');
    const reversed = new InventorySource('reverse', { position: a.path.point(0), direction: { x: 0, y: 0, z: 1 } }, inv, 'iron-ore');
    expect(net.attachSource(a.id, wrong)).toBe(false); expect(net.attachSource(a.id, reversed)).toBe(false);
    step(net, 100); expect(inv.getItemCount('iron-ore')).toBe(3);
  });
  it('honors each segment speed when crossing a boundary', () => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 1), receiver = new Inventory(items, 1);
    source.addItem('iron-ore', 1);
    const net = new ConveyorNetwork(), a = net.add('a', path(0)), b = net.add('b', path(-2), { speed: .2, throughputPerMinute: 60, spacing: .5 });
    net.connect(a.id, b.id);
    net.attachSource('a', new InventorySource('s', { position: a.path.point(0), direction: a.path.direction('input') }, source, 'iron-ore'));
    net.attachReceiver('b', new InventoryReceiver('r', { position: b.path.point(b.path.length), direction: b.path.direction('output') }, receiver));
    net.fixedUpdate(50); net.fixedUpdate(2050);
    expect(b.items).toHaveLength(1); expect(b.items[0]!.distance).toBeCloseTo(.01);
  });
});

it('rejects a cycle even when all four geometric joints match', () => {
  const net = new ConveyorNetwork();
  const curve = (x: number, z: number, rotation: number) => new ConveyorPath({ shape: 'curve-right', x, y: 0, z, size: 2, rotation });
  net.add('a', curve(0, 0, 0)); net.add('b', curve(2, 0, 3)); net.add('c', curve(2, 2, 2)); net.add('d', curve(0, 2, 1));
  expect(net.connect('a', 'b')).toBe(true); expect(net.connect('b', 'c')).toBe(true); expect(net.connect('c', 'd')).toBe(true);
  expect(net.connect('d', 'a')).toBe(false); expect(net.get('d')?.output).toBe(null); expect(net.get('a')?.input).toBe(null);
});

it('preserves items already in flight if an empty middle segment is removed', () => {
  const { net, source, destination, total } = setup(10); step(net, 5);
  expect(net.get('a')!.items).toHaveLength(1); expect(net.remove('b')).toBe(true);
  const before = net.get('a')!.items[0]!.distance;
  step(net, 200); expect(net.get('a')!.items[0]!.distance).toBeGreaterThanOrEqual(before);
  expect(net.get('a')!.items[0]!.distance).toBeCloseTo(net.get('a')!.path.length);
  expect(net.get('a')!.state).toBe('BLOCKED');
  expect(source.getItemCount('iron-ore') + destination.getItemCount('iron-ore') + net.get('a')!.items.length).toBe(10);
  expect(total()).toBe(10); expect(net.remove('a')).toBe(false);
});

it('retains and freezes in-flight items when their source is removed and resumes on reattachment', () => {
  const { net, source, destination, total } = setup(10);
  step(net, 40); expect(net.get('a')!.items.length).toBeGreaterThan(0);
  net.resetConnections();
  expect(net.connect('a', 'b')).toBe(true);
  const b = net.get('b')!;
  expect(net.attachReceiver('b', new InventoryReceiver('receiver', { position: b.path.point(b.path.length), direction: b.path.direction('output') }, destination))).toBe(true);
  const snapshot = net.all().flatMap((s) => s.items.map(({ id, distance }) => ({ id, distance })));
  step(net, 100);
  expect(net.get('a')!.state).toBe('DISCONNECTED'); expect(net.get('b')!.state).toBe('DISCONNECTED');
  expect(net.all().flatMap((s) => s.items.map(({ id, distance }) => ({ id, distance })))).toEqual(snapshot);
  expect(total()).toBe(10);
  const a = net.get('a')!;
  expect(net.attachSource('a', new InventorySource('miner', { position: a.path.point(0), direction: a.path.direction('input') }, source, 'iron-ore'))).toBe(true);
  step(net, 250); expect(destination.getItemCount('iron-ore')).toBeGreaterThan(0); expect(total()).toBe(10);
});
