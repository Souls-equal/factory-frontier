import type { Camera, Scene } from 'three';

/** World-space camera pose produced by the player layer. */
export interface CameraView {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  /** Rotation around the world Y axis, in radians. */
  readonly yaw: number;
  /** Rotation around the camera's local X axis, in radians. */
  readonly pitch: number;
}

/** Read-only rendering statistics exposed to the game and debug UI. */
export interface RendererStats {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
}

/**
 * Minimal rendering backend contract.
 *
 * `Game` talks to a `GameEngine`; `Engine` talks to a `RenderBackend`. Tests can
 * substitute either layer without requiring a real WebGL context.
 */
export interface RenderBackend {
  resize(width: number, height: number, pixelRatio: number): void;
  render(scene: Scene, camera: Camera): void;
  readonly stats: RendererStats;
  dispose(): void;
}

/** Contract consumed by `Game`. Keep rendering details behind this interface. */
export interface GameEngine {
  init(): void | Promise<void>;
  resize(width: number, height: number, pixelRatio: number): void;
  /** Apply the current camera pose before rendering. */
  applyView(view: CameraView): void;
  /** `alpha` is the interpolation factor for future view-state interpolation. */
  render(alpha: number): void;
  dispose(): void;
  readonly stats: RendererStats;
}
