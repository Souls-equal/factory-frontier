import { describe, expect, it } from 'vitest';
import { createGameConfig } from '../../src/core/Configuration';
import { Game } from '../../src/core/Game';
import { Miner } from '../../src/machines/Miner';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { FakeEngine } from '../helpers/FakeEngine';
import { MockScheduler } from '../helpers/MockScheduler';
import type { ResourceDeposit } from '../../src/resources/ResourceDeposit';

const deposit: ResourceDeposit = { id: 'ore', itemId: 'iron-ore', x: 0, y: 0, z: 0, radius: .8, purity: 'normal', productionMultiplier: 1, extractionCompatible: true };
async function run(frameMs: number) {
  const engine = new FakeEngine(), scheduler = new MockScheduler(), config = createGameConfig();
  const miner = new Miner('m', 'ore', 'iron-ore', () => deposit, createDefaultItemRegistry());
  const game = new Game({ config, engine, scheduler });
  game.registerSystem({ id: 'miner-test', fixedUpdate: (dt) => miner.fixedUpdate(dt) });
  await game.init(); game.start(); scheduler.advance(frameMs); // first frame establishes time origin
  scheduler.advanceFrames(60000 / frameMs, frameMs);
  const total = miner.output.getItemCount('iron-ore');
  game.pause(); scheduler.advanceFrames(100, frameMs); expect(miner.output.getItemCount('iron-ore')).toBe(total);
  game.resume(); scheduler.advance(frameMs); scheduler.advanceFrames(2000 / frameMs, frameMs);
  expect(miner.output.getItemCount('iron-ore')).toBe(total + 1);
  game.dispose(); return total;
}
describe('fixed-step production integration', () => {
  it('produces the same quantity at different render rates and does not run during pause', async () => {
    expect(await run(25)).toBe(30); expect(await run(100)).toBe(30);
  });
});
