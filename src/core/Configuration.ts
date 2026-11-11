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
  /** Foundation-only safety bound in metres (terrain collision replaces it in Phase 1). */
  playAreaRadius: 120,
});

export const DEFAULT_RENDER_CONFIG = Object.freeze({
  antialias: true,
  shadows: true,
  /** Device pixel ratio is clamped to this value to protect fill rate. */
  pixelRatioCap: 2,
  fov: 60,
  near: 0.1,
  far: 600,
  /** Scene background / fog color (deep twilight blue). */
  backgroundColor: 0x0b1522,
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
  readonly gridColor: number;
}

export interface GameConfig {
  readonly appName: string;
  readonly version: string;
  readonly basePath: string;
  readonly debug: boolean;
  readonly simulation: SimulationConfig;
  readonly render: RenderConfig;
  readonly controls: ControlsConfig;
}

export interface GameConfigOverrides {
  readonly appName?: string;
  readonly version?: string;
  readonly basePath?: string;
  readonly debug?: boolean;
  readonly simulation?: Partial<SimulationConfig>;
  readonly render?: Partial<RenderConfig>;
  readonly controls?: Partial<ControlsConfig>;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export const DEFAULT_GAME_CONFIG: GameConfig = Object.freeze({
  appName: 'Factory Frontier',
  version: '0.2.0',
  basePath: '/',
  debug: false,
  simulation: DEFAULT_SIMULATION_CONFIG,
  render: DEFAULT_RENDER_CONFIG,
  controls: DEFAULT_CONTROLS_CONFIG,
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

  const config: GameConfig = Object.freeze({
    appName: overrides.appName ?? DEFAULT_GAME_CONFIG.appName,
    version: overrides.version ?? DEFAULT_GAME_CONFIG.version,
    basePath: resolveBasePath(overrides.basePath ?? DEFAULT_GAME_CONFIG.basePath, false),
    debug: overrides.debug ?? DEFAULT_GAME_CONFIG.debug,
    simulation,
    render,
    controls,
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

  assertNumberInRange(config.controls.eyeHeight, 'controls.eyeHeight', 0.5, 5);
  assertNumberInRange(config.controls.moveSpeed, 'controls.moveSpeed', 0.5, 20);
  assertNumberInRange(config.controls.sprintMultiplier, 'controls.sprintMultiplier', 1, 5);
  assertNumberInRange(config.controls.acceleration, 'controls.acceleration', 1, 200);
  assertNumberInRange(config.controls.lookSensitivity, 'controls.lookSensitivity', 0.0001, 0.02);
  assertNumberInRange(config.controls.pitchLimit, 'controls.pitchLimit', 0.1, 1.5);
  assertNumberInRange(config.controls.playAreaRadius, 'controls.playAreaRadius', 5, 150);
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
