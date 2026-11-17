import { describe, expect, it } from 'vitest';
import { createGameConfig, DEFAULT_RENDER_CONFIG } from '../../src/core/Configuration';
import { viewDistanceOverride } from '../../src/core/ViewDistance';

describe('camera view distance URL setting', () => {
  it('uses a bounded distance while preserving valid fog and default camera projection', () => {
    for (const value of [16, 24, 55, 265, 500]) {
      const render = viewDistanceOverride(new URLSearchParams(`viewDistance=${value}`));
      const config = createGameConfig({ render });
      expect(config.render.fogFar).toBe(value);
      expect(config.render.fogNear).toBeLessThan(value - 1);
      expect(config.render.far).toBe(DEFAULT_RENDER_CONFIG.far);
      expect(config.render.fov).toBe(DEFAULT_RENDER_CONFIG.fov);
    }
    expect(createGameConfig({ render: viewDistanceOverride(new URLSearchParams('viewDistance=265')) }).render)
      .toEqual(DEFAULT_RENDER_CONFIG);
  });
  it('ignores malformed, duplicated and out-of-range values without breaking startup', () => {
    for (const text of ['', 'viewDistance=', 'viewDistance=0', 'viewDistance=15.9', 'viewDistance=501',
      'viewDistance=Infinity', 'viewDistance=NaN', 'viewDistance=24x', 'viewDistance=0x20', 'viewDistance=-32',
      'viewDistance=16&viewDistance=20']) {
      expect(viewDistanceOverride(new URLSearchParams(text))).toBeUndefined();
      expect(createGameConfig({ render: viewDistanceOverride(new URLSearchParams(text)) }).render).toEqual(DEFAULT_RENDER_CONFIG);
    }
  });
});
