import type { GameEngine, RendererStats } from '../../src/engine/types';

export interface ResizeCall {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

/** Engine double used to test `Game` without a WebGL context. */
export class FakeEngine implements GameEngine {
  initCalls = 0;
  disposeCalls = 0;
  initError: unknown = null;
  readonly renderCalls: number[] = [];
  readonly resizeCalls: ResizeCall[] = [];
  readonly statsValue: RendererStats = {
    drawCalls: 7,
    triangles: 1200,
    geometries: 4,
    textures: 0,
  };

  async init(): Promise<void> {
    this.initCalls += 1;
    if (this.initError !== null) {
      throw this.initError;
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.resizeCalls.push({ width, height, pixelRatio });
  }

  render(alpha: number): void {
    this.renderCalls.push(alpha);
  }

  dispose(): void {
    this.disposeCalls += 1;
  }

  get stats(): RendererStats {
    return this.statsValue;
  }
}
