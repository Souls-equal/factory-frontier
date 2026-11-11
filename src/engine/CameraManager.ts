import { PerspectiveCamera } from 'three';

import type { RenderConfig } from '../core/Configuration';

/**
 * Owns the perspective camera.
 *
 * Phase 0 uses a fixed vantage point that frames the foundation scene. Player
 * movement and look controls belong to Phase 1 and must be added through a
 * controller rather than by mutating the camera from unrelated systems.
 */
export class CameraManager {
  readonly camera: PerspectiveCamera;

  constructor(config: RenderConfig, aspectRatio = 1) {
    this.camera = new PerspectiveCamera(config.fov, aspectRatio, config.near, config.far);
    this.camera.name = 'main-camera';
    this.camera.position.set(24, 17, 28);
    this.camera.lookAt(0, 2.5, 0);
  }

  setAspectRatio(aspectRatio: number): void {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      throw new RangeError(`Aspect ratio must be positive (received ${aspectRatio}).`);
    }
    this.camera.aspect = aspectRatio;
    this.camera.updateProjectionMatrix();
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return;
    }
    this.setAspectRatio(width / height);
  }
}
