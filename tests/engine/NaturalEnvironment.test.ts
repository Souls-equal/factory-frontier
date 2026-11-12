import { describe, expect, it, vi } from 'vitest';
import { InstancedMesh, Mesh, MeshStandardMaterial, NearestFilter, SRGBColorSpace } from 'three';
import { createGameConfig } from '../../src/core/Configuration';
import { EnvironmentView } from '../../src/engine/EnvironmentView';
import { createNaturalTexture } from '../../src/engine/NaturalTextures';
import { createRockGeometry } from '../../src/engine/NaturalModels';
import { createWorld } from '../../src/world/World';

describe('natural environment visuals', () => {
  it('makes deterministic, distinct image textures with pixel filtering', () => {
    const first = createNaturalTexture(['grass', 'grass-side', 'dirt']);
    const second = createNaturalTexture(['grass', 'grass-side', 'dirt']);
    expect(first.image.width).toBe(96); expect(first.image.height).toBe(32);
    expect(first.image.data).toEqual(second.image.data);
    expect(first.colorSpace).toBe(SRGBColorSpace); expect(first.magFilter).toBe(NearestFilter);
    const pixel = (x: number, y: number) => [...first.image.data!.slice((y * 96 + x) * 4, (y * 96 + x) * 4 + 3)];
    expect(pixel(4, 4)).not.toEqual(pixel(36, 4)); // grass top versus earth
    expect(pixel(36, 31)).not.toEqual(pixel(36, 4)); // grassy side cap over earth
    first.dispose(); second.dispose();
  });
  it('maps each terrain face to its top, grassy side or deep dirt tile without changing geometry', () => {
    const world = createWorld(createGameConfig({ world: { resolution: 24, obstacleCount: 4, sizeMeters: 80 } }));
    const view = new EnvironmentView(world), terrain = view.group.getObjectByName('environment:terrain') as Mesh;
    const data = world.terrain.getRenderData(), uv = terrain.geometry.getAttribute('uv');
    const material = terrain.material as MeshStandardMaterial, texture = material.map!;
    expect(texture).toBeTruthy(); expect(uv.count).toBe(data.vertexCount);
    let tops = 0, sides = 0, dirt = 0;
    for (let face = 0; face < data.faceCount; face++) {
      const p = face * 12, nx = data.normals[p]!, ny = data.normals[p + 1]!, nz = data.normals[p + 2]!;
      const x = (data.positions[p]! + data.positions[p + 6]!) / 2 - nx * world.terrain.blockSize * .01;
      const z = (data.positions[p + 2]! + data.positions[p + 8]!) / 2 - nz * world.terrain.blockSize * .01;
      const top = Math.max(data.positions[p + 1]!, data.positions[p + 4]!);
      const tile = ny === 1 ? 0 : Math.abs(top - world.terrain.heightAt(x, z)) < .001 * world.terrain.blockSize ? 1 : 2;
      expect(Math.floor(uv.getX(face * 4) * 3)).toBe(tile);
      if (tile === 0) tops++; else if (tile === 1) sides++; else dirt++;
    }
    expect(tops).toBeGreaterThan(0); expect(sides).toBeGreaterThan(0); expect(dirt).toBeGreaterThan(0);
    const disposed = vi.spyOn(texture, 'dispose'); view.dispose(); expect(disposed).toHaveBeenCalledOnce();
  });
  it('keeps rock variants bounded and uses textured models for each natural object', () => {
    for (let variant = 0; variant < 3; variant++) {
      const geometry = createRockGeometry(variant), positions = geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(24); expect(geometry.getAttribute('uv').count).toBe(positions.count);
      for (let i = 0; i < positions.count; i++) {
        expect(Math.hypot(positions.getX(i), positions.getZ(i))).toBeLessThanOrEqual(1);
        expect(positions.getY(i)).toBeGreaterThanOrEqual(0); expect(positions.getY(i)).toBeLessThanOrEqual(1);
      }
      geometry.dispose();
    }
    const world = createWorld(createGameConfig({ world: { resolution: 24, obstacleCount: 10, sizeMeters: 80 } }));
    const before = JSON.stringify({ obstacles: world.obstacleDefinitions, gatherables: world.gatherables.definitions });
    const view = new EnvironmentView(world);
    const textures = new Set<NonNullable<MeshStandardMaterial['map']>>();
    for (const object of view.group.getObjectByName('environment:rocks')!.children) {
      expect(object).toBeInstanceOf(InstancedMesh);
      textures.add(((object as InstancedMesh).material as MeshStandardMaterial).map!);
      expect(((object as InstancedMesh).material as MeshStandardMaterial).map).not.toBeNull();
    }
    for (const kind of ['tree', 'branch', 'stone'] as const) {
      const def = world.gatherables.definitions.find(d => d.kind === kind)!;
      const model = view.group.getObjectByName(`environment:gatherable:${def.id}`)!;
      const pieces = model.children.filter((o): o is Mesh => o instanceof Mesh && o.name !== `${model.name}:highlight-ring`);
      expect(pieces.length).toBe(kind === 'tree' ? 3 : 1);
      if (kind === 'branch') expect(pieces[0]!.geometry.getAttribute('position').count).toBeGreaterThan(24);
      expect(pieces.every(mesh => (mesh.material as MeshStandardMaterial).map !== null)).toBe(true);
      pieces.forEach(mesh => textures.add((mesh.material as MeshStandardMaterial).map!));
      expect(model.position.y).toBe(def.y);
    }
    expect(JSON.stringify({ obstacles: world.obstacleDefinitions, gatherables: world.gatherables.definitions })).toBe(before);
    const disposals = [...textures].map(texture => vi.spyOn(texture, 'dispose'));
    view.dispose(); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
  });
});
