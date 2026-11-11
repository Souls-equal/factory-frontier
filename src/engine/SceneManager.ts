import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Fog,
  GridHelper,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Group,
  Object3D,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  type LineBasicMaterial,
} from 'three';

import type { RenderConfig } from '../core/Configuration';
import { disposeObjectTree } from '../utils/DisposalUtils';

/**
 * Phase 0 foundation scene.
 *
 * This is deliberately a bare industrial survey site: a ground plane, a
 * construction grid, an origin pad, a beacon and instanced boundary stakes.
 * It exists to prove the render pipeline and to give a readable sense of scale
 * and orientation. No gameplay system is represented or faked here.
 */

const GROUND_SIZE = 320;
const GRID_SIZE = 300;
const GRID_DIVISIONS = 60;
const STAKE_COUNT = 48;
const STAKE_RING_RADIUS = 34;

export class SceneManager {
  readonly scene: Scene;

  constructor(config: RenderConfig) {
    this.scene = new Scene();
    this.scene.background = new Color(config.backgroundColor);
    this.scene.fog = new Fog(config.backgroundColor, 70, 280);

    this.scene.add(this.createGround());
    this.scene.add(this.createGrid(config));
    this.scene.add(this.createOriginPad());
    this.scene.add(this.createBeacon());
    this.scene.add(this.createBoundaryStakes());
  }

  dispose(): void {
    disposeObjectTree(this.scene);
  }

  private createGround(): Mesh {
    const geometry = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    const material = new MeshStandardMaterial({
      color: 0x1b2730,
      roughness: 0.95,
      metalness: 0.05,
    });

    const ground = new Mesh(geometry, material);
    ground.name = 'foundation:ground';
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    return ground;
  }

  private createGrid(config: RenderConfig): GridHelper {
    const grid = new GridHelper(GRID_SIZE, GRID_DIVISIONS, config.gridColor, 0x1a2f38);
    grid.name = 'foundation:grid';
    grid.position.y = 0.01;

    const material = grid.material as LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.55;
    material.depthWrite = false;

    return grid;
  }

  private createOriginPad(): Mesh {
    const geometry = new CylinderGeometry(6, 6.8, 0.5, 6);
    const material = new MeshStandardMaterial({
      color: 0x2c3f4c,
      roughness: 0.6,
      metalness: 0.35,
    });

    const pad = new Mesh(geometry, material);
    pad.name = 'foundation:origin-pad';
    pad.position.y = 0.25;
    pad.castShadow = true;
    pad.receiveShadow = true;
    return pad;
  }

  private createBeacon(): Group {
    const beacon = new Group();
    beacon.name = 'foundation:beacon';

    const mastGeometry = new CylinderGeometry(0.22, 0.42, 7, 8);
    const mastMaterial = new MeshStandardMaterial({
      color: 0x3d5160,
      roughness: 0.45,
      metalness: 0.7,
    });
    const mast = new Mesh(mastGeometry, mastMaterial);
    mast.name = 'foundation:beacon-mast';
    mast.position.y = 4;
    mast.castShadow = true;
    mast.receiveShadow = true;

    const capGeometry = new SphereGeometry(0.45, 16, 12);
    const capMaterial = new MeshStandardMaterial({
      color: 0x103039,
      emissive: 0x5ad6e8,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    });
    const cap = new Mesh(capGeometry, capMaterial);
    cap.name = 'foundation:beacon-cap';
    cap.position.y = 7.7;

    beacon.add(mast, cap);
    return beacon;
  }

  /**
   * Instanced boundary markers. Repeated environment objects use `InstancedMesh`
   * from the very first scene so the scalable rendering path is exercised early.
   */
  private createBoundaryStakes(): InstancedMesh {
    const geometry = new BoxGeometry(0.16, 1.2, 0.16);
    const material = new MeshStandardMaterial({
      color: 0x4a6472,
      roughness: 0.7,
      metalness: 0.2,
    });

    const stakes = new InstancedMesh(geometry, material, STAKE_COUNT);
    stakes.name = 'foundation:boundary-stakes';
    stakes.castShadow = true;
    stakes.receiveShadow = true;

    const dummy = new Object3D();
    for (let index = 0; index < STAKE_COUNT; index += 1) {
      const angle = (index / STAKE_COUNT) * Math.PI * 2;
      dummy.position.set(
        Math.cos(angle) * STAKE_RING_RADIUS,
        0.6,
        Math.sin(angle) * STAKE_RING_RADIUS,
      );
      dummy.rotation.y = -angle;
      dummy.updateMatrix();
      stakes.setMatrixAt(index, dummy.matrix);
    }
    stakes.instanceMatrix.needsUpdate = true;

    return stakes;
  }
}
