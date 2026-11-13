import { describe, expect, it } from 'vitest';
import { Splitter } from '../../src/logistics/Splitter';
import { createDefaultItemRegistry } from '../../src/items/ItemRegistry';
import { Inventory } from '../../src/items/Inventory';

const pose = { position: { x: 0, y: .5, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
describe('filtered splitter arbitration', () => {
  it('selects exact matches before unmatched outputs and waits when assigned output is unavailable', () => {
    const s = new Splitter('s', createDefaultItemRegistry()), ids = [0,1,2].map((i) => s.outputId(i));
    s.setOutputFilter(0, 'iron-ore'); s.setOutputFilter(1, 'coal'); s.configure('filtered', 0);
    const input = s.receiver(pose); expect(s.choose(ids)).toBeNull();
    expect(input.accept('iron-ore')).toBe(true); expect(s.choose(ids)).toBe(ids[0]);
    expect(s.choose([ids[1]!, ids[2]!])).toBeNull(); expect(s.source(2, pose).take('iron-ore')).toBe(false);
    expect(s.pending).toBe('iron-ore'); expect(s.source(0, pose).take('iron-ore')).toBe(true);
    expect(input.accept('coal')).toBe(true); expect(s.choose(ids)).toBe(ids[1]); expect(s.source(1, pose).take('coal')).toBe(true);
    expect(input.accept('wood')).toBe(true); expect(s.choose(ids)).toBe(ids[2]); expect(s.source(2, pose).take('wood')).toBe(true);
    expect(input.accept('unknown')).toBe(false);
  });
  it('fairly shares identical and unmatched filters and only advances after successful transfer', () => {
    const s = new Splitter('s', createDefaultItemRegistry()), ids = [0,1,2].map((i) => s.outputId(i));
    s.setOutputFilter(0, 'coal'); s.setOutputFilter(1, 'coal'); s.configure('filtered', 2);
    const chosen: string[] = [];
    for (let i = 0; i < 12; i++) {
      expect(s.receiver(pose).accept('coal')).toBe(true); expect(s.choose([ids[2]!])).toBeNull();
      const id = s.choose(ids)!; chosen.push(id); const n = ids.indexOf(id);
      expect(s.source(n, pose).take('wood')).toBe(false); expect(s.source(n, pose).take('coal')).toBe(true);
    }
    expect(chosen.filter((id) => id === ids[0])).toHaveLength(6); expect(chosen.filter((id) => id === ids[1])).toHaveLength(6);
    s.setOutputFilter(0, null); s.setOutputFilter(1, null);
    const rest: string[] = [];
    for (let i = 0; i < 9; i++) { s.receiver(pose).accept('wood'); const id = s.choose(ids)!; rest.push(id); s.source(ids.indexOf(id), pose).take('wood'); }
    expect(ids.map((id) => rest.filter((value) => value === id).length)).toEqual([3,3,3]);
  });
  it('changes configuration safely with a buffered item, validates and preserves filters across other modes', () => {
    const items = createDefaultItemRegistry(), s = new Splitter('s', items), ids = [0,1,2].map((i) => s.outputId(i));
    expect(() => s.setOutputFilter(-1, 'coal')).toThrow(); expect(() => s.setOutputFilter(3, null)).toThrow();
    expect(() => s.setOutputFilter(1.5, 'coal')).toThrow(); expect(() => s.setOutputFilter(0, 'not-real')).toThrow();
    s.setOutputFilter(0, 'coal'); s.configure('filtered', 0); s.receiver(pose).accept('coal');
    expect(s.choose([ids[1]!])).toBeNull(); s.setOutputFilter(1, 'coal'); expect(s.choose([ids[1]!])).toBe(ids[1]);
    s.setOutputFilter(0, 'wood'); expect(s.pending).toBe('coal');
    const snapshot = s.filters as (string | null)[]; snapshot[1] = null; expect(s.filters[1]).toBe('coal');
    s.configure('priority', 2); expect(s.choose(ids)).toBe(ids[2]); s.configure('filtered', 2); expect(s.choose(ids)).toBe(ids[1]);
    const player = new Inventory(items, 1); player.addItem('stone', 100);
    expect(s.retrieve(player).moved).toBe(0); expect(s.pending).toBe('coal');
    player.removeItem('stone', 100); expect(s.retrieve(player).moved).toBe(1); expect(s.pending).toBeNull();
    expect(s.filters).toEqual(['wood', 'coal', null]);
  });
});
