import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Scene,
} from 'three';

import type { RenderConfig } from '../core/Configuration';
import type { RenderBackend, RendererStats } from './types';

export class RendererCreationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RendererCreationError';
  }
}

/**
 * Thin wrapper around Three.js' `WebGLRenderer`.
 *
 * Owns GPU-facing concerns only: context flags, color management, shadow
 * configuration, sizing and statistics. Scene content lives in `SceneManager`.
 */
export class Renderer implements RenderBackend {
  private readonly renderer: WebGLRenderer;
  private readonly pixelRatioCap: number;

  constructor(canvas: HTMLCanvasElement, config: RenderConfig) {
    this.pixelRatioCap = config.pixelRatioCap;

    try {
      this.renderer = new WebGLRenderer({
        canvas,
        antialias: config.antialias,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      throw new RendererCreationError(
        'Unable to create a WebGL2 rendering context. Factory Frontier requires a browser with WebGL2 enabled.',
        { cause: error },
      );
    }

    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = config.shadows;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(config.backgroundColor, 1);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError(`Renderer size must be positive (received ${width}x${height}).`);
    }
    if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) {
      throw new RangeError(`pixelRatio must be positive (received ${pixelRatio}).`);
    }

    this.renderer.setPixelRatio(Math.min(pixelRatio, this.pixelRatioCap));
    // CSS owns the canvas layout; only the drawing buffer is resized here.
    this.renderer.setSize(width, height, false);
  }

  render(scene: Scene, camera: Camera): void {
    this.renderer.render(scene, camera);
  }

  get stats(): RendererStats {
    const { render, memory } = this.renderer.info;
    return {
      drawCalls: render.calls,
      triangles: render.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
    };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
