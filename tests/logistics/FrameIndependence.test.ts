import { expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { Game } from '../../src/core/Game';
import { Inventory } from '../../src/items/Inventory';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { ConveyorNetwork } from '../../src/logistics/ConveyorNetwork';
import { ConveyorPath } from '../../src/logistics/ConveyorPath';
import { InventoryReceiver, InventorySource } from '../../src/logistics/Ports';
import { MockScheduler } from '../helpers/MockScheduler';
import { FakeEngine } from '../helpers/FakeEngine';

async function scenario(frame: number) {
  const registry = createDefaultItemRegistry(), source = new Inventory(registry, 1), sink = new Inventory(registry, 1);
  source.addItem('iron-ore', 40);
  const net = new ConveyorNetwork(); net.add('one', new ConveyorPath({ shape: 'straight', x: 0, y: 0, z: 0, rotation: 0, size: 2 }));
  net.attachSource('one', new InventorySource('source', { position: net.get('one')!.path.point(0), direction: net.get('one')!.path.direction('input') }, source, 'iron-ore')); net.attachReceiver('one', new InventoryReceiver('sink', { position: net.get('one')!.path.point(2), direction: net.get('one')!.path.direction('output') }, sink));
  const scheduler = new MockScheduler(), game = new Game({ config: createGameConfig(), engine: new FakeEngine(), scheduler });
  game.registerSystem(net); await game.init(); game.start(); scheduler.advance(frame); scheduler.advanceFrames(30000 / frame, frame);
  const result = { received: sink.getItemCount('iron-ore'), source: source.getItemCount('iron-ore'), items: net.get('one')!.items.map((item) => item.distance) };
  game.dispose(); return result;
}
it('has identical logical results under different render partitions', async () => {
  expect(await scenario(25)).toEqual(await scenario(100));
});
