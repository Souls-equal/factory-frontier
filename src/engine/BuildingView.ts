import type { CellConveyorShape } from '../logistics/CellConveyor';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { AutoConveyorShape } from '../logistics/AutoConveyor';
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
  private readonly shapes = new Map<string, string>();
  private previewShape = '';
  private readonly changedPreviews = new Map<string, { readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial>; readonly key: string }>();
  constructor(private readonly registry: BuildingRegistry, private readonly cellSize: number) {}

  sync(buildings: readonly BuildingInstance[]): void {
    const present = new Set(buildings.map((building) => building.id));
    for (const [id, mesh] of this.meshes) {
      if (!present.has(id)) { this.release(mesh); this.meshes.delete(id); this.shapes.delete(id); }
    }
    for (const building of buildings) {
      let mesh = this.meshes.get(building.id);
      const shapeKey = JSON.stringify([building.autoConveyor ?? null, building.cellConveyor ?? null]);
      if (mesh && this.shapes.get(building.id) !== shapeKey) { this.release(mesh); this.meshes.delete(building.id); mesh = undefined; }
      if (!mesh) {
        mesh = this.createMesh(building.typeId, false, building.autoConveyor, building.cellConveyor);
        this.shapes.set(building.id, shapeKey);
        mesh.name = building.id; this.meshes.set(building.id, mesh); this.group.add(mesh);
      }
      const definition = this.registry.get(building.typeId);
      mesh.position.set(building.transform.x, building.transform.y + definition.height / 2, building.transform.z);
      mesh.rotation.y = (building.autoConveyor?.rotation ?? building.transform.rotation) * Math.PI / 2;
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
    // Existing meshes remain authoritative; hide only those replaced by a valid
    // hypothetical shape and restore them when the pointer or mode changes.
    for (const mesh of this.meshes.values()) mesh.visible = true;
    const changes = placement?.reason === 'valid' && typeId !== null ? placement.conveyorPreviewChanges ?? [] : [];
    const wanted = new Set(changes.map((b) => b.id));
    for (const [id, entry] of this.changedPreviews) if (!wanted.has(id) || !this.meshes.has(id)) {
      this.release(entry.mesh); this.changedPreviews.delete(id);
    }
    for (const building of changes) {
      const original = this.meshes.get(building.id);
      if (!original) continue;
      original.visible = false;
      const key = JSON.stringify([building.typeId, building.autoConveyor, building.cellConveyor, building.transform]);
      let entry = this.changedPreviews.get(building.id);
      if (entry && entry.key !== key) { this.release(entry.mesh); this.changedPreviews.delete(building.id); entry = undefined; }
      if (!entry) {
        const mesh = this.createMesh(building.typeId, true, building.autoConveyor, building.cellConveyor);
        mesh.name = `building-change-preview:${building.id}`;
        entry = { mesh, key }; this.changedPreviews.set(building.id, entry); this.group.add(mesh);
      }
      const definition = this.registry.get(building.typeId);
      entry.mesh.position.set(building.transform.x, building.transform.y + definition.height / 2, building.transform.z);
      entry.mesh.rotation.y = (building.autoConveyor?.rotation ?? building.transform.rotation) * Math.PI / 2;
      this.tintPreview(entry.mesh, true, true);
    }
    if (typeId === null || !placement) {
      if (this.preview) this.release(this.preview);
      this.preview = null; this.previewType = null; return;
    }
    const shapeKey = JSON.stringify([placement.autoConveyor ?? null, placement.cellConveyor ?? null]);
    if (this.previewType !== typeId || this.previewShape !== shapeKey) {
      if (this.preview) this.release(this.preview);
      this.preview = this.createMesh(typeId, true, placement.autoConveyor, placement.cellConveyor); this.preview.name = 'building-preview';
      this.previewType = typeId; this.previewShape = shapeKey; this.group.add(this.preview);
    }
    const mesh = this.preview!; const definition = this.registry.get(typeId);
    mesh.position.set(placement.transform.x, placement.transform.y + definition.height / 2, placement.transform.z);
    mesh.rotation.y = (placement.autoConveyor?.rotation ?? placement.transform.rotation) * Math.PI / 2;
    this.tintPreview(mesh, placement.reason === 'valid', (typeId === 'conveyor-auto' || typeId === 'conveyor-cell'));
  }
  private tintPreview(mesh: Mesh<BoxGeometry, MeshStandardMaterial>, valid: boolean, showPorts: boolean): void {
    const color = valid ? 0x55e8b2 : 0xff5363;
    mesh.material.color.setHex(color);
    for (const child of mesh.children) if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
      child.material.color.setHex(valid && showPorts && child.name === 'conveyor-input' ? 0x59dce1 :
        valid && showPorts && child.name === 'conveyor-output' ? 0xf5d056 : color);
    }
  }
  dispose(): void {
    for (const mesh of this.meshes.values()) this.release(mesh);
    this.meshes.clear();
    for (const { mesh } of this.changedPreviews.values()) this.release(mesh);
    this.changedPreviews.clear();
    if (this.preview) this.release(this.preview);
    this.preview = null; this.previewType = null; this.group.clear();
  }
  private createMesh(typeId: string, preview: boolean, auto?: AutoConveyorShape, cell?: CellConveyorShape): Mesh<BoxGeometry, MeshStandardMaterial> {
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
    const shape = typeId === 'conveyor-auto' ? (auto?.shape ?? 'straight') : typeId === 'conveyor-cell' && cell?.rise ? 'incline' : CONVEYOR_SHAPES[typeId];
    if (shape) {
      material.transparent = true; material.opacity = 0; material.depthWrite = false; mesh.castShadow = false;
      const path = new ConveyorPath({ shape, x: 0, y: BELT_HEIGHT + (auto?.offset ?? 0), z: 0, rotation: 0,
        size: (typeId === 'conveyor-cell' ? 1 : 2) * this.cellSize, ...(typeId === 'conveyor-cell' ? { rise: cell?.rise ?? 0 } : auto ? { rise: auto.rise } : shape === 'incline' ? { rise: this.cellSize } : {}) });
      const count = shape.startsWith('curve-') ? 16 : 1;
      const geometry = new BoxGeometry(.8 * this.cellSize, .12, typeId === 'conveyor-cell' ? this.cellSize : path.length / count + .004);
      const belt = new MeshStandardMaterial({ color: 0x377c82, roughness: .8, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview });
      const railGeometry = new BoxGeometry(.09 * this.cellSize, .17, typeId === 'conveyor-cell' ? this.cellSize : path.length / count + .004);
      if (typeId === 'conveyor-cell' && cell?.rise) {
        for (const g of [geometry, railGeometry]) {
          const vertices = g.attributes.position!;
          for (let n = 0; n < vertices.count; n++) vertices.setY(n, vertices.getY(n) + vertices.getZ(n) * cell.rise / this.cellSize);
          g.computeVertexNormals();
        }
      }
      const rails = new MeshStandardMaterial({ color: 0xf3b75d, roughness: .7, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview });
      for (let i = 0; i < count; i++) {
        const a = path.point(i * path.length / count), b = path.point((i + 1) * path.length / count);
        const piece = new Mesh(geometry, belt); const tangent = new Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
        const midpoint = new Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 - def.height / 2, (a.z + b.z) / 2);
        piece.position.copy(midpoint);
        piece.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), typeId === 'conveyor-cell' ? new Vector3(0, 0, -1) : tangent); piece.name = 'conveyor-surface'; piece.castShadow = !preview; piece.receiveShadow = !preview; mesh.add(piece);
        const side = new Vector3(tangent.z, 0, -tangent.x).normalize();
        for (const sign of [-1, 1]) {
          const rail = new Mesh(railGeometry, rails);
          rail.position.copy(midpoint).addScaledVector(side, sign * .45 * this.cellSize); rail.position.y += .05;
          rail.quaternion.copy(piece.quaternion); rail.name = 'conveyor-rail'; rail.castShadow = !preview; mesh.add(rail);
        }
      }
      // Entry ramps are confined to the receiving tile; downward transfers
      // use them rather than embedding a descending belt inside solid ground.
      if (typeId === 'conveyor-cell' && cell) for (const entry of cell.entries) {
        const horizontal = Math.hypot(entry.x, entry.z), startY = BELT_HEIGHT + entry.startHeight, endY = BELT_HEIGHT + cell.rise / 2;
        const deckAtEntry = BELT_HEIGHT + cell.rise * (.5 - entry.z / this.cellSize);
        if (horizontal < 1e-9 || Math.abs(startY - deckAtEntry) < 1e-8) continue;
        const rampGeometry = new BoxGeometry(.48 * this.cellSize, .06, horizontal);
        const vertices = rampGeometry.attributes.position!;
        for (let n = 0; n < vertices.count; n++) vertices.setY(n, vertices.getY(n) + vertices.getZ(n) * (endY - startY) / horizontal);
        rampGeometry.computeVertexNormals();
        const ramp = new Mesh(rampGeometry, new MeshStandardMaterial({ color: 0x377c82, roughness: .8, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
        ramp.position.set(entry.x / 2, (startY + endY) / 2 - def.height / 2, entry.z / 2);
        ramp.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(-entry.x / horizontal, 0, -entry.z / horizontal));
        ramp.name = 'conveyor-entry-ramp'; mesh.add(ramp);
      }
      // Short bright transverse treads follow the same centreline on turns and ramps.
      const treadGeometry = new BoxGeometry(.52 * this.cellSize, .025, .08 * this.cellSize);
      const treadMaterial = new MeshStandardMaterial({ color: 0x9bd8c5, roughness: .75, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview });
      for (let i = 0; i < 5; i++) {
        const distance = path.length * (i + .5) / 5, p = path.point(distance);
        const a = path.point(Math.max(0, distance - .01)), b = path.point(Math.min(path.length, distance + .01));
        const tangent = new Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
        const tread = new Mesh(treadGeometry, treadMaterial); tread.name = 'conveyor-tread';
        tread.position.set(p.x, p.y - def.height / 2 + .075, p.z);
        tread.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), tangent); mesh.add(tread);
      }
      // Coloured end markers show flow: cyan = inlet, yellow = outlet.
      for (const [distance, color, name] of [[0, 0x59dce1, 'conveyor-input'], [path.length, 0xf5d056, 'conveyor-output']] as const) {
        const p = typeId === 'conveyor-cell' ? path.point(distance === 0 ? path.length * .12 : path.length * .88) : path.point(distance);
        const marker = new Mesh(new BoxGeometry(.22 * (typeId === 'conveyor-cell' ? this.cellSize : 1), .12, .22 * (typeId === 'conveyor-cell' ? this.cellSize : 1)), new MeshStandardMaterial({ color, transparent: preview, opacity: preview ? .65 : 1, depthWrite: !preview }));
        marker.position.set(p.x, p.y - def.height / 2 + .1, p.z); marker.name = name; mesh.add(marker);
      }
      const lamp = new Mesh(new BoxGeometry(.18 * (typeId === 'conveyor-cell' ? this.cellSize : 1), .15, .18 * (typeId === 'conveyor-cell' ? this.cellSize : 1)), new MeshStandardMaterial({ color: 0xdd6954, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
      lamp.position.set((typeId === 'conveyor-cell' ? -.38 : -.43) * this.cellSize, BELT_HEIGHT - def.height / 2 + .12, (typeId === 'conveyor-cell' ? .3 : .6) * this.cellSize);
      lamp.name = 'conveyor-indicator'; mesh.add(lamp);
      for (const fraction of [.2, .8]) {
        const p = path.point(path.length * fraction), height = Math.max(.12, p.y - .1);
        const support = new Mesh(new BoxGeometry(.65 * this.cellSize, height, .18 * this.cellSize),
          new MeshStandardMaterial({ color: 0xd4d5b8, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
        support.position.set(p.x, height / 2 - def.height / 2, p.z); support.name = 'conveyor-support'; mesh.add(support);
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
