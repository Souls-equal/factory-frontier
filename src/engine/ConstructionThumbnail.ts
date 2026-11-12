import { AmbientLight, Box3, DirectionalLight, OrthographicCamera, Scene, Vector3 } from 'three';
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
import type { BuildingRegistry } from '../buildings/BuildingRegistry';
import { BuildingView } from './BuildingView';

/** Static menu illustration from the actual placed-building meshes; no extra WebGL context. */
export function createConstructionThumbnail(registry: BuildingRegistry, cellSize: number, typeId: string): SVGElement {
  const definition = registry.get(typeId);
  const view = new BuildingView(registry, cellSize);
  try {
    view.sync([{ id: 'thumbnail', typeId, transform: { x: 0, y: 0, z: 0, rotation: 0,
      footprint: { minX: -definition.widthCells * cellSize / 2, maxX: definition.widthCells * cellSize / 2,
        minZ: -definition.depthCells * cellSize / 2, maxZ: definition.depthCells * cellSize / 2 } } }]);
    const scene = new Scene(); scene.add(view.group);
    scene.add(new AmbientLight(0xa8b4b9));
    const light = new DirectionalLight(0xffffff, 1.1); light.position.set(4, 8, -5); scene.add(light);
    const box = new Box3().setFromObject(view.group), center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const extent = Math.max(size.length() * .6, .5);
    const camera = new OrthographicCamera(-extent, extent, extent, -extent, .01, 1000);
    camera.position.copy(center).add(new Vector3(4, 3, -5).normalize().multiplyScalar(extent * 4));
    camera.lookAt(center); camera.updateProjectionMatrix();
    const renderer = new SVGRenderer(); renderer.setSize(144, 144); renderer.setPrecision(2);
    renderer.render(scene, camera);
    const svg = renderer.domElement;
    svg.style.backgroundColor = 'transparent';
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    return svg;
  } finally {
    view.dispose();
  }
}
