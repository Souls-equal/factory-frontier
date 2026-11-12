import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { MachineState } from '../machines/Miner';
import { ConveyorPath } from '../logistics/ConveyorPath';
import { CONVEYOR_SHAPES, BELT_HEIGHT } from '../logistics/ConveyorDefinitions';
import type { ConveyorState } from '../logistics/ConveyorNetwork';
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
  setMachineStates(states: readonly { readonly id: string; readonly state: MachineState }[]): void {
    const colors: Record<MachineState, number> = { RUNNING: 0x38ed8c, IDLE: 0xb8b8b8, NO_POWER: 0xff713a,
      MISSING_INPUT: 0xffa426, OUTPUT_FULL: 0xffd436, DISABLED: 0x59656c, ERROR: 0xff3535 };
    for (const { id, state } of states) {
      const lamp = this.meshes.get(id)?.getObjectByName('machine-indicator');
      if (lamp instanceof Mesh && lamp.material instanceof MeshStandardMaterial) {
        lamp.material.color.setHex(colors[state]); lamp.material.emissive.setHex(colors[state]);
        lamp.material.emissiveIntensity = state === 'RUNNING' ? 0.8 : 0.3;
      }
    }
  }
  setConveyorStates(states: readonly { readonly id: string; readonly state: ConveyorState }[]): void {
    const colors: Record<ConveyorState, number> = { RUNNING: 0x38ed8c, IDLE: 0xa8c7cf, BLOCKED: 0xffca47,
      DISCONNECTED: 0xdd6954, INVALID: 0xff3b48, ERROR: 0xff3b48 };
    for (const { id, state } of states) {
      const lamp = this.meshes.get(id)?.getObjectByName('conveyor-indicator');
      if (lamp instanceof Mesh && lamp.material instanceof MeshStandardMaterial) lamp.material.color.setHex(colors[state]);
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
    const color = placement.reason === 'valid' ? 0x55e8b2 : 0xff5363;
    mesh.material.color.setHex(color);
    for (const child of mesh.children) if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) child.material.color.setHex(color);
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
    if (typeId === 'miner-mk1') {
      material.transparent = true; material.opacity = 0; material.depthWrite = false; mesh.castShadow = false;
      const part = (shape: BoxGeometry, color: number, x: number, y: number, z: number, name: string): void => {
        const object = new Mesh(shape, new MeshStandardMaterial({ color, roughness: .65, transparent: preview, opacity: preview ? .45 : 1, depthWrite: !preview }));
        object.position.set(x, y - def.height / 2, z); object.name = name; object.castShadow = !preview; object.receiveShadow = !preview; mesh.add(object);
      };
      const scale = this.cellSize;
      part(new BoxGeometry(1.8 * scale, .28, 1.8 * scale), 0x65777c, 0, .14, 0, 'miner-base');
      part(new BoxGeometry(1.3 * scale, 1.2, 1.25 * scale), 0xb58035, 0, 1.1, 0, 'miner-body');
      part(new BoxGeometry(.76 * scale, .6, .76 * scale), 0x627882, 0, .35, 0, 'miner-drill');
      part(new BoxGeometry(.9 * scale, .38, .9 * scale), 0x92a0a0, 0, 1.89, 0, 'miner-head');
      part(new BoxGeometry(.55 * scale, .22, .55 * scale), 0xd1ae64, 0, 2.19, 0, 'miner-head-cap');
      part(new BoxGeometry(.25, .25, .12), 0x59656c, .48 * scale, 1.4, -.65 * scale, 'machine-indicator');
      part(new BoxGeometry(.45 * scale, .3, .16), 0xf5d056, 0, .5, -scale, 'machine-output-port');
    }
    const shape = CONVEYOR_SHAPES[typeId];
    if (shape) {
      material.transparent = true; material.opacity = 0; material.depthWrite = false; mesh.castShadow = false;
      const path = new ConveyorPath({ shape, x: 0, y: BELT_HEIGHT, z: 0, rotation: 0,
        size: 2 * this.cellSize, ...(shape === 'incline' ? { rise: this.cellSize } : {}) });
      const count = shape === 'curve-right' ? 16 : 1;
      const geometry = new BoxGeometry(.8 * this.cellSize, .12, path.length / count + .004);
      const belt = new MeshStandardMaterial({ color: 0x425961, roughness: .85, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview });
      for (let i = 0; i < count; i++) {
        const a = path.point(i * path.length / count), b = path.point((i + 1) * path.length / count);
        const piece = new Mesh(geometry, belt); const tangent = new Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
        piece.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 - def.height / 2, (a.z + b.z) / 2);
        piece.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), tangent); piece.name = 'conveyor-surface'; mesh.add(piece);
      }
      // Coloured end markers show flow: cyan = inlet, yellow = outlet.
      for (const [distance, color, name] of [[0, 0x59dce1, 'conveyor-input'], [path.length, 0xf5d056, 'conveyor-output']] as const) {
        const p = path.point(distance);
        const marker = new Mesh(new BoxGeometry(.22, .12, .22), new MeshStandardMaterial({ color, transparent: preview, opacity: preview ? .65 : 1, depthWrite: !preview }));
        marker.position.set(p.x, p.y - def.height / 2 + .1, p.z); marker.name = name; mesh.add(marker);
      }
      const lamp = new Mesh(new BoxGeometry(.18, .15, .18), new MeshStandardMaterial({ color: 0xdd6954, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
      lamp.position.set(-.43 * this.cellSize, BELT_HEIGHT - def.height / 2 + .12, .6 * this.cellSize);
      lamp.name = 'conveyor-indicator'; mesh.add(lamp);
      for (const z of [-.6 * this.cellSize, .6 * this.cellSize]) {
        const support = new Mesh(new BoxGeometry(.9 * this.cellSize, .35, .16),
          new MeshStandardMaterial({ color: 0x7e8b8a, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
        support.position.set(0, .175 - def.height / 2, z); support.name = 'conveyor-support'; mesh.add(support);
      }
    }
    if (typeId === 'foundation') {
      // Shallow inset blocks retain the logical footprint while making the slab legible.
      const tileGeometry = new BoxGeometry(.88 * this.cellSize, .025, .88 * this.cellSize);
      const tileMaterial = new MeshStandardMaterial({ color: 0x94a5a2, transparent: preview,
        opacity: preview ? .55 : 1, depthWrite: !preview, roughness: .9 });
      for (const x of [-.47 * this.cellSize, .47 * this.cellSize]) for (const z of [-.47 * this.cellSize, .47 * this.cellSize]) {
        const tile = new Mesh(tileGeometry, tileMaterial); tile.name = 'foundation-tile';
        tile.position.set(x, def.height / 2 + .013, z); tile.receiveShadow = !preview; mesh.add(tile);
      }
    }
    if (typeId === 'receiving-terminal') {
      const port = new Mesh(new BoxGeometry(.45 * this.cellSize, .3, .12),
        new MeshStandardMaterial({ color: 0x59dce1, transparent: preview, opacity: preview ? .65 : 1, depthWrite: !preview }));
      port.position.set(0, BELT_HEIGHT - def.height / 2, this.cellSize); port.name = 'terminal-input-port'; mesh.add(port);
      const panel = new Mesh(new BoxGeometry(1.25 * this.cellSize, .46, .08 * this.cellSize),
        new MeshStandardMaterial({ color: 0x354a53, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
      panel.position.set(0, .23 - def.height / 2, -this.cellSize); panel.name = 'terminal-panel'; mesh.add(panel);
      const lid = new Mesh(new BoxGeometry(1.72 * this.cellSize, .12, 1.72 * this.cellSize),
        new MeshStandardMaterial({ color: 0x93a4a1, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
      lid.position.set(0, def.height / 2 - .06, 0); lid.name = 'terminal-lid'; mesh.add(lid);
    }
    // A contrasting north-edge stripe makes quarter-turns visible even for a square footprint.
    const stripe = new Mesh(new BoxGeometry(def.widthCells * this.cellSize * 0.55, 0.02, 0.08),
      new MeshStandardMaterial({ color: 0xf1d66d, transparent: preview, opacity: preview ? 0.8 : 1, depthWrite: !preview }));
    stripe.position.set(0, def.height / 2 + 0.015, -def.depthCells * this.cellSize * 0.35);
    stripe.name = 'orientation-marker'; mesh.add(stripe);
    return mesh;
  }
  private release(mesh: Mesh<BoxGeometry, MeshStandardMaterial>): void {
    this.group.remove(mesh);
    const geometries = new Set<object>(), materials = new Set<object>();
    for (const child of mesh.children) {
      if (child instanceof Mesh) {
        if (!geometries.has(child.geometry)) { geometries.add(child.geometry); child.geometry.dispose(); }
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          if (!materials.has(material)) { materials.add(material); material.dispose(); }
        }
      }
    }
    mesh.geometry.dispose(); mesh.material.dispose();
  }
}
