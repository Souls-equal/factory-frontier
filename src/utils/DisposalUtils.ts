import type { Material, Object3D } from 'three';

/**
 * Dispose every geometry and material reachable from `root`, then detach its
 * children so the scene graph no longer keeps GPU resources alive.
 *
 * Three.js does not dispose GPU resources automatically; forgetting this is a
 * common source of memory leaks in long-running games.
 */
export function disposeObjectTree(root: Object3D): void {
  const geometries = new Set<{ dispose: () => void }>();
  const materials = new Set<Material>();

  root.traverse((object) => {
    const renderable = object as Object3D & {
      geometry?: { dispose: () => void };
      material?: Material | Material[];
    };

    if (renderable.geometry !== undefined) {
      geometries.add(renderable.geometry);
    }

    const material = renderable.material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        materials.add(entry);
      }
    } else if (material !== undefined) {
      materials.add(material);
    }
  });

  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    material.dispose();
  }

  root.clear();
}
