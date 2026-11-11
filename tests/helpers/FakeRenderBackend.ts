import type { Camera, Scene } from 'three';

import type { RenderBackend, RendererStats } from '../../src/engine/types';

export interface RenderCall {
  readonly scene: Scene;
  readonly camera: Camera;
}

export class FakeRenderBackend implements RenderBackend {
  disposeCalls = 0;
  readonly renderCalls: RenderCall[] = [];
  readonly resizeCalls: Array<{ width: number; height: number; pixelRatio: number }> = [];
  statsValue: RendererStats = {
    drawCalls: 12,
    triangles: 4321,
    geometries: 6,
    textures: 2,
  };

  resize(width: number, height: number, pixelRatio: number): void {
    this.resizeCalls.push({ width, height, pixelRatio });
  }

  render(scene: Scene, camera: Camera): void {
    this.renderCalls.push({ scene, camera });
  }

  get stats(): RendererStats {
    return this.statsValue;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }
}
