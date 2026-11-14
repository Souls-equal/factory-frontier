import { expect, it } from 'vitest';
import { Mesh } from 'three';
import { PowerWireView } from '../../src/engine/PowerWireView';

it('renders links between their actual anchors and removes obsolete geometry', () => {
  const view = new PowerWireView();
  const wires = [{ a: 'p', b: 'm', from: { x: 1, y: 2, z: 3 }, to: { x: 5, y: 4, z: 3 } }];
  view.sync(wires); expect(view.group.children).toHaveLength(1);
  const mesh = view.group.children[0] as Mesh;
  expect(mesh.position.toArray()).toEqual([3, 3, 3]);
  expect(mesh.name).toBe('power-wire:p:m');
  view.sync(wires); expect(view.group.children[0]).toBe(mesh);
  view.sync([]); expect(view.group.children).toHaveLength(0); view.dispose();
});
