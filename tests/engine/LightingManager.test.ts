import { describe, expect, it, vi } from 'vitest';
import { AmbientLight, DirectionalLight, HemisphereLight } from 'three';

import { LightingManager } from '../../src/engine/LightingManager';

describe('LightingManager', () => {
  it('provides hemisphere, ambient and key lighting', () => {
    const manager = new LightingManager({ shadows: true });

    const hemisphere = manager.group.getObjectByName('lighting:hemisphere');
    const ambient = manager.group.getObjectByName('lighting:ambient');
    const key = manager.group.getObjectByName('lighting:key');

    expect(hemisphere).toBeInstanceOf(HemisphereLight);
    expect(ambient).toBeInstanceOf(AmbientLight);
    expect(key).toBeInstanceOf(DirectionalLight);
  });

  it('enables shadow casting when configured', () => {
    const manager = new LightingManager({ shadows: true });
    const key = manager.group.getObjectByName('lighting:key') as DirectionalLight;

    expect(key.castShadow).toBe(true);
    expect(key.shadow.mapSize.x).toBe(2048);
    expect(key.shadow.mapSize.y).toBe(2048);
    expect(key.shadow.camera.left).toBe(-60);
    expect(key.shadow.camera.right).toBe(60);
  });

  it('disables shadow casting when configured', () => {
    const manager = new LightingManager({ shadows: false });
    const key = manager.group.getObjectByName('lighting:key') as DirectionalLight;

    expect(key.castShadow).toBe(false);
  });

  it('registers the key light target in the group', () => {
    const manager = new LightingManager({ shadows: true });
    const key = manager.group.getObjectByName('lighting:key') as DirectionalLight;

    expect(manager.group.children).toContain(key.target);
  });

  it('cleans up its shadow resources on dispose', () => {
    const manager = new LightingManager({ shadows: true });
    const key = manager.group.getObjectByName('lighting:key') as DirectionalLight;
    const disposeSpy = vi.spyOn(key.shadow, 'dispose');

    manager.dispose();

    expect(disposeSpy).toHaveBeenCalledOnce();
    expect(manager.group.children).toHaveLength(0);
  });
});

it('uses a brighter daylight fill while retaining a warm shadow-casting key', () => {
  const manager = new LightingManager({ shadows: true });
  const sky = manager.group.getObjectByName('lighting:hemisphere') as HemisphereLight;
  const ambient = manager.group.getObjectByName('lighting:ambient') as AmbientLight;
  const sun = manager.group.getObjectByName('lighting:key') as DirectionalLight;
  expect(sky.intensity).toBeGreaterThan(1); expect(ambient.intensity).toBeGreaterThan(.35);
  expect(sun.intensity).toBeGreaterThan(1); expect(sun.castShadow).toBe(true);
  manager.dispose();
});
