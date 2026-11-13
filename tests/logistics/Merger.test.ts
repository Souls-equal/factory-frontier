import { expect, it } from 'vitest';
import { Merger } from '../../src/logistics/Merger';
import { Splitter } from '../../src/logistics/Splitter';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';
const pose = { position: { x: 0, y: .5, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
it('merges permanently active inputs fairly and protects a full inventory', () => {
  const items = createDefaultItemRegistry(), merger = new Merger('m', items), source = merger.source(pose), ids = ['coal', 'iron-ore', 'wood'];
  const outputs: string[] = [];
  expect(merger.receiver(0, pose).accept('unknown')).toBe(false);
  for (let step = 0; step < 120; step++) {
    for (let i = 0; i < 3; i++) merger.receiver(i, pose).accept(ids[i]!);
    const item = source.peek()!; outputs.push(item); expect(source.take(item)).toBe(true);
  }
  expect(ids.map((id) => outputs.filter((entry) => entry === id).length)).toEqual([40, 40, 40]);
  const full = new Inventory(items, 1); full.addItem('stone', 100);
  expect(merger.retrieve(full).moved).toBe(0); expect(merger.occupied).toBe(true);
  full.removeItem('stone', 100); const result = merger.retrieve(full);
  expect(result.moved).toBe(1); expect(result.remainder).toBe(1);
});
it('supports balanced, strict priority and overflow selection', () => {
  const splitter = new Splitter('s', createDefaultItemRegistry());
  const ids = [0,1,2].map((i) => splitter.outputId(i));
  expect(splitter.choose(ids)).toBe(ids[0]);
  splitter.receiver(pose).accept('coal'); expect(splitter.source(0, pose).take('coal')).toBe(true);
  expect(splitter.choose(ids)).toBe(ids[1]);
  splitter.configure('priority', 2); expect(splitter.choose([ids[0]!, ids[1]!])).toBeNull(); expect(splitter.choose(ids)).toBe(ids[2]);
  splitter.configure('overflow', 2); expect(splitter.choose(ids)).toBe(ids[2]); expect(splitter.choose([ids[0]!, ids[1]!])).toBe(ids[1]);
  expect(() => splitter.configure('priority', 3)).toThrow();
});
