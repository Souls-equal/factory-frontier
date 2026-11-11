import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { BuildingRegistry } from '../buildings/BuildingRegistry';
import type { BuildingInstance, PlacementResult } from '../buildings/BuildingSystem';

/** Rendering-only consumer of logical building state, with a separate preview. */
export class BuildingView {
  readonly group = new Group();
  private readonly meshes = new Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>();
  private preview: Mesh<BoxGeometry, MeshStandardMaterial> | null = null;
  private previewType: string | null = null;
  constructor(private readonly registry: BuildingRegistry, private readonly cellSize: number) {}

  sync(buildings: readonly BuildingInstance[]): void {
    const present = new Set(buildings.map((building) => building.id));
    for (const [id, mesh] of this.meshes) {
      if (!present.has(id)) { this.release(mesh); this.meshes.delete(id); }
    }
    for (const building of buildings) {
      let mesh = this.meshes.get(building.id);
      if (!mesh) {
        mesh = this.createMesh(building.typeId, false);
        mesh.name = building.id; this.meshes.set(building.id, mesh); this.group.add(mesh);
      }
      const definition = this.registry.get(building.typeId);
      mesh.position.set(building.transform.x, building.transform.y + definition.height / 2, building.transform.z);
      mesh.rotation.y = building.transform.rotation * Math.PI / 2;
    }
  }
  setPreview(typeId: string | null, placement?: PlacementResult): void {
    if (typeId === null || !placement) {
      if (this.preview) this.release(this.preview);
      this.preview = null; this.previewType = null; return;
    }
    if (this.previewType !== typeId) {
      if (this.preview) this.release(this.preview);
      this.preview = this.createMesh(typeId, true); this.preview.name = 'building-preview';
      this.previewType = typeId; this.group.add(this.preview);
    }
    const mesh = this.preview!; const definition = this.registry.get(typeId);
    mesh.position.set(placement.transform.x, placement.transform.y + definition.height / 2, placement.transform.z);
    mesh.rotation.y = placement.transform.rotation * Math.PI / 2;
    mesh.material.color.setHex(placement.reason === 'valid' ? 0x55e8b2 : 0xff5363);
  }
  dispose(): void {
    for (const mesh of this.meshes.values()) this.release(mesh);
    this.meshes.clear();
    if (this.preview) this.release(this.preview);
    this.preview = null; this.previewType = null; this.group.clear();
  }
  private createMesh(typeId: string, preview: boolean): Mesh<BoxGeometry, MeshStandardMaterial> {
    const def = this.registry.get(typeId);
    const geometry = new BoxGeometry(def.widthCells * this.cellSize, def.height, def.depthCells * this.cellSize);
    const material = new MeshStandardMaterial({ color: def.color, transparent: preview, opacity: preview ? 0.5 : 1,
      depthWrite: !preview, roughness: 0.8 });
    const mesh = new Mesh(geometry, material); mesh.castShadow = !preview; mesh.receiveShadow = !preview;
    // A contrasting north-edge stripe makes quarter-turns visible even for a square footprint.
    const stripe = new Mesh(new BoxGeometry(def.widthCells * this.cellSize * 0.55, 0.02, 0.08),
      new MeshStandardMaterial({ color: 0xf1d66d, transparent: preview, opacity: preview ? 0.8 : 1 }));
    stripe.position.set(0, def.height / 2 + 0.015, -def.depthCells * this.cellSize * 0.35);
    stripe.name = 'orientation-marker'; mesh.add(stripe);
    return mesh;
  }
  private release(mesh: Mesh<BoxGeometry, MeshStandardMaterial>): void {
    this.group.remove(mesh);
    for (const child of mesh.children) {
      if (child instanceof Mesh) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); }
    }
    mesh.geometry.dispose(); mesh.material.dispose();
  }
}
