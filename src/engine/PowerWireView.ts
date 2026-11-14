import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { PowerWire } from '../power/PowerManager';

/** Renderer-only representation of authoritative automatic links. */
export class PowerWireView {
  readonly group = new Group();
  private snapshot: readonly PowerWire[] | null = null;
  private readonly material = new MeshStandardMaterial({ color: 0x252f35, roughness: .8 });
  sync(wires: readonly PowerWire[]): void {
    if (wires === this.snapshot) return;
    this.clear(); this.snapshot = wires;
    for (const wire of wires) {
      const from = new Vector3(wire.from.x, wire.from.y, wire.from.z);
      const to = new Vector3(wire.to.x, wire.to.y, wire.to.z);
      const delta = to.clone().sub(from), length = delta.length();
      if (!length) continue;
      const mesh = new Mesh(new CylinderGeometry(.035, .035, length, 6), this.material);
      mesh.name = `power-wire:${wire.a}:${wire.b}`; mesh.position.copy(from).add(to).multiplyScalar(.5);
      mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()));
      this.group.add(mesh);
    }
  }
  private clear(): void { for (const child of this.group.children) if (child instanceof Mesh) child.geometry.dispose(); this.group.clear(); }
  dispose(): void { this.clear(); this.material.dispose(); this.snapshot = null; }
}
