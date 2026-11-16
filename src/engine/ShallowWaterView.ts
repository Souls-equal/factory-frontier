import { Color, DoubleSide, Group, InstancedMesh, MeshStandardMaterial, Object3D, PlaneGeometry } from 'three';
import type { WorldChunk } from '../world/ChunkManager';
import type { ShallowWaterCell } from '../world/ShallowWater';
import type { World } from '../world/World';
import { hash2D } from '../world/noise';

type Batch = { mesh: InstancedMesh; cells: readonly ShallowWaterCell[] };
/** Render-only puddles: never included in terrain, collision, placement or recipes. */
export class ShallowWaterView {
  readonly group = new Group();
  private readonly batches = new Map<string, Batch>();
  private readonly geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly material = new MeshStandardMaterial({ color: 0x75d9d0, roughness: .3, metalness: .1,
    transparent: true, opacity: .82, depthWrite: false, side: DoubleSide });
  private revision = -1;

  constructor(private readonly world: World) { this.group.name = 'environment:shallow-water'; }

  load(chunks: readonly WorldChunk[]): void {
    for (const chunk of chunks) {
      if (this.batches.has(chunk.id)) continue;
      const cells = this.world.shallowWater.cells(chunk.range);
      if (!cells.length) continue;
      const mesh = new InstancedMesh(this.geometry, this.material, cells.length);
      mesh.name = `environment:shallow-water:${chunk.id}`; mesh.renderOrder = 1;
      const color = new Color();
      cells.forEach((cell, index) => {
        const shade = .85 + .15 * hash2D(this.world.biomes.seed ^ 0x47182, cell.columnX, cell.columnZ);
        mesh.setColorAt(index, color.setRGB(shade * .88, shade, shade));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.batches.set(chunk.id, { mesh, cells }); this.group.add(mesh);
    }
    // New batches must reflect buildings that were already present while unloaded.
    this.revision = -1; this.sync();
  }

  unload(chunks: readonly WorldChunk[]): void {
    for (const chunk of chunks) {
      const batch = this.batches.get(chunk.id); if (!batch) continue;
      this.group.remove(batch.mesh); batch.mesh.dispose(); this.batches.delete(chunk.id);
    }
  }

  /** Hide an entire wet cell when a building overlaps it. */
  sync(): void {
    if (this.revision === this.world.buildings.revision) return;
    this.revision = this.world.buildings.revision;
    const buildings = this.world.buildings.all(), dummy = new Object3D();
    for (const { mesh, cells } of this.batches.values()) {
      cells.forEach((cell, index) => {
        const half = cell.size / 2;
        const hidden = buildings.some(({ transform: { footprint: f } }) =>
          f.minX < cell.x + half && f.maxX > cell.x - half && f.minZ < cell.z + half && f.maxZ > cell.z - half);
        dummy.position.set(cell.x, cell.y, cell.z); dummy.scale.setScalar(hidden ? 0 : cell.size * .99);
        dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    }
  }

  dispose(): void {
    for (const { mesh } of this.batches.values()) mesh.dispose();
    this.batches.clear(); this.group.clear(); this.geometry.dispose(); this.material.dispose();
  }
}
