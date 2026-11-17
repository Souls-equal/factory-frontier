import { BoxGeometry, BufferAttribute, Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BiomeDecorationField, type Decoration, type DecorationKind } from '../world/BiomeDecorations';
import type { World } from '../world/World';
import type { Footprint } from '../buildings/Transform';
import type { WorldChunk } from '../world/ChunkManager';

/** Presentation-only detail: never registered for physics, targeting or placement. */
type Kind = DecorationKind;
type Part = { x: number; y: number; z: number; w: number; h: number; d: number; color: number; yaw?: number };

type Batch = { mesh: InstancedMesh; decorations: Decoration[] };
type Asset = { geometry: BufferGeometry; material: MeshStandardMaterial };

const PARTS: Record<Kind, readonly Part[]> = {
  reeds: [
    { x: -.10, y: .30, z: 0, w: .07, h: .60, d: .07, color: 0x567447 },
    { x: .10, y: .40, z: .08, w: .07, h: .80, d: .07, color: 0x729250 },
    { x: .10, y: .81, z: .08, w: .10, h: .20, d: .10, color: 0x765944 },
    { x: -.10, y: .62, z: 0, w: .09, h: .16, d: .09, color: 0x7e6046 },
  ],
  meadow: [
    { x: -.10, y: .15, z: 0, w: .08, h: .30, d: .08, color: 0x689c48, yaw: .2 },
    { x: .10, y: .20, z: .08, w: .09, h: .40, d: .09, color: 0x88b75a, yaw: -.3 },
    { x: 0, y: .12, z: -.12, w: .07, h: .24, d: .07, color: 0x4e843c },
  ],
  flower: [
    { x: 0, y: .18, z: 0, w: .06, h: .36, d: .06, color: 0x578c42 },
    { x: 0, y: .40, z: 0, w: .27, h: .09, d: .09, color: 0xffd2dd },
    { x: 0, y: .40, z: 0, w: .09, h: .09, d: .27, color: 0xffd2dd },
    { x: 0, y: .45, z: 0, w: .08, h: .04, d: .08, color: 0xffdc67 },
  ],
  fern: [
    { x: 0, y: .19, z: 0, w: .08, h: .38, d: .08, color: 0x376c3e },
    { x: 0, y: .28, z: 0, w: .58, h: .09, d: .14, color: 0x528b4d, yaw: .3 },
    { x: 0, y: .36, z: 0, w: .12, h: .09, d: .45, color: 0x6aa15a, yaw: .3 },
    { x: 0, y: .44, z: 0, w: .27, h: .09, d: .09, color: 0x8ebc71, yaw: -.3 },
  ],
  scrub: [
    { x: 0, y: .20, z: 0, w: .10, h: .40, d: .10, color: 0x927440 },
    { x: -.13, y: .29, z: 0, w: .30, h: .08, d: .10, color: 0xb59957, yaw: .3 },
    { x: .12, y: .39, z: 0, w: .26, h: .08, d: .10, color: 0xd1b575, yaw: -.4 },
    { x: 0, y: .33, z: .11, w: .08, h: .08, d: .25, color: 0xb59957 },
  ],
  alpine: [
    { x: 0, y: .07, z: 0, w: .48, h: .14, d: .34, color: 0x687d58 },
    { x: .08, y: .18, z: 0, w: .06, h: .25, d: .06, color: 0x688b54 },
    { x: .08, y: .32, z: 0, w: .18, h: .08, d: .18, color: 0xc3a8d3 },
  ],
};

function geometryFor(kind: Kind): BufferGeometry {
  const parts = PARTS[kind].map(part => {
    const box = new BoxGeometry(part.w, part.h, part.d);
    box.rotateY(part.yaw ?? 0); box.translate(part.x, part.y, part.z);
    const color = new Color(part.color), colors = new Float32Array(box.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
    box.setAttribute('color', new BufferAttribute(colors, 3));
    return box;
  });
  const result = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return result;
}

/** Bounded, seeded instance batches. Only updates when building topology changes. */
export class BiomeDecorationView {
  readonly group = new Group();
  private readonly batches = new Map<string, Batch[]>();
  private readonly assets = new Map<Kind, Asset>();
  private readonly field: BiomeDecorationField;
  private revision = -1;
  constructor(private readonly world: World, private readonly chunkColumns = 64) {
    if (!Number.isSafeInteger(chunkColumns) || chunkColumns < 1 || chunkColumns > 512) throw new RangeError('Invalid decoration chunk size.');
    this.group.name = 'environment:biome-details';
    this.field = new BiomeDecorationField(world);
  }

  /** Create render batches only for newly loaded terrain chunks. */
  load(chunks: readonly WorldChunk[]): void {
    if (!chunks.length) return;
    const t = this.world.terrain, width = this.chunkColumns;
    for (const { x, z, range } of chunks) {
      if (range.minX !== x * width || range.minZ !== z * width ||
          range.maxX !== Math.min((x + 1) * width, t.columnsX) ||
          range.maxZ !== Math.min((z + 1) * width, t.columnsZ))
        throw new RangeError('Decoration chunks must use the configured chunk size.');
    }
    for (const chunk of chunks) {
      if (this.batches.has(chunk.id)) continue;
      const records: Record<Kind, Decoration[]> = { meadow: [], flower: [], fern: [], scrub: [], alpine: [], reeds: [] };
      for (const { kind, decoration } of this.field.inBounds(chunk.bounds)) records[kind].push(decoration);
      const batches: Batch[] = [];
      for (const kind of Object.keys(records) as Kind[]) {
        const decorations = records[kind]; if (!decorations.length) continue;
        let asset = this.assets.get(kind);
        if (!asset) {
          asset = { geometry: geometryFor(kind), material: new MeshStandardMaterial({ vertexColors: true, roughness: .95 }) };
          this.assets.set(kind, asset);
        }
        const mesh = new InstancedMesh(asset.geometry, asset.material, decorations.length);
        mesh.name = `environment:detail:${chunk.id}:${kind}`;
        mesh.receiveShadow = true;
        const color = new Color();
        decorations.forEach((item, i) => mesh.setColorAt(i, color.setHex(item.tint)));
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        batches.push({ mesh, decorations }); this.group.add(mesh);
      }
      this.batches.set(chunk.id, batches);
    }
    // Newly created instances must reflect buildings already present on return.
    this.revision = -1; this.sync();
  }

  unload(chunks: readonly WorldChunk[]): void {
    for (const chunk of chunks) {
      for (const { mesh } of this.batches.get(chunk.id) ?? []) { this.group.remove(mesh); mesh.dispose(); }
      this.batches.delete(chunk.id);
    }
  }

  /** Hide details beneath any building, and restore them after demolition. */
  sync(): void {
    if (this.revision === this.world.buildings.revision) return;
    this.revision = this.world.buildings.revision;
    // Spatial buckets avoid checking every factory footprint against every tuft.
    const buckets = new Map<string, Footprint[]>();
    const cell = 8, key = (x: number, z: number) => `${x},${z}`;
    for (const building of this.world.buildings.all()) {
      const f = building.transform.footprint;
      for (let z = Math.floor((f.minZ - .35) / cell); z <= Math.floor((f.maxZ + .35) / cell); z++)
        for (let x = Math.floor((f.minX - .35) / cell); x <= Math.floor((f.maxX + .35) / cell); x++) {
          const id = key(x, z), list = buckets.get(id) ?? []; list.push(f); buckets.set(id, list);
        }
    }
    const dummy = new Object3D();
    for (const batches of this.batches.values()) for (const { mesh, decorations } of batches) {
      decorations.forEach((item, i) => {
        const hidden = (buckets.get(key(Math.floor(item.x / cell), Math.floor(item.z / cell))) ?? []).some(f => item.x >= f.minX - .35 && item.x <= f.maxX + .35 && item.z >= f.minZ - .35 && item.z <= f.maxZ + .35);
        dummy.position.set(item.x, item.y, item.z); dummy.rotation.set(0, item.yaw, 0);
        dummy.scale.setScalar(hidden ? 0 : item.scale); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  dispose(): void {
    for (const batches of this.batches.values()) for (const { mesh } of batches) mesh.dispose();
    this.batches.clear(); this.group.clear();
    for (const { geometry, material } of this.assets.values()) { geometry.dispose(); material.dispose(); }
    this.assets.clear();
  }
}
