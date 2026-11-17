import { describe, expect, it, vi } from 'vitest';
import { Color, InstancedMesh, Matrix4, Object3D, Vector3, type MeshStandardMaterial } from 'three';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import { EnvironmentView } from '../../src/engine/EnvironmentView';
import { RockChunkView } from '../../src/engine/RockChunkView';

function instances(view: RockChunkView | EnvironmentView): InstancedMesh[] {
  return (view.group.getObjectByName('environment:rocks')!.children as InstancedMesh[]);
}

describe('streamed natural rock visuals', () => {
  it('preserves original matrices and biome tints for each rock independent of chunk size', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 35 } }));
    const solids = world.obstacleDefinitions.filter(o => o.kind !== 'prop');
    const dummy = new Object3D(), expectedMatrix = new Matrix4(), actualMatrix = new Matrix4(), color = new Color();
    expect(solids.length).toBeGreaterThan(5);
    for (const size of [8, 16, 64]) {
      const view = new RockChunkView(world, 150, size);
      const visited = new Set<string>();
      for (const mesh of instances(view)) {
        const ids = mesh.userData.obstacleIds as string[];
        expect(ids).toHaveLength(mesh.count);
        ids.forEach((id, index) => {
          expect(visited.has(id)).toBe(false); visited.add(id);
          const solidIndex = solids.findIndex(o => o.id === id), o = solids[solidIndex]!;
          expect(solidIndex).toBeGreaterThanOrEqual(0);
          dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(0, o.yaw, 0);
          dummy.scale.set(o.radius, o.height, o.radius); dummy.updateMatrix();
          expectedMatrix.copy(dummy.matrix); mesh.getMatrixAt(index, actualMatrix);
          actualMatrix.elements.forEach((value, i) => expect(value).toBeCloseTo(expectedMatrix.elements[i]!, 5));
          const shade = .82 + ((solidIndex * 7919) % 100) / 320, biome = world.biomes.at(o.x, o.z);
          const rgb = biome === 'desert' ? [shade, shade * .82, shade * .62]
            : biome === 'forest' || biome === 'wetlands' ? [shade * .75, shade * .90, shade * .74]
            : biome === 'highlands' ? [shade * .86, shade * .91, shade] : [shade * .92, shade * .97, shade];
          mesh.getColorAt(index, color);
          expect(color.r).toBeCloseTo(rgb[0]!); expect(color.g).toBeCloseTo(rgb[1]!); expect(color.b).toBeCloseTo(rgb[2]!);
          expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
        });
      }
      expect(visited).toEqual(new Set(solids.map(o => o.id)));
      view.dispose();
    }
  });

  it('unloads and recreates meshes without affecting collision, sharing assets until disposal', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 30 } }));
    const rock = world.obstacleDefinitions.find(o => o.kind !== 'prop')!;
    const collision = () => world.obstacles.moveCircle(rock.x - rock.radius - 2, rock.z, 4, 0, .3, rock.y, rock.y + 2);
    const beforeCollision = collision(), definitions = JSON.stringify(world.obstacleDefinitions);
    const view = new EnvironmentView(world, 0, 8);
    view.setFocus(rock.x, rock.z, 0);
    const find = () => instances(view).find(m => (m.userData.obstacleIds as string[]).includes(rock.id));
    const first = find()!; expect(first).toBeDefined();
    const index = (first.userData.obstacleIds as string[]).indexOf(rock.id);
    const matrix = new Matrix4(); first.getMatrixAt(index, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).x).toBeCloseTo(rock.x);
    const meshDispose = vi.spyOn(first, 'dispose'), geometryDispose = vi.spyOn(first.geometry, 'dispose');
    const material = first.material as MeshStandardMaterial;
    const materialDispose = vi.spyOn(material, 'dispose'), textureDispose = vi.spyOn(material.map!, 'dispose');
    view.setFocus(1000, 1000, 0);
    expect(find()).toBeUndefined(); expect(meshDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled(); expect(materialDispose).not.toHaveBeenCalled();
    expect(collision()).toEqual(beforeCollision); expect(JSON.stringify(world.obstacleDefinitions)).toBe(definitions);
    view.setFocus(rock.x, rock.z, 0);
    const restored = find()!; expect(restored).not.toBe(first); expect(restored.geometry).toBe(first.geometry);
    const rebuilt = new Matrix4(); restored.getMatrixAt((restored.userData.obstacleIds as string[]).indexOf(rock.id), rebuilt);
    expect(rebuilt.elements).toEqual(matrix.elements);
    view.setFocus(rock.x, rock.z, 0);
    expect(instances(view).flatMap(m => m.userData.obstacleIds as string[]).filter(id => id === rock.id)).toHaveLength(1);
    const restoredDispose = vi.spyOn(restored, 'dispose');
    view.dispose(); expect(restoredDispose).toHaveBeenCalledOnce(); expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce(); expect(textureDispose).toHaveBeenCalledOnce();
  });

  it('retains large formations whose centres lie beyond the view range and handles empty worlds', () => {
    const world = createWorld(createGameConfig({ world: { sizeMeters: 80, resolution: 32, obstacleCount: 0 } }));
    const empty = new RockChunkView(world, 0, 1); expect(instances(empty)).toHaveLength(0); empty.dispose();
    const formation = { id: 'formation-test', kind: 'formation' as const, x: 7, y: 0, z: 0, radius: 6, height: 6, yaw: 0, variant: 1 };
    const fixture = { ...world, obstacleDefinitions: [...world.obstacleDefinitions, formation] };
    const view = new RockChunkView(fixture, 0, 1);
    view.setFocus(0, 0, 4);
    expect(instances(view).some(m => (m.userData.obstacleIds as string[]).includes(formation.id))).toBe(true);
    const snapshot = instances(view).map(m => m.name);
    view.setFocus(0, 0, -1); expect(instances(view).map(m => m.name)).toEqual(snapshot);
    view.dispose();
  });
});
