import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { World } from '../world/World';
import type { VoxelColumnRange } from '../world/terrain/VoxelTerrain';
import { hash2D } from '../world/noise';
import { ChunkManager, type ChunkChanges, type WorldChunk } from '../world/ChunkManager';
import { createNaturalTexture, terrainTileUv } from './NaturalTextures';

/** The shared chunk lifecycle drives terrain meshes; gameplay state remains resident. */
export class TerrainChunkView {
  readonly group = new Group();
  private readonly loaded = new Map<string, Mesh>();
  private readonly texture = createNaturalTexture(['grass', 'grass-side', 'dirt', 'stone', 'sand', 'forest-floor', 'moss-stone', 'sand-ripple']);
  private readonly material = new MeshStandardMaterial({ vertexColors: true, map: this.texture, roughness: .96, metalness: .04 });
  private readonly chunks: ChunkManager;

  constructor(private readonly world: World, private readonly fogDistance = 265, chunkColumns = 64) {
    if (!Number.isFinite(fogDistance) || fogDistance < 0 || !Number.isSafeInteger(chunkColumns) || chunkColumns < 1 || chunkColumns > 512)
      throw new RangeError('Invalid terrain streaming options.');
    this.chunks = new ChunkManager(world, chunkColumns);
    this.group.name = 'environment:terrain';
    this.setFocus(world.spawn.x, world.spawn.z);
  }

  loadedChunks(): readonly WorldChunk[] { return this.chunks.all(); }

  /** Coverage bounds the camera frustum out to fog; extra chunk covers edge positions. */
  setFocus(x: number, z: number, coverage = this.fogDistance): ChunkChanges {
    const { loaded, unloaded } = this.chunks.update(x, z, coverage);
    for (const chunk of unloaded) {
      const mesh = this.loaded.get(chunk.id);
      if (mesh) { this.group.remove(mesh); mesh.geometry.dispose(); this.loaded.delete(chunk.id); }
    }
    for (const chunk of loaded) {
      const mesh = this.createMesh(chunk.range); mesh.name = `environment:terrain:${chunk.id}`;
      mesh.userData.range = chunk.range; this.loaded.set(chunk.id, mesh); this.group.add(mesh);
    }
    return { loaded, unloaded };
  }

  private createMesh(range: VoxelColumnRange): Mesh {
    const { world } = this, data = world.terrain.getRenderData(range);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
    geometry.setIndex(new BufferAttribute(data.indices, 1));
    const colors = new Float32Array(data.vertexCount * 3), uv = new Float32Array(data.vertexCount * 2);
    for (let face = 0; face < data.faceCount; face++) {
      const p = face * 12, nx = data.normals[p]!, ny = data.normals[p + 1]!, nz = data.normals[p + 2]!;
      const x = (data.positions[p]! + data.positions[p + 6]!) / 2 - nx * world.terrain.blockSize * .01;
      const z = (data.positions[p + 2]! + data.positions[p + 8]!) / 2 - nz * world.terrain.blockSize * .01;
      const topY = Math.max(data.positions[p + 1]!, data.positions[p + 4]!);
      const biome = world.biomes.at(x, z);
      const patch = hash2D(world.biomes.seed ^ 0x431b, Math.floor(x / 5), Math.floor(z / 5));
      const tile = biome === 'desert' ? (ny === 1 && patch > .55 ? 7 : 4)
        : biome === 'highlands' ? (ny === 1 && patch > .65 ? 6 : 3)
        : ny === 1 ? ((biome === 'forest' || biome === 'wetlands') && patch > .25 ? 5 : 0)
        : Math.abs(topY - world.terrain.heightAt(x, z)) < world.terrain.blockSize * .001 ? 1 : 2;
      const [u0, v0, u1, v1] = terrainTileUv(tile, 8);
      uv.set([u0, v0, u0, v1, u1, v1, u1, v0], face * 8);
      // Position-based shade is stable across unloading, reloading and chunk sizes.
      const shade = .91 + .09 * hash2D(world.biomes.seed ^ 0x17a39, Math.floor(x / world.terrain.blockSize), Math.floor(z / world.terrain.blockSize));
      for (let vertex = 0; vertex < 4; vertex++) colors.set(biome === 'wetlands' ? [shade * .72, shade * .88, shade * .75] : biome === 'forest' ? [shade * .78, shade, shade * .76] : [shade, shade, shade], p + vertex * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, this.material); mesh.receiveShadow = true;
    return mesh;
  }

  dispose(): void {
    for (const mesh of this.loaded.values()) mesh.geometry.dispose();
    this.loaded.clear(); this.chunks.clear(); this.group.clear(); this.material.dispose(); this.texture.dispose();
  }
}
