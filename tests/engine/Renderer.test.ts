// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PCFShadowMap } from 'three';
import { createGameConfig } from '../../src/core/Configuration';

const state = vi.hoisted(() => ({ renderer: { shadowMap: { enabled: false, type: -1 }, setClearColor: vi.fn() } }));
vi.mock('three', async (load) => {
  const actual = await load<typeof import('three')>();
  return { ...actual, WebGLRenderer: class { constructor() { return state.renderer; } } };
});
import { Renderer } from '../../src/engine/Renderer';

describe('Renderer shadow configuration', () => {
  it('uses the supported PCF mode that replaces the removed soft mode', () => {
    const config = createGameConfig().render;
    new Renderer(document.createElement('canvas'), config);
    expect(state.renderer.shadowMap.enabled).toBe(config.shadows);
    expect(state.renderer.shadowMap.type).toBe(PCFShadowMap);
  });
});
