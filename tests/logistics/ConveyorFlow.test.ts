import { describe, expect, it } from 'vitest';
import { ConveyorNetwork } from '../../src/logistics/ConveyorNetwork';
import { ConveyorPath } from '../../src/logistics/ConveyorPath';
import { InventoryReceiver, InventorySource } from '../../src/logistics/Ports';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';

const path = (z = 0) => new ConveyorPath({ shape: 'straight', x: 0, y: 0, z, rotation: 0, size: 1 });
const settings = { speed: 1, spacing: .5, throughputPerMinute: 60 };
function fill(net: ConveyorNetwork, cell: boolean, source: Inventory, sink: Inventory) {
  const segment = cell ? net.addCell('a', path(), settings) : net.add('a', path(), settings);
  const sourcePort = new InventorySource('source', { position: segment.path.point(0), direction: segment.path.direction('input') }, source, 'iron-ore');
  const receiver = new InventoryReceiver('sink', { position: segment.path.point(segment.path.length), direction: segment.path.direction('output') }, sink);
  if (cell) { expect(net.attachCellSource('a', sourcePort, 0)).toBe(true); expect(net.attachCellReceiver('a', receiver)).toBe(true); }
  else { expect(net.attachSource('a', sourcePort)).toBe(true); expect(net.attachReceiver('a', receiver)).toBe(true); }
}
const step = (net: ConveyorNetwork, ticks: number) => { for (let i = 0; i < ticks; i++) net.fixedUpdate(50); };

describe('conveyor output flow statistics', () => {
  it.each([false, true])('counts only accepted transfers for %s cell mode and expires the window', (cell) => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 1), sink = new Inventory(items, 1);
    source.addItem('iron-ore', 8); sink.addItem('stone', 100);
    const net = new ConveyorNetwork(); fill(net, cell, source, sink);
    expect(net.flowStats('missing')).toBeUndefined(); expect(net.flowStats('a')).toEqual({ total: 0, lastMinute: 0 });
    step(net, 200); expect(net.get('a')!.state).toBe('BLOCKED');
    expect(net.flowStats('a')).toEqual({ total: 0, lastMinute: 0 });
    sink.removeItem('stone', 100);
    for (let i = 0; i < 400; i++) { net.fixedUpdate(50); expect(net.flowStats('a')!.total).toBe(sink.getItemCount('iron-ore')); }
    expect(net.flowStats('a')).toEqual({ total: 8, lastMinute: 8 });
    step(net, 1300); expect(net.flowStats('a')).toEqual({ total: 8, lastMinute: 0 });
  });
  it('counts transfers once per traversed cell, excludes manual pickup and survives topology rebuild', () => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 1), sink = new Inventory(items, 1);
    source.addItem('iron-ore', 3); const net = new ConveyorNetwork();
    const a = net.addCell('a', path(), settings), b = net.addCell('b', path(-1), settings);
    net.connectCell('a', 'b', 0);
    net.attachCellSource('a', new InventorySource('s', { position: a.path.point(0), direction: a.path.direction('input') }, source, 'iron-ore'), 0);
    net.attachCellReceiver('b', new InventoryReceiver('r', { position: b.path.point(1), direction: b.path.direction('output') }, sink));
    step(net, 200); expect(sink.getItemCount('iron-ore')).toBe(3);
    expect(net.flowStats('a')?.total).toBe(3); expect(net.flowStats('b')?.total).toBe(3);
    net.resetConnections(); expect(net.reconfigure(new Map([['a', path()], ['b', path(-1)]]), settings)).toBe(true);
    expect(net.flowStats('a')?.total).toBe(3);
    expect(net.insertDropped('manual', 'coal', 'a')).toBe(true);
    expect(net.pickup('manual', new Inventory(items, 1))).toBe(true); expect(net.flowStats('a')?.total).toBe(3);
    expect(net.remove('a')).toBe(true); expect(net.flowStats('a')).toBeUndefined();
    net.addCell('a', path(), settings); expect(net.flowStats('a')).toEqual({ total: 0, lastMinute: 0 });
  });
  it('counts open-end drops and uses paused simulation time with one-second boundary bins', () => {
    let paused = false, drops = 0;
    const net = new ConveyorNetwork(() => paused, () => { drops++; }); net.addCell('a', path(), settings);
    expect(net.insertDropped('drop', 'iron-ore', 'a')).toBe(true); net.fixedUpdate(1000);
    expect(drops).toBe(1); expect(net.flowStats('a')).toEqual({ total: 1, lastMinute: 1 });
    paused = true; net.fixedUpdate(200000); expect(net.flowStats('a')?.lastMinute).toBe(1);
    paused = false; net.fixedUpdate(59999); expect(net.flowStats('a')?.lastMinute).toBe(1);
    net.fixedUpdate(1); expect(net.flowStats('a')).toEqual({ total: 1, lastMinute: 0 });
  });
  it('counts a legacy belt drop exactly once', () => {
    const items = createDefaultItemRegistry(), source = new Inventory(items, 1); source.addItem('coal', 1);
    let drops = 0; const net = new ConveyorNetwork(() => false, () => { drops++; });
    const segment = net.add('a', path(), settings);
    net.attachSource('a', new InventorySource('s', { position: segment.path.point(0), direction: segment.path.direction('input') }, source, 'coal'));
    step(net, 100); expect(drops).toBe(1); expect(net.flowStats('a')).toEqual({ total: 1, lastMinute: 1 });
  });
});
