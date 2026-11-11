import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';

import { createGameConfig } from '../../src/core/Configuration';
import { CameraManager } from '../../src/engine/CameraManager';

const config = createGameConfig().render;

describe('CameraManager', () => {
  it('creates a perspective camera from configuration', () => {
    const manager = new CameraManager(config);

    expect(manager.camera).toBeInstanceOf(PerspectiveCamera);
    expect(manager.camera.fov).toBe(config.fov);
    expect(manager.camera.near).toBe(config.near);
    expect(manager.camera.far).toBe(config.far);
    expect(manager.camera.aspect).toBe(1);
  });

  it('updates the projection matrix when the aspect ratio changes', () => {
    const manager = new CameraManager(config);
    const before = manager.camera.projectionMatrix.elements.slice();

    manager.setAspectRatio(16 / 9);

    expect(manager.camera.aspect).toBeCloseTo(16 / 9, 8);
    expect(manager.camera.projectionMatrix.elements).not.toEqual(before);
  });

  it('derives the aspect ratio from the viewport size', () => {
    const manager = new CameraManager(config);
    manager.resize(1600, 900);

    expect(manager.camera.aspect).toBeCloseTo(16 / 9, 8);
  });

  it('ignores empty viewports', () => {
    const manager = new CameraManager(config, 1.5);
    manager.resize(0, 0);

    expect(manager.camera.aspect).toBe(1.5);
  });

  it('applies a first-person camera pose with YXZ rotation order', () => {
    const manager = new CameraManager(config);

    manager.applyView({
      position: { x: 2, y: 1.7, z: -4 },
      yaw: 0.5,
      pitch: -0.25,
    });

    expect(manager.camera.position.x).toBe(2);
    expect(manager.camera.position.y).toBe(1.7);
    expect(manager.camera.position.z).toBe(-4);
    expect(manager.camera.rotation.order).toBe('YXZ');
    expect(manager.camera.rotation.y).toBeCloseTo(0.5);
    expect(manager.camera.rotation.x).toBeCloseTo(-0.25);
    expect(manager.camera.rotation.z).toBe(0);
  });

  it('rejects non-finite camera views', () => {
    const manager = new CameraManager(config);

    expect(() =>
      manager.applyView({
        position: { x: Number.NaN, y: 1.7, z: 0 },
        yaw: 0,
        pitch: 0,
      }),
    ).toThrow(RangeError);
  });

  it('rejects invalid aspect ratios', () => {
    const manager = new CameraManager(config);
    expect(() => manager.setAspectRatio(0)).toThrow(RangeError);
    expect(() => manager.setAspectRatio(Number.NaN)).toThrow(RangeError);
  });
});
