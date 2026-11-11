import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry as BufferGeometryType,
  type Material,
} from 'three';

import type { World } from '../world/World';
import type { InteractableDefinition } from '../world/World';

/**
 * Renderer for the Phase 1 environment.
 *
 * The view is a pure consumer of world data: it never computes gameplay values
 * and never owns player state. Terrain vertices come from
 * `TerrainHeightfield.getRenderData()`, so what is drawn is exactly what
 * physics collides with.
 *
 * Performance notes:
 * - one merged terrain mesh with vertex colours (no textures, one draw call),
 * - boulders and formations share three instanced meshes,
 * - geometries and materials are created once and disposed together,
 * - the only per-frame work is toggling a highlight ring.
 */

const SKY_RADIUS = 480;

/** Palette shared with the UI: cool industrial twilight. */
const PALETTE = Object.freeze({
  lowland: new Color(0x24322c),
  land: new Color(0x2f4238),
  highland: new Color(0x475459),
  rock: new Color(0x4c585d),
  ridge: new Color(0x5c6a6f),
  skyZenith: new Color(0x060d16),
  skyHorizon: new Color(0x1d3a44),
  skyWarm: new Color(0x4a4a3c),
  sun: new Color(0xffe4b5),
});

interface HighlightBinding {
  readonly ring: Mesh;
  readonly cap: Mesh;
  readonly capMaterial: MeshStandardMaterial;
}

export class EnvironmentView {
  readonly group: Group;

  private readonly highlightBindings = new Map<string, HighlightBinding>();
  private readonly geometries: BufferGeometryType[] = [];
  private readonly materials: Material[] = [];
  private highlightedId: string | null = null;

  constructor(world: World) {
    this.group = new Group();
    this.group.name = 'environment';

    this.group.add(this.createSky());
    this.group.add(this.createTerrain(world));
    this.group.add(this.createRocks(world));

    const props = new Group();
    props.name = 'environment:props';
    for (const interactable of world.interactables) {
      props.add(this.createInteractableProp(interactable));
    }
    this.group.add(props);
  }

  /**
   * Toggle the interaction highlight. Called from a presentation frame system;
   * only the change costs anything.
   */
  setHighlight(id: string | null): void {
    if (this.highlightedId === id) {
      return;
    }
    this.highlightedId = id;

    for (const [key, binding] of this.highlightBindings) {
      const active = key === id;
      binding.ring.visible = active;
      binding.capMaterial.emissiveIntensity = active ? 3.2 : 1.4;
    }
  }

  get highlighted(): string | null {
    return this.highlightedId;
  }

  dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.highlightBindings.clear();
    // Resources were disposed explicitly above; only detach the graph here.
    this.group.clear();
  }

  // --- construction ---------------------------------------------------------

  private createSky(): Mesh {
    const geometry = new SphereGeometry(SKY_RADIUS, 24, 16);
    const position = geometry.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const color = new Color();

    for (let index = 0; index < position.count; index += 1) {
      const normalizedY = position.getY(index) / SKY_RADIUS; // -1..1
      const elevation = Math.max(normalizedY, 0);

      if (normalizedY < 0) {
        color.copy(PALETTE.skyHorizon).lerp(PALETTE.skyZenith, 0.35);
      } else {
        color.copy(PALETTE.skyHorizon).lerp(PALETTE.skyZenith, Math.min(1, elevation * 1.35));
        // Warm haze band just above the horizon.
        const haze = Math.max(0, 1 - Math.abs(normalizedY - 0.06) * 9);
        color.lerp(PALETTE.skyWarm, haze * 0.28);
      }

      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    const material = new MeshBasicMaterial({
      vertexColors: true,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });

    const sky = new Mesh(geometry, material);
    sky.name = 'environment:sky';
    sky.frustumCulled = false;
    this.registerGeometry(geometry);
    this.registerMaterial(material);
    return sky;
  }

  private createTerrain(world: World): Mesh {
    const data = world.terrain.getRenderData();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
    geometry.setIndex(new BufferAttribute(data.indices, 1));

    const colors = new Float32Array(data.vertexCount * 3);
    this.writeTerrainColors(data.positions, data.normals, world.terrain.maxHeight, colors);
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.04,
    });

    const terrain = new Mesh(geometry, material);
    terrain.name = 'environment:terrain';
    terrain.receiveShadow = true;

    this.registerGeometry(geometry);
    this.registerMaterial(material);
    return terrain;
  }

  /** Height/slope driven vertex colours: grass flats, rock on steep faces. */
  private writeTerrainColors(
    positions: Float32Array,
    normals: Float32Array,
    maxHeight: number,
    target: Float32Array,
  ): void {
    const color = new Color();
    const heightRange = Math.max(maxHeight, 1);

    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      const height = positions[vertex * 3 + 1] ?? 0;
      const normalY = normals[vertex * 3 + 1] ?? 1;

      const heightT = clamp01(height / heightRange);
      const steepness = clamp01((1 - normalY) / 0.3);

      color.copy(PALETTE.lowland).lerp(PALETTE.land, clamp01(heightT * 3));
      color.lerp(PALETTE.highland, clamp01((heightT - 0.25) * 1.6));
      color.lerp(PALETTE.ridge, clamp01((heightT - 0.6) * 2.2));
      color.lerp(PALETTE.rock, steepness * 0.85);

      // Subtle per-vertex variation breaks up flat areas without textures.
      const variation = 0.92 + 0.16 * ((vertex * 2654435761) % 1000) / 1000;
      target[vertex * 3] = color.r * variation;
      target[vertex * 3 + 1] = color.g * variation;
      target[vertex * 3 + 2] = color.b * variation;
    }
  }

  private createRocks(world: World): Group {
    const rocks = new Group();
    rocks.name = 'environment:rocks';

    const solids = world.obstacleDefinitions.filter((obstacle) => obstacle.kind !== 'prop');
    if (solids.length === 0) {
      return rocks;
    }

    const variants: BufferGeometryType[] = [
      new IcosahedronGeometry(1, 0),
      new DodecahedronGeometry(1, 0),
      new IcosahedronGeometry(1, 1),
    ];
    for (const geometry of variants) {
      this.registerGeometry(geometry);
    }

    const buckets: number[][] = variants.map(() => []);
    solids.forEach((obstacle, index) => {
      buckets[obstacle.variant % variants.length]?.push(index);
    });

    const dummy = new Object3D();
    const tint = new Color();

    variants.forEach((geometry, variantIndex) => {
      const indices = buckets[variantIndex];
      if (indices === undefined || indices.length === 0) {
        return;
      }

      const material = new MeshStandardMaterial({
        color: 0x59646a,
        roughness: 0.92,
        metalness: 0.08,
        flatShading: true,
      });
      this.registerMaterial(material);

      const mesh = new InstancedMesh(geometry, material, indices.length);
      mesh.name = `environment:rocks-${variantIndex}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      indices.forEach((solidIndex, instance) => {
        const obstacle = solids[solidIndex];
        if (obstacle === undefined) {
          return;
        }
        const isFormation = obstacle.kind === 'formation';
        const width = obstacle.radius;
        const height = obstacle.height;

        dummy.position.set(obstacle.x, obstacle.y + height * 0.24, obstacle.z);
        dummy.rotation.set(0, obstacle.yaw, 0);
        dummy.scale.set(width, height * (isFormation ? 0.62 : 0.55), width);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);

        // Deterministic tint variation per rock.
        const shade = 0.82 + ((solidIndex * 7919) % 100) / 320;
        tint.setRGB(shade * 0.92, shade * 0.97, shade);
        mesh.setColorAt(instance, tint);
      });

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) {
        mesh.instanceColor.needsUpdate = true;
      }
      rocks.add(mesh);
    });

    return rocks;
  }

  private createInteractableProp(definition: InteractableDefinition): Group {
    const prop = new Group();
    prop.name = `environment:prop:${definition.id}`;
    prop.position.set(definition.x, definition.baseY, definition.z);

    const metal = new MeshStandardMaterial({
      color: 0x3f525c,
      roughness: 0.5,
      metalness: 0.65,
    });
    const dark = new MeshStandardMaterial({
      color: 0x1b2830,
      roughness: 0.7,
      metalness: 0.3,
    });
    const capMaterial = new MeshStandardMaterial({
      color: 0x102b33,
      emissive: 0x5ad6e8,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    this.registerMaterial(metal);
    this.registerMaterial(dark);
    this.registerMaterial(capMaterial);

    const baseGeometry = new CylinderGeometry(1.1, 1.3, 0.28, 8);
    const mastGeometry = new CylinderGeometry(0.16, 0.24, definition.kind === 'relay-mast' ? 5.4 : 3.6, 8);
    const capGeometry = new SphereGeometry(0.32, 16, 12);
    const ringGeometry = new TorusGeometry(0.62, 0.045, 8, 28);
    this.registerGeometry(baseGeometry);
    this.registerGeometry(mastGeometry);
    this.registerGeometry(capGeometry);
    this.registerGeometry(ringGeometry);

    const mastHeight = definition.kind === 'relay-mast' ? 5.4 : 3.6;

    const base = new Mesh(baseGeometry, dark);
    base.name = `${prop.name}:base`;
    base.position.y = 0.14;
    base.castShadow = true;
    base.receiveShadow = true;

    const mast = new Mesh(mastGeometry, metal);
    mast.name = `${prop.name}:mast`;
    mast.position.y = mastHeight / 2 + 0.28;
    mast.castShadow = true;

    const cap = new Mesh(capGeometry, capMaterial);
    cap.name = `${prop.name}:cap`;
    cap.position.y = mastHeight + 0.34;

    const ringMaterial = new MeshBasicMaterial({
      color: 0x8ff3ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: BackSide,
    });
    this.registerMaterial(ringMaterial);

    const ring = new Mesh(ringGeometry, ringMaterial);
    ring.name = `${prop.name}:highlight-ring`;
    ring.position.y = mastHeight + 0.34;
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;

    prop.add(base, mast, cap, ring);
    this.highlightBindings.set(definition.id, { ring, cap, capMaterial });
    return prop;
  }

  private registerGeometry(geometry: BufferGeometryType): void {
    this.geometries.push(geometry);
  }

  private registerMaterial(material: Material): void {
    this.materials.push(material);
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
