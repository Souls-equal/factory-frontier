import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D } from 'three';
import type { GroundItem } from '../logistics/GroundItems';
import { transportPosition, type ConveyorSegment } from '../logistics/ConveyorNetwork';

const itemColor = (itemId: string): number => itemId === 'coal' ? 0x303a3c : itemId === 'iron-ingot' ? 0xaac5ce :
  itemId === 'iron-ore' ? 0xb6a098 : itemId === 'copper-ore' ? 0xd18a56 : 0xc0b99d;

/** One shared instanced mesh; instance transforms are derived solely from simulation. */
export class ConveyorItemsView {
  readonly geometry = new BoxGeometry(.3, .3, .3);
  readonly material = new MeshStandardMaterial({ color: 0xffffff, roughness: .85 });
  private readonly object = new Object3D();
  private readonly color = new Color();
  private mesh: InstancedMesh;
  constructor(private readonly attach: (mesh: InstancedMesh) => void, private readonly detach: (mesh: InstancedMesh) => void) {
    this.mesh = this.create(64); this.attach(this.mesh);
  }
  private create(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity); mesh.name = 'conveyor-items'; mesh.count = 0; mesh.frustumCulled = false; return mesh;
  }
  sync(segments: readonly ConveyorSegment[], alpha: number, ground: readonly GroundItem[] = []): void {
    const count = ground.length + segments.reduce((n, segment) => n + segment.items.length, 0);
    if (count > this.mesh.instanceMatrix.count) {
      this.detach(this.mesh); this.mesh.dispose(); this.mesh = this.create(2 ** Math.ceil(Math.log2(count))); this.attach(this.mesh);
    }
    const t = Math.max(0, Math.min(1, alpha)); let index = 0;
    for (const segment of segments) for (const item of segment.items) {
      const p = transportPosition(item, segment.path), previous = item.previousPosition;
      this.object.position.set(previous.x + (p.x - previous.x) * t, previous.y + (p.y - previous.y) * t + .22,
        previous.z + (p.z - previous.z) * t);
      this.object.rotation.set(0, 0, 0); this.object.updateMatrix(); this.mesh.setMatrixAt(index, this.object.matrix);
      this.color.setHex(itemColor(item.itemId));
      this.mesh.setColorAt(index, this.color); index++;
    }
    for (const item of ground) {
      const p = item.position, prev = item.previousPosition;
      this.object.position.set(prev.x + (p.x - prev.x) * t, prev.y + (p.y - prev.y) * t, prev.z + (p.z - prev.z) * t);
      this.object.rotation.set(0, 0, 0); this.object.updateMatrix(); this.mesh.setMatrixAt(index, this.object.matrix);
      this.color.setHex(itemColor(item.itemId));
      this.mesh.setColorAt(index++, this.color);
    }
    this.mesh.count = count; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose(): void { this.detach(this.mesh); this.mesh.dispose(); this.geometry.dispose(); this.material.dispose(); }
  matrixAt(index: number): Matrix4 { const matrix = new Matrix4(); this.mesh.getMatrixAt(index, matrix); return matrix; }
}
