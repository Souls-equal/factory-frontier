import type { CellConveyorShape } from '../logistics/CellConveyor';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { AutoConveyorShape } from '../logistics/AutoConveyor';
import type { MachineState } from '../machines/Miner';
import { ConveyorPath } from '../logistics/ConveyorPath';
import { CONVEYOR_SHAPES, BELT_HEIGHT, isLiftBuilding, liftInputOffset, liftOutputOffset } from '../logistics/ConveyorDefinitions';
import type { ConveyorState } from '../logistics/ConveyorNetwork';
import type { BuildingRegistry } from '../buildings/BuildingRegistry';
import type { BuildingInstance, PlacementResult } from '../buildings/BuildingSystem';
import { addConveyorDetails, addFoundationDetails, addMinerDetails, addTerminalDetails } from './BuildingDetails';

/** Rendering-only consumer of logical building state, with a separate preview. */
export class BuildingView {
  readonly group = new Group();
  private readonly meshes = new Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>();
  private preview: Mesh<BoxGeometry, MeshStandardMaterial> | null = null;
  private previewType: string | null = null;
  private readonly shapes = new Map<string, string>();
  private readonly routePreviews = new Map<number, { readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial>; readonly key: string }>();
  private previewShape = '';
  private readonly changedPreviews = new Map<string, { readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial>; readonly key: string }>();
  constructor(private readonly registry: BuildingRegistry, private readonly cellSize: number) {}

  sync(buildings: readonly BuildingInstance[]): void {
    // Draw each coplanar foundation cell once, even when paid slabs overlap.
    const foundationOwners = new Map<string, number[]>();
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
      if (building.typeId === 'foundation') {
        let shared = false;
        const visible = new Map<string, boolean>();
        for (const x of [-.5, .5]) for (const z of [-.5, .5]) {
          const turn = ((building.transform.rotation % 4) + 4) % 4;
          const cos = [1, 0, -1, 0][turn]!, sin = [0, 1, 0, -1][turn]!;
          const wx = building.transform.x + (x * cos + z * sin) * this.cellSize;
          const wz = building.transform.z + (-x * sin + z * cos) * this.cellSize;
          const key = `${Math.round(wx / this.cellSize - .5)},${Math.round(wz / this.cellSize - .5)}`;
          const heights = foundationOwners.get(key) ?? [];
          const duplicate = heights.some((y) => Math.abs(y - building.transform.y) < 1e-7);
          visible.set(`${x},${z}`, !duplicate); shared ||= duplicate;
          if (!duplicate) { heights.push(building.transform.y); foundationOwners.set(key, heights); }
        }
        for (const part of mesh.children) {
          const cell = part.userData.foundationCell as string | undefined;
          if (cell) part.visible = visible.get(cell) ?? false;
          else if (part.name.startsWith('foundation-') || part.name === 'orientation-marker') part.visible = !shared;
        }
      }
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
    this.tintPreview(mesh, placement.reason === 'valid', (typeId === 'conveyor-auto' || typeId === 'conveyor-cell' || typeId === 'smelter' || typeId === 'constructor' || typeId === 'storage-container' || typeId === 'splitter' || typeId === 'merger' || isLiftBuilding(typeId)));
  }
  /** Additional cells after the first, which uses the normal placement preview. */
  setRoutePreview(cells: readonly BuildingInstance[], valid: boolean): void {
    for (const [i, entry] of this.routePreviews) if (i >= cells.length) {
      this.release(entry.mesh); this.routePreviews.delete(i);
    }
    cells.forEach((cell, i) => {
      const key = JSON.stringify([cell.typeId, cell.cellConveyor, cell.autoConveyor]);
      let entry = this.routePreviews.get(i);
      if (entry && entry.key !== key) { this.release(entry.mesh); this.routePreviews.delete(i); entry = undefined; }
      if (!entry) {
        const mesh = this.createMesh(cell.typeId, true, cell.autoConveyor, cell.cellConveyor);
        mesh.name = `route-preview:${i + 1}`;
        entry = { mesh, key }; this.routePreviews.set(i, entry); this.group.add(mesh);
      }
      const def = this.registry.get(cell.typeId);
      entry.mesh.position.set(cell.transform.x, cell.transform.y + def.height / 2, cell.transform.z);
      entry.mesh.rotation.y = cell.transform.rotation * Math.PI / 2;
      this.tintPreview(entry.mesh, valid, true);
    });
  }
  private tintPreview(mesh: Mesh<BoxGeometry, MeshStandardMaterial>, valid: boolean, showPorts: boolean): void {
    const color = valid ? 0x55e8b2 : 0xff5363;
    mesh.material.color.setHex(color);
    for (const child of mesh.children) if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
      child.material.color.setHex(valid && showPorts && (child.name === 'conveyor-input' || child.name === 'machine-input-port') ? 0x59dce1 :
        valid && showPorts && (child.name === 'conveyor-output' || child.name === 'machine-output-port') ? 0xf5d056 : color);
    }
  }
  dispose(): void {
    for (const mesh of this.meshes.values()) this.release(mesh);
    this.meshes.clear();
    for (const { mesh } of this.changedPreviews.values()) this.release(mesh);
    this.changedPreviews.clear();
    for (const { mesh } of this.routePreviews.values()) this.release(mesh);
    this.routePreviews.clear();
    if (this.preview) this.release(this.preview);
    this.preview = null; this.previewType = null; this.group.clear();
  }
  private createMesh(typeId: string, preview: boolean, auto?: AutoConveyorShape, cell?: CellConveyorShape): Mesh<BoxGeometry, MeshStandardMaterial> {
    const def = this.registry.get(typeId);
    // The terminal's inset shell leaves its protective corner frame visible;
    // authoritative footprint and port positions remain unchanged.
    const shellInset = typeId === 'receiving-terminal' ? .88 : 1;
    const geometry = new BoxGeometry(def.widthCells * this.cellSize * shellInset, def.height, def.depthCells * this.cellSize * shellInset);
    const material = new MeshStandardMaterial({ color: def.color, transparent: preview, opacity: preview ? 0.5 : 1,
      depthWrite: !preview, roughness: 0.8 });
    const mesh = new Mesh(geometry, material); mesh.castShadow = !preview; mesh.receiveShadow = !preview;
    if (typeId === 'power-pole') {
      material.transparent = true; material.opacity = 0; material.depthWrite = false; mesh.castShadow = false;
      const part = (w: number, h: number, d: number, y: number, color: number): void => {
        const object = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
        object.position.y = y - def.height / 2; object.castShadow = !preview; mesh.add(object);
      };
      part(.7 * this.cellSize, .25, .7 * this.cellSize, .125, 0x616f72);
      part(.2 * this.cellSize, 2.4, .2 * this.cellSize, 1.3, 0x828b85);
      part(.8 * this.cellSize, .17, .2 * this.cellSize, 2.45, 0xe2b64e);
    }
    if (typeId === 'biomass-generator') {
      const vent = new Mesh(new BoxGeometry(.9 * this.cellSize, .35, .05), new MeshStandardMaterial({ color: 0x343f3b, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
      vent.position.set(0, .25, -this.cellSize - .03); mesh.add(vent);
      const cap = new Mesh(new BoxGeometry(.7 * this.cellSize, .2, .7 * this.cellSize), new MeshStandardMaterial({ color: 0xd0a35a, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
      cap.position.set(0, def.height / 2 + .1, 0); mesh.add(cap);
    }
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
      addMinerDetails(mesh, scale, def.height, preview);
    }
    if (typeId === 'smelter') {
      const part = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, name: string): void => {
        const object = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: .75, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
        object.position.set(x, y - def.height / 2, z); object.name = name; object.castShadow = !preview; mesh.add(object);
      };
      const scale = this.cellSize;
      part(0x444e50, 0, .20, 0, 1.95 * scale, .4, 1.95 * scale, 'smelter-base');
      part(0x303c40, 0, 1.1, -.503 * scale, .9 * scale, .9, .035 * scale, 'smelter-furnace');
      part(0xf28638, 0, 1.06, -.53 * scale, .65 * scale, .55, .025 * scale, 'smelter-glow');
      part(0x3c4a4d, .55 * scale, 2.38, .45 * scale, .32 * scale, .8, .32 * scale, 'smelter-stack');
      part(0x59dce1, 0, .5, scale, .65 * scale, .24, .035 * scale, 'machine-input-port');
      part(0xf5d056, 0, .5, -scale, .65 * scale, .24, .035 * scale, 'machine-output-port');
      part(0x59656c, -.55 * scale, 1.65, -1.015 * scale, .24, .24, .04, 'machine-indicator');
    }
    if (typeId === 'constructor') {
      const part = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, name: string): void => {
        const object = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: .75, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
        object.position.set(x, y - def.height / 2, z); object.name = name; object.castShadow = !preview; mesh.add(object);
      };
      const scale = this.cellSize;
      part(0x33494e, 0, .18, 0, 1.95 * scale, .36, 1.95 * scale, 'constructor-base');
      part(0x384e55, 0, 1.25, -1.015 * scale, 1.2 * scale, 1.15, .04 * scale, 'constructor-panel');
      part(0x9caeb0, 0, 1.25, -1.045 * scale, .78 * scale, .58, .03 * scale, 'constructor-press');
      part(0x283e43, 0, 2.15, 0, 1.45 * scale, .22, 1.3 * scale, 'constructor-crown');
      part(0x59dce1, 0, .5, scale, .65 * scale, .24, .035 * scale, 'machine-input-port');
      part(0xf5d056, 0, .5, -scale, .65 * scale, .24, .035 * scale, 'machine-output-port');
      part(0x59656c, -.65 * scale, 1.7, -1.04 * scale, .24, .24, .04, 'machine-indicator');
    }
    if (typeId === 'splitter') {
      const part = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, name: string): void => {
        const object = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: .75, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
        object.position.set(x, y - def.height / 2, z); object.name = name; object.castShadow = !preview; mesh.add(object);
      };
      const scale = this.cellSize;
      part(0x3c4d63, 0, .15, 0, 1.95 * scale, .3, 1.95 * scale, 'splitter-base');
      part(0x9db6bf, 0, 1.25, 0, 1.1 * scale, .1, 1.1 * scale, 'splitter-top');
      part(0x59dce1, 0, .5, scale, .65 * scale, .24, .035 * scale, 'machine-input-port');
      part(0xf5d056, 0, .5, -scale, .65 * scale, .24, .035 * scale, 'machine-output-port');
      part(0xf5d056, scale, .5, 0, .035 * scale, .24, .65 * scale, 'machine-output-port');
      part(0xf5d056, -scale, .5, 0, .035 * scale, .24, .65 * scale, 'machine-output-port');
    }
    if (isLiftBuilding(typeId)) {
      material.transparent = true; material.opacity = 0; material.depthWrite = false; mesh.castShadow = false;
      const part = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, name: string): void => {
        const object = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: .75, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
        object.position.set(x, y - def.height / 2, z); object.name = name; object.castShadow = !preview; mesh.add(object);
      };
      const scale = this.cellSize, top = Math.max(liftInputOffset(typeId, scale), liftOutputOffset(typeId, scale)) + .5;
      for (const x of [-.48 * scale, .48 * scale]) for (const z of [-.22 * scale, .22 * scale])
        part(0x526e78, x, top / 2, z, .12 * scale, top, .12 * scale, 'lift-rail');
      part(0x59dce1, 0, .5 + liftInputOffset(typeId, scale), scale, .65 * scale, .22, .12 * scale, 'machine-input-port');
      part(0xf5d056, 0, .5 + liftOutputOffset(typeId, scale), -scale, .65 * scale, .22, .12 * scale, 'machine-output-port');
      part(0x829ba1, 0, top + .15, 0, 1.15 * scale, .2, .65 * scale, 'lift-cap');
    }
    if (typeId === 'merger') {
      const part = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, name: string): void => {
        const object = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: .75, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
        object.position.set(x, y - def.height / 2, z); object.name = name; object.castShadow = !preview; mesh.add(object);
      };
      const scale = this.cellSize;
      part(0x53483d, 0, .15, 0, 1.95 * scale, .3, 1.95 * scale, 'merger-base');
      part(0xd2c09b, 0, 1.25, 0, 1.1 * scale, .1, 1.1 * scale, 'merger-top');
      part(0x59dce1, 0, .5, scale, .65 * scale, .24, .035 * scale, 'machine-input-port');
      part(0xf5d056, 0, .5, -scale, .65 * scale, .24, .035 * scale, 'machine-output-port');
      part(0x59dce1, scale, .5, 0, .035 * scale, .24, .65 * scale, 'machine-input-port');
      part(0x59dce1, -scale, .5, 0, .035 * scale, .24, .65 * scale, 'machine-input-port');
    }
    if (typeId === 'storage-container') {
      const part = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, name: string): void => {
        const object = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: .8, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview }));
        object.position.set(x, y - def.height / 2, z); object.name = name; object.castShadow = !preview; mesh.add(object);
      };
      const scale = this.cellSize;
      part(0x374b45, 0, .15, 0, 1.95 * scale, .3, 1.95 * scale, 'storage-base');
      part(0x394e46, 0, 1.7, 0, 1.9 * scale, .2, 1.9 * scale, 'storage-lid');
      part(0xa7b6a1, 0, 1.1, -1.015 * scale, 1.3 * scale, .45, .04 * scale, 'storage-panel');
      part(0x59dce1, 0, .5, scale, .65 * scale, .24, .035 * scale, 'machine-input-port');
      part(0xf5d056, 0, .5, -scale, .65 * scale, .24, .035 * scale, 'machine-output-port');
    }
    const shape = typeId === 'conveyor-auto' ? (auto?.shape ?? 'straight') : typeId === 'conveyor-cell' && cell?.rise ? 'incline' : Object.hasOwn(CONVEYOR_SHAPES, typeId) ? CONVEYOR_SHAPES[typeId] : undefined;
    if (shape) {
      material.transparent = true; material.opacity = 0; material.depthWrite = false; mesh.castShadow = false;
      const path = new ConveyorPath({ shape, x: 0, y: BELT_HEIGHT + (typeId === 'conveyor-cell' ? cell?.offset ?? 0 : auto?.offset ?? 0), z: 0, rotation: 0,
        size: (typeId === 'conveyor-cell' ? 1 : 2) * this.cellSize, ...(typeId === 'conveyor-cell' ? { rise: cell?.rise ?? 0 } : auto ? { rise: auto.rise } : shape === 'incline' ? { rise: this.cellSize } : {}) });
      const count = shape.startsWith('curve-') ? 16 : 1;
      const geometry = new BoxGeometry(.8 * this.cellSize, .12, typeId === 'conveyor-cell' ? this.cellSize : path.length / count + .004);
      const belt = new MeshStandardMaterial({ color: typeId === 'conveyor-cell' && cell?.entries.some((entry) => Math.abs(entry.x) > 1e-8) ? 0x276a75 : 0x377c82, roughness: .8, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview });
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
          if (typeId === 'conveyor-cell' && cell?.entries.some((entry) => entry.x * -sign > 1e-8)) continue;
          const rail = new Mesh(railGeometry, rails);
          rail.position.copy(midpoint).addScaledVector(side, sign * .45 * this.cellSize); rail.position.y += .05;
          rail.quaternion.copy(piece.quaternion); rail.name = 'conveyor-rail'; rail.castShadow = !preview; mesh.add(rail);
        }
      }
      // Entry ramps are confined to the receiving tile; downward transfers
      // use them rather than embedding a descending belt inside solid ground.
      if (typeId === 'conveyor-cell' && cell) for (const entry of cell.entries) {
        const horizontal = Math.hypot(entry.x, entry.z), startY = BELT_HEIGHT + entry.startHeight, endY = BELT_HEIGHT + (cell.offset ?? 0) + cell.rise / 2;
        const deckAtEntry = BELT_HEIGHT + (cell.offset ?? 0) + cell.rise * (.5 - entry.z / this.cellSize);
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
      // Curved guide strips explicitly show every lateral route into the output.
      // Their elevation follows the same entry interpolation as transported items.
      if (typeId === 'conveyor-cell' && cell) for (const entry of cell.entries.filter((e) => Math.abs(e.x) > 1e-8)) {
        const guideMaterial = new MeshStandardMaterial({ color: 0xf5d056, roughness: .7, transparent: preview, opacity: preview ? .65 : 1, depthWrite: !preview });
        const guide = (t: number): Vector3 => {
          const height = t <= .5 ? entry.startHeight * (1 - 2 * t) + cell.rise * t : cell.rise * (.5 + .8 * (t - .5));
          return new Vector3(entry.x * .85 * (1 - t) ** 2, BELT_HEIGHT + height + .09 - def.height / 2,
            entry.z * (1 - t) ** 2 - .4 * this.cellSize * t ** 2);
        };
        for (let i = 0; i < 10; i++) {
          const a = guide(i / 10), b = guide((i + 1) / 10), delta = b.clone().sub(a);
          const stripe = new Mesh(new BoxGeometry(.045 * this.cellSize, .02, delta.length() + .004), guideMaterial);
          stripe.position.copy(a).add(b).multiplyScalar(.5);
          stripe.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), delta.normalize());
          stripe.name = 'conveyor-turn-guide'; mesh.add(stripe);
        }
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
      lamp.position.set((typeId === 'conveyor-cell' ? -.38 : -.43) * this.cellSize, path.point(path.length * .2).y - def.height / 2 + .12, (typeId === 'conveyor-cell' ? .3 : .6) * this.cellSize);
      lamp.name = 'conveyor-indicator'; mesh.add(lamp);
      // Keep the centre-entry ramps unobstructed when belts join from the side.
      if (typeId === 'conveyor-cell' && !cell?.entries.length) addConveyorDetails(mesh, this.cellSize, def.height, preview);
      for (const fraction of [.2, .8]) {
        const p = path.point(path.length * fraction), height = Math.max(.12, p.y - .1);
        const supportGeometry = new BoxGeometry((typeId === 'conveyor-cell' ? .14 : .65) * this.cellSize, height, .18 * this.cellSize);
        const supportMaterial = new MeshStandardMaterial({ color: typeId === 'conveyor-cell' ? 0x657b7b : 0xd4d5b8, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview });
        for (const side of typeId === 'conveyor-cell' ? [-.25, .25] : [0]) {
          const support = new Mesh(supportGeometry, supportMaterial);
          support.position.set(p.x + side * this.cellSize, height / 2 - def.height / 2, p.z); support.name = 'conveyor-support'; mesh.add(support);
        }
      }
    }
    if (typeId === 'foundation') {
      // Split the shell into four grid cells, so overlapping slabs render only
      // the cells not already drawn by an earlier coplanar foundation.
      material.transparent = true; material.opacity = 0; material.depthWrite = false; mesh.castShadow = false;
      const shellGeometry = new BoxGeometry(this.cellSize, def.height, this.cellSize);
      const shellMaterial = new MeshStandardMaterial({ color: def.color, transparent: preview,
        opacity: preview ? .5 : 1, depthWrite: !preview, roughness: .8 });
      const tileGeometry = new BoxGeometry(.88 * this.cellSize, .025, .88 * this.cellSize);
      const tileMaterial = new MeshStandardMaterial({ color: 0x94a5a2, transparent: preview,
        opacity: preview ? .55 : 1, depthWrite: !preview, roughness: .9 });
      for (const x of [-.5, .5]) for (const z of [-.5, .5]) {
        const cell = new Mesh(shellGeometry, shellMaterial); cell.name = 'foundation-cell';
        cell.position.set(x * this.cellSize, 0, z * this.cellSize); cell.userData.foundationCell = `${x},${z}`;
        cell.castShadow = !preview; cell.receiveShadow = !preview; mesh.add(cell);
        const tile = new Mesh(tileGeometry, tileMaterial); tile.name = 'foundation-tile';
        tile.position.set(x * this.cellSize, def.height / 2 + .013, z * this.cellSize); tile.userData.foundationCell = `${x},${z}`;
        tile.receiveShadow = !preview; mesh.add(tile);
      }
      addFoundationDetails(mesh, this.cellSize, def.height, preview);
    }
    if (typeId === 'receiving-terminal') {
      const port = new Mesh(new BoxGeometry(.45 * this.cellSize, .3, .12),
        new MeshStandardMaterial({ color: 0x59dce1, transparent: preview, opacity: preview ? .65 : 1, depthWrite: !preview }));
      port.position.set(0, BELT_HEIGHT - def.height / 2, this.cellSize); port.name = 'terminal-input-port'; mesh.add(port);
      for (let side = 0; side < 4; side++) {
        const edge = new Mesh(new BoxGeometry(1.6 * this.cellSize, .12, .06 * this.cellSize),
          new MeshStandardMaterial({ color: 0x59dce1, transparent: preview, opacity: preview ? .65 : 1, depthWrite: !preview }));
        edge.rotation.y = side * Math.PI / 2;
        edge.position.set(Math.sin(side * Math.PI / 2) * this.cellSize * .97, BELT_HEIGHT - def.height / 2 + .16,
          Math.cos(side * Math.PI / 2) * this.cellSize * .97);
        edge.name = 'terminal-input-edge'; mesh.add(edge);
      }
      const panel = new Mesh(new BoxGeometry(1.25 * this.cellSize, .46, .08 * this.cellSize),
        new MeshStandardMaterial({ color: 0x354a53, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
      panel.position.set(0, .23 - def.height / 2, -this.cellSize); panel.name = 'terminal-panel'; mesh.add(panel);
      const lid = new Mesh(new BoxGeometry(1.72 * this.cellSize, .12, 1.72 * this.cellSize),
        new MeshStandardMaterial({ color: 0x93a4a1, transparent: preview, opacity: preview ? .55 : 1, depthWrite: !preview }));
      lid.position.set(0, def.height / 2 - .06, 0); lid.name = 'terminal-lid'; mesh.add(lid);
      addTerminalDetails(mesh, this.cellSize, def.height, preview);
    }
    // Mark slab and legacy orientation; the refreshed machine and one-cell belt show their ports.
    if (!['miner-mk1', 'conveyor-cell', 'receiving-terminal'].includes(typeId)) {
      const stripe = new Mesh(new BoxGeometry(def.widthCells * this.cellSize * 0.55, 0.02, 0.08),
        new MeshStandardMaterial({ color: 0xf1d66d, transparent: preview, opacity: preview ? 0.8 : 1, depthWrite: !preview }));
      stripe.position.set(0, def.height / 2 + (typeId === 'foundation' ? .03 : .015), -def.depthCells * this.cellSize * 0.35);
      stripe.name = 'orientation-marker'; mesh.add(stripe);
    }
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
