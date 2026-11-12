import { describe, expect, it } from 'vitest';
import { GroundItems } from '../../src/logistics/GroundItems';
import { ConveyorNetwork } from '../../src/logistics/ConveyorNetwork';
import { ConveyorPath } from '../../src/logistics/ConveyorPath';
import { InventorySource, InventoryReceiver } from '../../src/logistics/Ports';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
import { ConveyorItemsView } from '../../src/engine/ConveyorItemsView';
import { Group, Vector3 } from 'three';

describe('ground items from open conveyors', () => {
  it('drops, falls, renders and can be picked up without losing resources to a full inventory', () => {
    const registry = createDefaultItemRegistry(), source = new Inventory(registry, 1), full = new Inventory(registry, 1);
    source.addItem('iron-ore', 1); full.addItem('wood', 100);
    const ground = new GroundItems(() => 0);
    const net = new ConveyorNetwork(() => false, (item, p) => ground.drop(item.id, item.itemId, p));
    const path = new ConveyorPath({ shape: 'straight', x: 0, y: .5, z: 0, size: 2, rotation: 0 });
    net.add('belt', path); net.attachSource('belt', new InventorySource('source', { position: path.point(0), direction: path.direction('input') }, source, 'iron-ore'));
    net.fixedUpdate(50); for (let i = 0; i < 50; i++) net.fixedUpdate(50);
    expect(net.get('belt')!.items).toHaveLength(0); expect(ground.all()).toHaveLength(1);
    const drop = ground.all()[0]!; expect(drop.position.z).toBeCloseTo(-1.2); expect(drop.position.y).toBeCloseTo(.72);
    const group = new Group(), view = new ConveyorItemsView((m) => group.add(m), (m) => group.remove(m));
    view.sync([], 1, ground.all()); expect(new Vector3().setFromMatrixPosition(view.matrixAt(0)).y).toBeCloseTo(.72);
    ground.fixedUpdate(1000); expect(ground.get(drop.id)!.position.y).toBeCloseTo(.15);
    expect(ground.pickup(drop.id, full)).toBe(false); expect(ground.all()).toHaveLength(1);
    const bag = new Inventory(registry, 1); expect(ground.pickup(drop.id, bag)).toBe(true);
    expect(bag.getItemCount('iron-ore')).toBe(1); expect(ground.all()).toHaveLength(0); view.dispose();
  });
  it('does not drop into a full receiver, then delivers when space is freed', () => {
    const registry = createDefaultItemRegistry(), source = new Inventory(registry, 1), sink = new Inventory(registry, 1);
    source.addItem('iron-ore', 1); sink.addItem('wood', 100);
    const ground = new GroundItems(() => 0), net = new ConveyorNetwork(() => false, (item, p) => ground.drop(item.id, item.itemId, p));
    const path = new ConveyorPath({ shape: 'straight', x: 0, y: .5, z: 0, size: 2, rotation: 0 });
    net.add('belt', path); net.attachSource('belt', new InventorySource('source', { position: path.point(0), direction: path.direction('input') }, source, 'iron-ore'));
    net.attachReceiver('belt', new InventoryReceiver('sink', { position: path.point(path.length), direction: path.direction('output') }, sink));
    net.fixedUpdate(50); for (let i = 0; i < 60; i++) net.fixedUpdate(50);
    expect(ground.all()).toHaveLength(0); expect(net.get('belt')!.state).toBe('BLOCKED');
    sink.removeItem('wood', 100); net.fixedUpdate(50); expect(sink.getItemCount('iron-ore')).toBe(1);
  });
});
