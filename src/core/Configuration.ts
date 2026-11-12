/**
 * Central configuration for Factory Frontier.
 *
 * This module is environment agnostic on purpose: it is imported both by the
 * browser application and by `vite.config.ts` (Node). Keep it free of DOM and
 * Vite-specific imports.
 *
 * Values that gameplay or rendering systems need at runtime live here instead
 * of being hardcoded inside those systems.
 */

/** Base path used when the production build is deployed to GitHub Pages. */
export const DEFAULT_PRODUCTION_BASE_PATH = '/factory-frontier/';

export const DEFAULT_SIMULATION_CONFIG = Object.freeze({
  /** Fixed simulation interval in milliseconds (20 updates per second). */
  fixedTimestepMs: 50,
  /** Maximum number of fixed updates executed for a single rendered frame. */
  maxCatchUpSteps: 10,
  /** A single frame never contributes more than this to the simulation. */
  maxFrameDeltaMs: 250,
});

export const DEFAULT_CONTROLS_CONFIG = Object.freeze({
  /** Camera height above the ground in metres. */
  eyeHeight: 1.7,
  /** Walking speed in metres per second. */
  moveSpeed: 5.5,
  /** Sprint speed multiplier. */
  sprintMultiplier: 1.8,
  /** Horizontal acceleration / braking in metres per second squared. */
  acceleration: 28,
  /** Look sensitivity in radians per mouse pixel. */
  lookSensitivity: 0.0022,
  /** Maximum absolute pitch in radians (± ≈83°). */
  pitchLimit: 1.45,
  /** Fallback safety bound in metres; terrain bounds and collisions own movement. */
  playAreaRadius: 120,
});

/**
 * Deterministic world generation parameters (Phase 1).
 *
 * The same seed and generation parameters always produce the same terrain,
 * obstacle layout and spawn point.
 */
export const DEFAULT_WORLD_CONFIG = Object.freeze({
  /** World seed. */
  seed: 20261111,
  /** Finite square exploration area, in metres. */
  sizeMeters: 240,
  /** Number of terrain cells per side (vertices = resolution + 1). */
  resolution: 120,
  /** Peak-to-trough terrain amplitude in metres. */
  heightScale: 13,
  /** Radius around the spawn point that is flattened for a readable start. */
  spawnFlatRadius: 16,
  /** Height of the boundary ridge that closes the finite area, in metres. */
  rimHeight: 24,
  /** Number of rock/formation obstacles scattered over the terrain. */
  obstacleCount: 46,
});

export const DEFAULT_PLAYER_CONFIG = Object.freeze({
  /** Downward acceleration in metres per second squared. */
  gravity: 24,
  /** Initial upward speed of a jump in metres per second. */
  jumpSpeed: 8.4,
  /** Horizontal collision radius of the player capsule, in metres. */
  radius: 0.4,
  /** Total player height in metres (eye height is configured separately). */
  height: 1.8,
  /** Maximum walkable slope in radians (≈ 42°). */
  maxWalkableSlope: 0.73,
  /** How far the player snaps down to the ground while walking, in metres. */
  groundSnapDistance: 0.45,
  /** Largest height gain a single horizontal move may climb, in metres. */
  maxStepHeight: 0.6,
  /** Speed retained by air control relative to ground acceleration (0–1). */
  airControl: 0.35,
  /** Downhill acceleration applied on terrain steeper than the walkable limit. */
  slideAcceleration: 11,
});

export const DEFAULT_INTERACTION_CONFIG = Object.freeze({
  /** Default camera-ray reach in metres. */
  range: 3.6,
  /** Radius of the interaction volume around an interactable anchor, in metres. */
  targetRadius: 1.1,
});

export const DEFAULT_CONSTRUCTION_CONFIG = Object.freeze({ gridSize: 1, reach: 6 });
export interface ConstructionConfig { readonly gridSize: number; readonly reach: number }

export interface MinerConfig { readonly baseRatePerMinute: number; readonly outputSlots: number }
export const DEFAULT_MINER_CONFIG: MinerConfig = Object.freeze({ baseRatePerMinute: 30, outputSlots: 1 });

export const DEFAULT_RESOURCE_CONFIG = Object.freeze({
  inventorySlots: 24,
  gatherQuantity: 5,
  depositsPerType: 2,
  impureMultiplier: 0.5,
  normalMultiplier: 1,
  pureMultiplier: 2,
});

export interface ResourceConfig {
  readonly inventorySlots: number;
  /** Legacy deposit-gathering setting; retained for configuration compatibility, unused by finite starter objects. */
  readonly gatherQuantity: number;
  readonly depositsPerType: number;
  readonly impureMultiplier: number;
  readonly normalMultiplier: number;
  readonly pureMultiplier: number;
}

export const DEFAULT_RENDER_CONFIG = Object.freeze({
  antialias: true,
  shadows: true,
  /** Device pixel ratio is clamped to this value to protect fill rate. */
  pixelRatioCap: 2,
  fov: 60,
  near: 0.1,
  far: 600,
  /** Scene clear color (deep twilight blue). */
  backgroundColor: 0x0b1522,
  /** Fog colour, matched to the sky horizon band. */
  fogColor: 0x163039,
  /** Distance at which atmospheric fog starts, in metres. */
  fogNear: 55,
  /** Distance at which fog is fully opaque, in metres. */
  fogFar: 265,
  /** Construction grid color (cyan survey lines). */
  gridColor: 0x2f6f7a,
});

export interface SimulationConfig {
  readonly fixedTimestepMs: number;
  readonly maxCatchUpSteps: number;
  readonly maxFrameDeltaMs: number;
}

export interface ControlsConfig {
  readonly eyeHeight: number;
  readonly moveSpeed: number;
  readonly sprintMultiplier: number;
  readonly acceleration: number;
  readonly lookSensitivity: number;
  readonly pitchLimit: number;
  readonly playAreaRadius: number;
}

export interface RenderConfig {
  readonly antialias: boolean;
  readonly shadows: boolean;
  readonly pixelRatioCap: number;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly backgroundColor: number;
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly gridColor: number;
}

export interface WorldConfig {
  readonly seed: number;
  readonly sizeMeters: number;
  readonly resolution: number;
  readonly heightScale: number;
  readonly spawnFlatRadius: number;
  readonly rimHeight: number;
  readonly obstacleCount: number;
}

export interface PlayerConfig {
  readonly gravity: number;
  readonly jumpSpeed: number;
  readonly radius: number;
  readonly height: number;
  readonly maxWalkableSlope: number;
  readonly groundSnapDistance: number;
  readonly maxStepHeight: number;
  readonly airControl: number;
  readonly slideAcceleration: number;
}

export interface InteractionConfig {
  readonly range: number;
  readonly targetRadius: number;
}

export interface GameConfig {
  readonly appName: string;
  readonly version: string;
  readonly basePath: string;
  readonly debug: boolean;
  readonly simulation: SimulationConfig;
  readonly render: RenderConfig;
  readonly controls: ControlsConfig;
  readonly world: WorldConfig;
  readonly player: PlayerConfig;
  readonly interaction: InteractionConfig;
  readonly resources: ResourceConfig;
  readonly construction: ConstructionConfig;
  readonly miner: MinerConfig;
}

export interface GameConfigOverrides {
  readonly appName?: string;
  readonly version?: string;
  readonly basePath?: string;
  readonly debug?: boolean;
  readonly simulation?: Partial<SimulationConfig>;
  readonly render?: Partial<RenderConfig>;
  readonly controls?: Partial<ControlsConfig>;
  readonly world?: Partial<WorldConfig>;
  readonly player?: Partial<PlayerConfig>;
  readonly interaction?: Partial<InteractionConfig>;
  readonly resources?: Partial<ResourceConfig>;
  readonly construction?: Partial<ConstructionConfig>;
  readonly miner?: Partial<MinerConfig>;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export const DEFAULT_GAME_CONFIG: GameConfig = Object.freeze({
  appName: 'Factory Frontier',
  version: '0.3.0',
  basePath: '/',
  debug: false,
  simulation: DEFAULT_SIMULATION_CONFIG,
  render: DEFAULT_RENDER_CONFIG,
  controls: DEFAULT_CONTROLS_CONFIG,
  world: DEFAULT_WORLD_CONFIG,
  player: DEFAULT_PLAYER_CONFIG,
  interaction: DEFAULT_INTERACTION_CONFIG,
  resources: DEFAULT_RESOURCE_CONFIG,
  construction: DEFAULT_CONSTRUCTION_CONFIG,
  miner: DEFAULT_MINER_CONFIG,
});

/**
 * Resolve a deployable base path.
 *
 * - Explicit values are normalized to `/something/`.
 * - Development always runs at `/` unless a base path is explicitly requested.
 * - Production defaults to the GitHub Pages repository path.
 */
export function resolveBasePath(rawBasePath: string | undefined, isProductionBuild: boolean): string {
  const fallback = isProductionBuild ? DEFAULT_PRODUCTION_BASE_PATH : '/';

  if (rawBasePath === undefined || rawBasePath.trim() === '') {
    return fallback;
  }

  let normalized = rawBasePath.trim();
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`;
  }
  return normalized;
}

/** Build a validated, immutable game configuration. */
export function createGameConfig(overrides: GameConfigOverrides = {}): GameConfig {
  const simulation: SimulationConfig = Object.freeze({
    ...DEFAULT_SIMULATION_CONFIG,
    ...overrides.simulation,
  });

  const render: RenderConfig = Object.freeze({
    ...DEFAULT_RENDER_CONFIG,
    ...overrides.render,
  });

  const controls: ControlsConfig = Object.freeze({
    ...DEFAULT_CONTROLS_CONFIG,
    ...overrides.controls,
  });

  const world: WorldConfig = Object.freeze({
    ...DEFAULT_WORLD_CONFIG,
    ...overrides.world,
  });

  const player: PlayerConfig = Object.freeze({
    ...DEFAULT_PLAYER_CONFIG,
    ...overrides.player,
  });

  const interaction: InteractionConfig = Object.freeze({
    ...DEFAULT_INTERACTION_CONFIG,
    ...overrides.interaction,
  });

  const resources: ResourceConfig = Object.freeze({ ...DEFAULT_RESOURCE_CONFIG, ...overrides.resources });

  const config: GameConfig = Object.freeze({
    appName: overrides.appName ?? DEFAULT_GAME_CONFIG.appName,
    version: overrides.version ?? DEFAULT_GAME_CONFIG.version,
    basePath: resolveBasePath(overrides.basePath ?? DEFAULT_GAME_CONFIG.basePath, false),
    debug: overrides.debug ?? DEFAULT_GAME_CONFIG.debug,
    simulation,
    render,
    controls,
    world,
    player,
    interaction,
    resources,
    construction: Object.freeze({ ...DEFAULT_CONSTRUCTION_CONFIG, ...overrides.construction }),
    miner: Object.freeze({ ...DEFAULT_MINER_CONFIG, ...overrides.miner }),
  });

  validateGameConfig(config);
  return config;
}

/** Throw a `ConfigurationError` when a value cannot be used safely. */
export function validateGameConfig(config: GameConfig): void {
  if (config.appName.trim() === '') {
    throw new ConfigurationError('appName must not be empty.');
  }
  if (config.version.trim() === '') {
    throw new ConfigurationError('version must not be empty.');
  }
  if (!config.basePath.startsWith('/') || !config.basePath.endsWith('/')) {
    throw new ConfigurationError(`basePath must start and end with "/" (received "${config.basePath}").`);
  }

  assertNumberInRange(config.simulation.fixedTimestepMs, 'simulation.fixedTimestepMs', 1, 1000);
  assertIntegerInRange(config.simulation.maxCatchUpSteps, 'simulation.maxCatchUpSteps', 1, 120);
  assertNumberInRange(
    config.simulation.maxFrameDeltaMs,
    'simulation.maxFrameDeltaMs',
    config.simulation.fixedTimestepMs,
    5000,
  );

  assertNumberInRange(config.render.pixelRatioCap, 'render.pixelRatioCap', 0.5, 4);
  assertNumberInRange(config.render.fov, 'render.fov', 30, 120);
  assertNumberInRange(config.render.near, 'render.near', 0.01, 100);
  assertNumberInRange(config.render.far, 'render.far', config.render.near + 1, 100_000);
  assertIntegerInRange(config.render.backgroundColor, 'render.backgroundColor', 0, 0xffffff);
  assertIntegerInRange(config.render.gridColor, 'render.gridColor', 0, 0xffffff);
  assertIntegerInRange(config.render.fogColor, 'render.fogColor', 0, 0xffffff);
  assertNumberInRange(config.render.fogNear, 'render.fogNear', 0, 1000);
  assertNumberInRange(config.render.fogFar, 'render.fogFar', config.render.fogNear + 1, 5000);

  assertNumberInRange(config.controls.eyeHeight, 'controls.eyeHeight', 0.5, 5);
  assertNumberInRange(config.controls.moveSpeed, 'controls.moveSpeed', 0.5, 20);
  assertNumberInRange(config.controls.sprintMultiplier, 'controls.sprintMultiplier', 1, 5);
  assertNumberInRange(config.controls.acceleration, 'controls.acceleration', 1, 200);
  assertNumberInRange(config.controls.lookSensitivity, 'controls.lookSensitivity', 0.0001, 0.02);
  assertNumberInRange(config.controls.pitchLimit, 'controls.pitchLimit', 0.1, 1.5);
  assertNumberInRange(config.controls.playAreaRadius, 'controls.playAreaRadius', 5, 150);

  assertIntegerInRange(config.world.seed, 'world.seed', 0, 2 ** 31 - 1);
  assertNumberInRange(config.world.sizeMeters, 'world.sizeMeters', 40, 2000);
  assertIntegerInRange(config.world.resolution, 'world.resolution', 8, 512);
  assertNumberInRange(config.world.heightScale, 'world.heightScale', 0, 200);
  assertNumberInRange(config.world.spawnFlatRadius, 'world.spawnFlatRadius', 2, 120);
  assertNumberInRange(config.world.rimHeight, 'world.rimHeight', 0, 200);
  assertIntegerInRange(config.world.obstacleCount, 'world.obstacleCount', 0, 400);

  assertNumberInRange(config.player.gravity, 'player.gravity', 1, 100);
  assertNumberInRange(config.player.jumpSpeed, 'player.jumpSpeed', 0.5, 40);
  assertNumberInRange(config.player.radius, 'player.radius', 0.1, 2);
  assertNumberInRange(config.player.height, 'player.height', 0.5, 4);
  assertNumberInRange(config.player.maxWalkableSlope, 'player.maxWalkableSlope', 0.05, 1.45);
  assertNumberInRange(config.player.groundSnapDistance, 'player.groundSnapDistance', 0.01, 3);
  assertNumberInRange(config.player.maxStepHeight, 'player.maxStepHeight', 0.05, 3);
  assertNumberInRange(config.player.airControl, 'player.airControl', 0, 1);
  assertNumberInRange(config.player.slideAcceleration, 'player.slideAcceleration', 0, 60);

  assertNumberInRange(config.interaction.range, 'interaction.range', 0.5, 20);
  assertNumberInRange(config.interaction.targetRadius, 'interaction.targetRadius', 0.1, 5);

  assertNumberInRange(config.miner.baseRatePerMinute, 'miner.baseRatePerMinute', 0.01, 10000);
  assertIntegerInRange(config.miner.outputSlots, 'miner.outputSlots', 1, 200);

  assertNumberInRange(config.construction.gridSize, 'construction.gridSize', 0.25, 10);
  assertNumberInRange(config.construction.reach, 'construction.reach', 1, 20);

  assertIntegerInRange(config.resources.inventorySlots, 'resources.inventorySlots', 1, 200);
  assertIntegerInRange(config.resources.gatherQuantity, 'resources.gatherQuantity', 1, 10000);
  assertIntegerInRange(config.resources.depositsPerType, 'resources.depositsPerType', 1, 20);
  assertNumberInRange(config.resources.impureMultiplier, 'resources.impureMultiplier', 0.01, 100);
  assertNumberInRange(config.resources.normalMultiplier, 'resources.normalMultiplier', 0.01, 100);
  assertNumberInRange(config.resources.pureMultiplier, 'resources.pureMultiplier', 0.01, 100);

  if (config.player.height < config.controls.eyeHeight) {
    throw new ConfigurationError(
      `player.height (${config.player.height}) must be at least controls.eyeHeight (${config.controls.eyeHeight}).`,
    );
  }
}

function assertNumberInRange(value: number, field: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ConfigurationError(`${field} must be a number between ${min} and ${max} (received ${value}).`);
  }
}

function assertIntegerInRange(value: number, field: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigurationError(`${field} must be an integer between ${min} and ${max} (received ${value}).`);
  }
}
