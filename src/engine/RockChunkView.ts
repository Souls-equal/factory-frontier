import { Color, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { World } from '../world/World';
import { ChunkManager, type WorldChunk } from '../world/ChunkManager';
import { createRockGeometry } from './NaturalModels';
import { createNaturalTexture } from './NaturalTextures';

/** Chunked presentation only. Natural collider definitions remain authoritative and resident. */
export class RockChunkView {
  readonly group = new Group();
  private readonly chunks: ChunkManager;
  private readonly meshes = new Map<string, InstancedMesh[]>();
  private readonly geometries = [createRockGeometry(0), createRockGeometry(1), createRockGeometry(2)];
  private readonly texture = createNaturalTexture(['stone']);
  private readonly material = new MeshStandardMaterial({ color: 0xffffff, map: this.texture,
    roughness: .92, metalness: .08, flatShading: true });
  private readonly indices: ReadonlyMap<string, number>;
  private readonly maximumRadius: number;

  constructor(private readonly world: World, private readonly fogDistance = 265, chunkColumns = 64) {
    if (!Number.isFinite(fogDistance) || fogDistance < 0) throw new RangeError('Invalid rock streaming options.');
    this.chunks = new ChunkManager(world, chunkColumns);
    this.group.name = 'environment:rocks';
    const solids = world.obstacleDefinitions.filter(obstacle => obstacle.kind !== 'prop');
    this.indices = new Map(solids.map((obstacle, index) => [obstacle.id, index]));
    this.maximumRadius = solids.reduce((max, obstacle) => Math.max(max, obstacle.radius), 0);
    this.setFocus(world.spawn.x, world.spawn.z);
  }

  setFocus(x: number, z: number, coverage = this.fogDistance): void {
    if (!Number.isFinite(coverage) || coverage < 0) return;
    // Centres may lie outside the frustum even while part of a formation is visible.
    const changes = this.chunks.update(x, z, coverage + this.maximumRadius);
    for (const chunk of changes.unloaded) this.unload(chunk);
    for (const chunk of changes.loaded) this.load(chunk);
  }

  private load(chunk: WorldChunk): void {
    const solids = chunk.obstacles.filter(obstacle => obstacle.kind !== 'prop');
    const meshes: InstancedMesh[] = [];
    const dummy = new Object3D(), tint = new Color();
    this.geometries.forEach((geometry, variant) => {
      const obstacles = solids.filter(obstacle => obstacle.variant % this.geometries.length === variant);
      if (!obstacles.length) return;
      const mesh = new InstancedMesh(geometry, this.material, obstacles.length);
      mesh.name = `environment:rocks:${chunk.id}:${variant}`;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.obstacleIds = obstacles.map(obstacle => obstacle.id);
      obstacles.forEach((obstacle, index) => {
        dummy.position.set(obstacle.x, obstacle.y, obstacle.z);
        dummy.rotation.set(0, obstacle.yaw, 0);
        dummy.scale.set(obstacle.radius, obstacle.height, obstacle.radius);
        dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
        const solidIndex = this.indices.get(obstacle.id)!;
        const shade = .82 + ((solidIndex * 7919) % 100) / 320;
        const biome = this.world.biomes.at(obstacle.x, obstacle.z);
        if (biome === 'desert') tint.setRGB(shade, shade * .82, shade * .62);
        else if (biome === 'forest' || biome === 'wetlands') tint.setRGB(shade * .75, shade * .90, shade * .74);
        else if (biome === 'highlands') tint.setRGB(shade * .86, shade * .91, shade);
        else tint.setRGB(shade * .92, shade * .97, shade);
        mesh.setColorAt(index, tint);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh); meshes.push(mesh);
    });
    this.meshes.set(chunk.id, meshes);
  }

  private unload(chunk: WorldChunk): void {
    for (const mesh of this.meshes.get(chunk.id) ?? []) { this.group.remove(mesh); mesh.dispose(); }
    this.meshes.delete(chunk.id);
  }

  dispose(): void {
    for (const meshes of this.meshes.values()) for (const mesh of meshes) mesh.dispose();
    this.meshes.clear(); this.chunks.clear(); this.group.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.material.dispose(); this.texture.dispose();
  }
}
