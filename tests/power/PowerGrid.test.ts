import { describe, expect, it } from 'vitest';
import { PowerGrid, type PowerNode } from '../../src/power/PowerGrid';

const pole = (id: string, x = 0, y = 0, z = 0): PowerNode => ({ id, kind: 'pole', position: { x, y, z } });
const generator = (id: string, capacityWatts: number, x = 0, enabled = true): PowerNode => ({ id, kind: 'generator', position: { x, y: 0, z: 0 }, capacityWatts, enabled });
const consumer = (id: string, demandWatts: number, x = 0, enabled = true): PowerNode => ({ id, kind: 'consumer', position: { x, y: 0, z: 0 }, demandWatts, enabled });

describe('electrical network topology', () => {
  it('keeps unconnected endpoints isolated and unpowered', () => {
    const grid = new PowerGrid(10); grid.add(generator('gen', 50)); grid.add(consumer('machine', 10)); grid.add(pole('pole'));
    expect(grid.networks()).toHaveLength(3); expect(grid.networkFor('gen')).toMatchObject({ status: 'isolated', capacityWatts: 50, availableWatts: 0 });
    expect(grid.networkFor('machine')).toMatchObject({ status: 'isolated', demandWatts: 10, suppliedWatts: 0, shortfallWatts: 10 });
    expect(grid.networkFor('pole').status).toBe('offline'); expect(grid.isPowered('machine')).toBe(false);
  });
  it('connects in any order, merges networks, and splits them on wire and node removal', () => {
    const grid = new PowerGrid(10);
    [pole('a', 0), pole('b', 10), generator('g', 50, 0), consumer('c', 40, 10)].forEach(n => grid.add(n));
    grid.connect('g', 'a'); grid.connect('b', 'c');
    expect(grid.isPowered('c')).toBe(false); expect(grid.networks()).toHaveLength(2);
    grid.connect('a', 'b'); expect(grid.networks()).toHaveLength(1); expect(grid.networkFor('c')).toMatchObject({ poles: ['a', 'b'], generators: ['g'], consumers: ['c'], status: 'online', suppliedWatts: 40 });
    expect(grid.isPowered('c')).toBe(true); expect(grid.disconnect('b', 'a')).toBe(true);
    expect(grid.networks()).toHaveLength(2); expect(grid.isPowered('c')).toBe(false);
    grid.connect('a', 'b'); expect(grid.remove('a')).toBe(true); expect(grid.networks()).toHaveLength(2);
    expect(grid.networkFor('g').status).toBe('isolated'); expect(grid.isPowered('c')).toBe(false);
    expect(grid.remove('a')).toBe(false);
  });
  it('handles cycles and removes all incident wires without deleting other nodes', () => {
    const grid = new PowerGrid(20); [pole('a'), pole('b', 1), pole('c', 2), generator('g', 10), consumer('m', 10)].forEach(n => grid.add(n));
    grid.connect('a', 'b'); grid.connect('b', 'c'); grid.connect('c', 'a'); grid.connect('g', 'a'); grid.connect('m', 'c');
    grid.disconnect('a', 'c'); expect(grid.isPowered('m')).toBe(true);
    grid.remove('b'); expect(grid.networks()).toHaveLength(2); expect(grid.isPowered('m')).toBe(false);
    grid.connect('a', 'c'); expect(grid.isPowered('m')).toBe(true);
  });
  it('validates 3D distance, duplicate links, endpoint rules and self-links atomically', () => {
    const grid = new PowerGrid(5); grid.add(pole('a')); grid.add(pole('b', 3, 4)); grid.add(pole('far', 3, 4, .01)); grid.add(generator('g', 10)); grid.add(consumer('m', 2));
    expect(grid.connect('a', 'b')).toBe(true); const revision = grid.revision;
    expect(grid.connect('b', 'a')).toBe(false); expect(grid.disconnect('a', 'far')).toBe(false);
    for (const action of [() => grid.connect('a', 'far'), () => grid.connect('a', 'a'), () => grid.connect('g', 'm'), () => grid.connect('a', 'missing'), () => grid.disconnect('a', 'missing')]) expect(action).toThrow(RangeError);
    expect(grid.revision).toBe(revision);
    grid.connect('g', 'a'); const connected = grid.networks(), before = grid.revision;
    expect(() => grid.connect('g', 'b')).toThrow(RangeError);
    expect(grid.networks()).toEqual(connected); expect(grid.revision).toBe(before);
    grid.disconnect('a', 'g'); expect(grid.connect('b', 'g')).toBe(true);
  });
  it('uses independent positions and returns defensive network snapshots', () => {
    const grid = new PowerGrid(5), position = { x: 0, y: 0, z: 0 };
    grid.add({ id: 'p', kind: 'pole', position }); grid.add(consumer('m', 1, 2)); position.x = 100;
    grid.connect('p', 'm'); const view = grid.networkFor('p');
    (view.consumers as string[]).push('fake'); (view.poles as string[]).splice(0);
    expect(grid.networkFor('m')).toMatchObject({ poles: ['p'], consumers: ['m'] });
  });
});

describe('power balance', () => {
  it('reports installed capacity, online capacity, enabled demand and delivered power', () => {
    const grid = new PowerGrid(10);
    [pole('p'), generator('g1', 60), generator('g2', 50, 0, false), consumer('m1', 25), consumer('m2', 35), consumer('m3', 80, 0, false)].forEach(n => grid.add(n));
    for (const id of ['g1', 'g2', 'm1', 'm2', 'm3']) grid.connect('p', id);
    expect(grid.networkFor('p')).toMatchObject({ capacityWatts: 110, availableWatts: 60, demandWatts: 60, suppliedWatts: 60, shortfallWatts: 0, status: 'online' });
    expect(grid.isPowered('m1')).toBe(true); expect(grid.isPowered('m2')).toBe(true); expect(grid.isPowered('m3')).toBe(false);
    grid.setEnabled('g1', false); expect(grid.networkFor('p')).toMatchObject({ capacityWatts: 110, availableWatts: 0, demandWatts: 60, suppliedWatts: 0, shortfallWatts: 60, status: 'offline' });
    expect(grid.isPowered('m1')).toBe(false);
  });
  it('sheds all enabled consumers on overload and restores them when supply or demand changes', () => {
    const grid = new PowerGrid(10); [pole('p'), generator('g', 10), consumer('a', 6), consumer('b', 5)].forEach(n => grid.add(n));
    for (const id of ['g', 'a', 'b']) grid.connect('p', id);
    expect(grid.networkFor('p')).toMatchObject({ status: 'overloaded', availableWatts: 10, demandWatts: 11, suppliedWatts: 0, shortfallWatts: 1 });
    expect([grid.isPowered('a'), grid.isPowered('b')]).toEqual([false, false]);
    grid.setWatts('g', 11); expect([grid.isPowered('a'), grid.isPowered('b')]).toEqual([true, true]);
    grid.setWatts('g', 10); grid.setEnabled('b', false);
    expect(grid.networkFor('p')).toMatchObject({ status: 'online', demandWatts: 6, suppliedWatts: 6 });
    expect(grid.isPowered('a')).toBe(true); expect(grid.isPowered('b')).toBe(false);
  });
  it('isolates failures between separate networks and handles zero-capacity sources', () => {
    const grid = new PowerGrid(5); [pole('p'), generator('g', 20), consumer('c', 10), pole('q', 20), generator('empty', 0, 20), consumer('other', 1, 20)].forEach(n => grid.add(n));
    grid.connect('p', 'g'); grid.connect('p', 'c'); grid.connect('q', 'empty'); grid.connect('q', 'other');
    expect(grid.isPowered('c')).toBe(true); expect(grid.isPowered('other')).toBe(false);
    grid.setWatts('empty', 2); expect(grid.isPowered('other')).toBe(true); expect(grid.isPowered('c')).toBe(true);
    grid.setWatts('empty', 0); expect(grid.networkFor('other').status).toBe('offline');
  });
});

describe('input validation and determinism', () => {
  it('rejects invalid configuration, nodes and rates without changing the graph', () => {
    for (const range of [0, -1, NaN, Infinity]) expect(() => new PowerGrid(range)).toThrow(RangeError);
    const grid = new PowerGrid(5); grid.add(pole('p')); const before = grid.networks(), rev = grid.revision;
    for (const node of [pole(''), pole(' leading'), pole('x', NaN), generator('g', -1), generator('g', .5), consumer('m', Infinity)]) expect(() => grid.add(node)).toThrow(RangeError);
    expect(() => grid.add(pole('p'))).toThrow(RangeError); expect(() => grid.setWatts('p', 3)).toThrow(RangeError);
    expect(() => grid.setEnabled('p', true)).toThrow(RangeError); expect(() => grid.isPowered('p')).toThrow(RangeError);
    expect(grid.networks()).toEqual(before); expect(grid.revision).toBe(rev);
  });
  it('rejects aggregate overflow even across isolated networks or disabled nodes', () => {
    const grid = new PowerGrid(5); grid.add(generator('g', Number.MAX_SAFE_INTEGER, 0, false)); grid.add(consumer('m', Number.MAX_SAFE_INTEGER, 0, false));
    const before = grid.networks(), rev = grid.revision;
    expect(() => grid.add(generator('g2', 1))).toThrow(RangeError); expect(() => grid.add(consumer('m2', 1))).toThrow(RangeError);
    expect(grid.networks()).toEqual(before); expect(grid.revision).toBe(rev);
    grid.setWatts('g', Number.MAX_SAFE_INTEGER - 1); grid.add(generator('g2', 1));
    const next = grid.networks(); expect(() => grid.setWatts('g2', 2)).toThrow(RangeError); expect(grid.networks()).toEqual(next);
  });
  it('uses stable ordering independent of construction and wire order', () => {
    const nodes = [pole('p'), pole('q', 1), generator('g', 10), consumer('m', 5)];
    const a = new PowerGrid(5), b = new PowerGrid(5);
    nodes.forEach(n => a.add(n)); [...nodes].reverse().forEach(n => b.add(n));
    a.connect('p', 'q'); a.connect('g', 'p'); a.connect('q', 'm');
    b.connect('m', 'q'); b.connect('p', 'g'); b.connect('q', 'p');
    expect(a.networks()).toEqual(b.networks());
    const revision = a.revision; a.setWatts('g', 10); a.setEnabled('g', true); expect(a.revision).toBe(revision);
  });
});

it('tracks connected components under repeated deterministic wire additions and removals', () => {
  const grid = new PowerGrid(100), ids = Array.from({ length: 12 }, (_, i) => `pole-${i.toString().padStart(2, '0')}`);
  const edges = new Map(ids.map(id => [id, new Set<string>()])); ids.forEach((id, i) => grid.add(pole(id, i)));
  let seed = 7291; const random = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  for (let step = 0; step < 350; step++) {
    const a = ids[random() % ids.length]!, b = ids[random() % ids.length]!; if (a === b) continue;
    if (random() % 2) {
      const expected = !edges.get(a)!.has(b); expect(grid.connect(a, b)).toBe(expected);
      edges.get(a)!.add(b); edges.get(b)!.add(a);
    } else {
      const expected = edges.get(a)!.delete(b); edges.get(b)!.delete(a); expect(grid.disconnect(a, b)).toBe(expected);
    }
    const unseen = new Set(ids), expected: string[][] = [];
    while (unseen.size) {
      const first = unseen.values().next().value!, stack = [first], group: string[] = []; unseen.delete(first);
      while (stack.length) {
        const id = stack.pop()!; group.push(id);
        for (const next of edges.get(id)!) if (unseen.delete(next)) stack.push(next);
      }
      expected.push(group.sort());
    }
    expected.sort((a, b) => a[0]! < b[0]! ? -1 : 1);
    expect(grid.networks().map(network => network.poles)).toEqual(expected);
  }
});
