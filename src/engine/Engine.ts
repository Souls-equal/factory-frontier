import type { GroundItem } from '../logistics/GroundItems';
import { ConveyorItemsView } from './ConveyorItemsView';
import type { ConveyorSegment, ConveyorState } from '../logistics/ConveyorNetwork';
import { BuildingView } from './BuildingView';
import type { BuildingRegistry } from '../buildings/BuildingRegistry';
import type { BuildingInstance, PlacementResult } from '../buildings/BuildingSystem';
import type { MachineState } from '../machines/Miner';
import type { GameConfig } from '../core/Configuration';
import { CameraManager } from './CameraManager';
import { LightingManager } from './LightingManager';
import { Renderer } from './Renderer';
import { SceneManager } from './SceneManager';
import type { World } from '../world/World';
import type { CameraView, GameEngine, RenderBackend, RendererStats } from './types';

export interface EngineOptions {
  readonly config: GameConfig;
  readonly renderer: RenderBackend;
  /** Gameplay world data; the scene is built from it (never the reverse). */
  readonly world: World;
}

/**
 * Composes the rendering subsystems and exposes them to the game through the
 * `GameEngine` contract. Gameplay code never imports Three.js directly.
 */
export class Engine implements GameEngine {
  private readonly config: GameConfig;
  private readonly renderer: RenderBackend;
  private readonly sceneManager: SceneManager;
  private readonly cameraManager: CameraManager;
  private readonly lightingManager: LightingManager;

  private buildingView: BuildingView | undefined;
  private conveyorItems: ConveyorItemsView | undefined;
  private initialized = false;
  private disposed = false;

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.renderer = options.renderer;
    this.sceneManager = new SceneManager(options.config.render, options.world);
    this.cameraManager = new CameraManager(options.config.render);
    this.lightingManager = new LightingManager({ shadows: options.config.render.shadows });
  }

  /** Production factory: creates the real WebGL renderer for a canvas. */
  static create(canvas: HTMLCanvasElement, config: GameConfig, world: World): Engine {
    const renderer = new Renderer(canvas, config.render);
    return new Engine({ config, renderer, world });
  }

  init(): void {
    if (this.disposed) {
      throw new Error('Cannot initialize a disposed engine.');
    }
    if (this.initialized) {
      throw new Error('Engine is already initialized.');
    }

    this.sceneManager.scene.add(this.lightingManager.group);
    this.initialized = true;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (this.disposed) {
      return;
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    this.renderer.resize(width, height, pixelRatio);
    this.cameraManager.resize(width, height);
  }

  applyView(view: CameraView): void {
    if (this.disposed) {
      return;
    }
    this.cameraManager.applyView(view);
    // Shadows follow the player so the fixed-size shadow map stays useful.
    this.lightingManager.setFocus(view.position.x, view.position.z);
  }

  initBuildings(registry: BuildingRegistry, cellSize: number): void {
    if (this.buildingView) throw new Error('Building renderer is already initialized.');
    this.buildingView = new BuildingView(registry, cellSize);
    this.sceneManager.scene.add(this.buildingView.group);
    this.conveyorItems = new ConveyorItemsView((mesh) => this.sceneManager.scene.add(mesh), (mesh) => this.sceneManager.scene.remove(mesh));
  }

  syncBuildings(buildings: readonly BuildingInstance[]): void { this.buildingView?.sync(buildings); }
  setBuildingPreview(typeId: string | null, result?: PlacementResult): void { this.buildingView?.setPreview(typeId, result); }
  setMachineStates(states: readonly { readonly id: string; readonly state: MachineState }[]): void { this.buildingView?.setMachineStates(states); }

  syncConveyors(segments: readonly ConveyorSegment[], alpha: number, ground: readonly GroundItem[] = []): void {
    this.buildingView?.setConveyorStates(segments.map((segment) => ({ id: segment.id, state: segment.state as ConveyorState })));
    this.conveyorItems?.sync(segments, alpha, ground);
  }

  setHighlight(id: string | null): void {
    if (this.disposed) {
      return;
    }
    this.sceneManager.setHighlight(id);
  }

  render(_alpha: number): void {
    if (!this.initialized || this.disposed) {
      return;
    }
    this.sceneManager.environment.syncGatherables();
    this.renderer.render(this.sceneManager.scene, this.cameraManager.camera);
  }

  get stats(): RendererStats {
    if (this.disposed) {
      return { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
    }
    return this.renderer.stats;
  }

  get scene() {
    return this.sceneManager.scene;
  }

  get camera() {
    return this.cameraManager.camera;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.initialized = false;

    this.conveyorItems?.dispose();
    this.buildingView?.dispose();
    this.lightingManager.dispose();
    this.sceneManager.dispose();
    this.renderer.dispose();
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get renderConfig(): GameConfig['render'] {
    return this.config.render;
  }
}
