import { BoxGeometry, BufferAttribute, Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash2D } from '../world/noise';
import type { World } from '../world/World';
import type { Footprint } from '../buildings/Transform';

/** Presentation-only detail: never registered for physics, targeting or placement. */
type Kind = 'meadow' | 'flower' | 'fern' | 'scrub' | 'alpine';
type Part = { x: number; y: number; z: number; w: number; h: number; d: number; color: number; yaw?: number };
type Decoration = { x: number; y: number; z: number; yaw: number; scale: number; tint: number };
type Candidate = { kind: Kind; decoration: Decoration; priority: number };

type Batch = { mesh: InstancedMesh; decorations: Decoration[]; geometry: BufferGeometry; material: MeshStandardMaterial };
const CAP = 2200;
const SPACING = 3;

const PARTS: Record<Kind, readonly Part[]> = {
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
  private readonly batches: Batch[] = [];
  private revision = -1;
  constructor(private readonly world: World) {
    this.group.name = 'environment:biome-details';
    const records: Record<Kind, Decoration[]> = { meadow: [], flower: [], fern: [], scrub: [], alpine: [] };
    const seed = world.biomes.seed, bounds = world.terrain.bounds;
    // There is no streaming yet: stay bounded even for extreme configurations.
    const radius = Math.min(world.playAreaRadius, 150);
    const minX = Math.ceil(Math.max(bounds.minX + 1, -radius) / SPACING);
    const maxX = Math.floor(Math.min(bounds.maxX - 1, radius) / SPACING);
    const minZ = Math.ceil(Math.max(bounds.minZ + 1, -radius) / SPACING);
    const maxZ = Math.floor(Math.min(bounds.maxZ - 1, radius) / SPACING);
    const candidates: Candidate[] = [];
    for (let gz = minZ; gz <= maxZ; gz++) for (let gx = minX; gx <= maxX; gx++) {
      const rand = (salt: number) => hash2D(seed ^ salt, gx, gz);
      const x = (gx + (rand(11) - .5) * .55) * SPACING, z = (gz + (rand(31) - .5) * .55) * SPACING;
      if (Math.hypot(x, z) > radius - 1 || Math.hypot(x - world.spawn.x, z - world.spawn.z) < 3) continue;
      const biome = world.biomes.at(x, z), chance = rand(101);
      const kind: Kind | null = biome === 'forest' ? (chance < .38 ? 'fern' : chance < .48 ? 'flower' : null)
        : biome === 'desert' ? (chance < .16 ? 'scrub' : null)
        : biome === 'highlands' ? (chance < .23 ? 'alpine' : null)
        : chance < .22 ? 'meadow' : chance < .32 ? 'flower' : null;
      if (!kind) continue;
      // Keep resource markers, solid obstacles and interactables legible.
      if (world.obstacleDefinitions.some(o => Math.hypot(o.x - x, o.z - z) < o.radius + .65) ||
          world.gatherables.definitions.some(o => Math.hypot(o.x - x, o.z - z) < o.radius + .7)) continue;
      candidates.push({ kind, priority: rand(503), decoration: { x, z, y: world.terrain.heightAt(x, z) + .01,
        yaw: rand(203) * Math.PI * 2, scale: .75 + rand(307) * .5,
        tint: kind === 'flower' ? [0xffffff, 0xffd9b3, 0xbcdcff][Math.floor(rand(409) * 3)]! : 0xffffff } });
    }
    // Seeded priorities avoid preferentially filling the cap from one edge.
    candidates.sort((a, b) => a.priority - b.priority);
    for (const candidate of candidates.slice(0, CAP)) records[candidate.kind].push(candidate.decoration);
    for (const kind of Object.keys(records) as Kind[]) {
      const decorations = records[kind]; if (!decorations.length) continue;
      const geometry = geometryFor(kind), material = new MeshStandardMaterial({ vertexColors: true, roughness: .95 });
      const mesh = new InstancedMesh(geometry, material, decorations.length);
      mesh.name = `environment:detail:${kind}`;
      mesh.receiveShadow = true;
      const color = new Color();
      decorations.forEach((item, i) => mesh.setColorAt(i, color.setHex(item.tint)));
      mesh.instanceColor!.needsUpdate = true;
      this.batches.push({ mesh, decorations, geometry, material }); this.group.add(mesh);
    }
    this.sync();
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
    for (const { mesh, decorations } of this.batches) {
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
    for (const { mesh, geometry, material } of this.batches) { mesh.dispose(); geometry.dispose(); material.dispose(); }
    this.batches.length = 0; this.group.clear();
  }
}
