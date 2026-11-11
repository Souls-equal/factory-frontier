import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  DEFAULT_PRODUCTION_BASE_PATH,
  createGameConfig,
  resolveBasePath,
  validateGameConfig,
  type GameConfig,
} from '../../src/core/Configuration';

describe('resolveBasePath', () => {
  it('uses the GitHub Pages path for production by default', () => {
    expect(resolveBasePath(undefined, true)).toBe(DEFAULT_PRODUCTION_BASE_PATH);
    expect(DEFAULT_PRODUCTION_BASE_PATH).toBe('/factory-frontier/');
  });

  it('uses the domain root for development by default', () => {
    expect(resolveBasePath(undefined, false)).toBe('/');
  });

  it('normalizes explicit base paths', () => {
    expect(resolveBasePath('factory-frontier', true)).toBe('/factory-frontier/');
    expect(resolveBasePath('/factory-frontier', true)).toBe('/factory-frontier/');
    expect(resolveBasePath('/factory-frontier/', true)).toBe('/factory-frontier/');
    expect(resolveBasePath('  /custom/  ', false)).toBe('/custom/');
    expect(resolveBasePath('/', true)).toBe('/');
  });

  it('falls back when given an empty string', () => {
    expect(resolveBasePath('', true)).toBe(DEFAULT_PRODUCTION_BASE_PATH);
    expect(resolveBasePath('', false)).toBe('/');
  });
});

describe('createGameConfig', () => {
  it('provides Phase 0 defaults', () => {
    const config = createGameConfig();

    expect(config.simulation.fixedTimestepMs).toBe(50);
    expect(config.simulation.maxCatchUpSteps).toBe(10);
    expect(config.simulation.maxFrameDeltaMs).toBe(250);
    expect(config.render.pixelRatioCap).toBe(2);
    expect(config.render.far).toBeGreaterThan(config.render.near);
    expect(config.controls.eyeHeight).toBe(1.7);
    expect(config.controls.moveSpeed).toBe(5.5);
    expect(config.controls.pitchLimit).toBeGreaterThan(0);
    expect(config.basePath).toBe('/');
    expect(config.debug).toBe(false);
    expect(config.version).toBe('0.2.0');
  });

  it('supports control overrides', () => {
    const config = createGameConfig({
      controls: { moveSpeed: 8, lookSensitivity: 0.001, playAreaRadius: 50 },
    });

    expect(config.controls.moveSpeed).toBe(8);
    expect(config.controls.lookSensitivity).toBe(0.001);
    expect(config.controls.playAreaRadius).toBe(50);
    expect(config.controls.eyeHeight).toBe(1.7);
  });

  it('merges section overrides without dropping other values', () => {
    const config = createGameConfig({
      version: '9.9.9',
      debug: true,
      basePath: '/factory-frontier/',
      simulation: { fixedTimestepMs: 25 },
      render: { fov: 75 },
    });

    expect(config.version).toBe('9.9.9');
    expect(config.debug).toBe(true);
    expect(config.basePath).toBe('/factory-frontier/');
    expect(config.simulation.fixedTimestepMs).toBe(25);
    expect(config.simulation.maxCatchUpSteps).toBe(10);
    expect(config.render.fov).toBe(75);
    expect(config.render.shadows).toBe(true);
  });

  it('returns an immutable configuration', () => {
    const config = createGameConfig({ basePath: '/factory-frontier/' });

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.simulation)).toBe(true);
    expect(Object.isFrozen(config.render)).toBe(true);
    expect(Object.isFrozen(config.controls)).toBe(true);
  });

  it('rejects invalid simulation values', () => {
    expect(() => createGameConfig({ simulation: { fixedTimestepMs: 0 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ simulation: { fixedTimestepMs: 5000 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ simulation: { maxCatchUpSteps: 1.5 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ simulation: { maxFrameDeltaMs: 10 } })).toThrow(ConfigurationError);
  });

  it('rejects invalid control values', () => {
    expect(() => createGameConfig({ controls: { eyeHeight: 0 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ controls: { moveSpeed: 100 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ controls: { sprintMultiplier: 0.5 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ controls: { acceleration: 0 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ controls: { lookSensitivity: 0 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ controls: { pitchLimit: 2 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ controls: { playAreaRadius: 0 } })).toThrow(ConfigurationError);
  });

  it('rejects invalid render values', () => {
    expect(() => createGameConfig({ render: { pixelRatioCap: 8 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ render: { fov: 200 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ render: { near: 0 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ render: { far: 0.05 } })).toThrow(ConfigurationError);
    expect(() => createGameConfig({ render: { backgroundColor: -1 } })).toThrow(ConfigurationError);
  });
});

describe('validateGameConfig', () => {
  it('reports the offending field', () => {
    const config = createGameConfig();

    expect(() => validateGameConfig({ ...config, appName: '   ' })).toThrow(/appName/);
    expect(() => validateGameConfig({ ...config, version: '' })).toThrow(/version/);
    expect(() => validateGameConfig({ ...config, basePath: '/missing-slash' })).toThrow(/basePath/);
  });

  it('accepts a fully valid configuration', () => {
    expect(() => validateGameConfig(createGameConfig())).not.toThrow();
  });

  it('does not accept a configuration with non-finite numbers', () => {
    const config = createGameConfig();
    const invalid: GameConfig = {
      ...config,
      simulation: { ...config.simulation, fixedTimestepMs: Number.NaN },
    };
    expect(() => validateGameConfig(invalid)).toThrow(ConfigurationError);
  });
});
