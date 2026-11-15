import { Color, Fog, Scene } from 'three';

import type { RenderConfig } from '../core/Configuration';
import type { World } from '../world/World';
import { EnvironmentView } from './EnvironmentView';

/**
 * Scene composition.
 *
 * Phase 1 replaced the flat foundation test plane with the real exploration
 * area. The scene owns exactly two things: environment atmosphere (background,
 * fog) and the `EnvironmentView` that renders world data. Lighting is composed
 * separately by `Engine` so it can follow the player.
 */
export class SceneManager {
  readonly scene: Scene;
  readonly environment: EnvironmentView;

  constructor(config: RenderConfig, world: World) {
    this.scene = new Scene();
    this.scene.background = new Color(config.backgroundColor);
    // Fog depth hides the finite world edge and gives the horizon atmosphere.
    this.scene.fog = new Fog(config.fogColor, config.fogNear, config.fogFar);

    // Before the first camera update, cover a square-aspect far-plane diagonal.
    const tangent = Math.tan(config.fov * Math.PI / 360);
    this.environment = new EnvironmentView(world, config.fogFar * Math.sqrt(1 + 2 * tangent * tangent));
    this.scene.add(this.environment.group);
  }

  /** Interactable highlight driven by the interaction target. */
  setHighlight(id: string | null): void {
    this.environment.setHighlight(id);
  }

  dispose(): void {
    this.environment.dispose();
    this.scene.clear();
  }
}
