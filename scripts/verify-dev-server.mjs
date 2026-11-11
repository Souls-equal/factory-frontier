#!/usr/bin/env node
/**
 * Boot the real Vite development server and verify that the entry document and
 * the TypeScript module graph are served and transformed without errors.
 *
 * This catches broken imports, invalid HTML entry points and dev-server
 * misconfiguration without needing a full browser.
 */

import { createServer } from 'vite';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  if (condition) checks.push(`  PASS  ${name}`);
  else failures.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

const server = await createServer({
  configFile: join(projectRoot, 'vite.config.ts'),
  mode: 'development',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  logLevel: 'error',
});

try {
  await server.listen();
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === 'string') {
    throw new Error('Vite dev server did not expose a TCP port.');
  }
  const origin = `http://127.0.0.1:${address.port}`;

  const pageResponse = await fetch(`${origin}/`);
  const html = await pageResponse.text();
  check('dev entry page responds at /', pageResponse.status === 200, `HTTP ${pageResponse.status}`);
  check('dev entry page references /src/main.ts', html.includes('src="/src/main.ts"'));
  check('dev entry page includes the game canvas', html.includes('id="game-canvas"'));

  const modulesToVerify = [
    '/src/main.ts',
    '/src/core/Game.ts',
    '/src/core/GameClock.ts',
    '/src/engine/Engine.ts',
    '/src/input/InputManager.ts',
    '/src/player/PlayerController.ts',
    '/src/world/World.ts',
    '/src/world/terrain/TerrainHeightfield.ts',
    '/src/world/ObstacleField.ts',
    '/src/interaction/InteractionSystem.ts',
    '/src/engine/EnvironmentView.ts',
    '/src/ui/InteractionPrompt.ts',
    '/src/ui/ControlsHint.ts',
    '/src/ui/StatusOverlay.ts',
  ];

  for (const modulePath of modulesToVerify) {
    const response = await fetch(`${origin}${modulePath}`);
    const body = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    check(
      `module served: ${modulePath}`,
      response.status === 200 && contentType.includes('javascript'),
      `HTTP ${response.status} (${contentType})`,
    );
    check(
      `module transformed (no unresolved type syntax): ${modulePath}`,
      body.length > 0 && !body.includes('interface ') && !body.includes(': void'),
    );
  }

  const mainModule = await fetch(`${origin}/src/main.ts`).then((response) => response.text());
  check('main module keeps the bootstrap logic', mainModule.includes('StatusOverlay'));
  check(
    'main module wires the Phase 1 systems',
    mainModule.includes('createWorld') &&
      mainModule.includes('InteractionSystem') &&
      mainModule.includes('viewAt'),
  );

  // Three.js must be pre-bundled by the dev server, proving the renderer
  // dependency resolves through Vite rather than a raw node_modules path.
  const rendererModule = await fetch(`${origin}/src/engine/Renderer.ts`).then((response) => response.text());
  check(
    'renderer module resolves the Three.js dependency graph',
    rendererModule.includes('/node_modules/.vite/deps/three.js'),
  );

  const cssResponse = await fetch(`${origin}/src/styles/main.css`);
  const css = await cssResponse.text();
  check('stylesheet is served', cssResponse.status === 200 && css.includes('.boot__panel'));
  check('stylesheet styles the interaction prompt', css.includes('.interaction-prompt'));

  const terrainModule = await fetch(`${origin}/src/world/terrain/TerrainHeightfield.ts`).then((response) =>
    response.text(),
  );
  check(
    'terrain module keeps the heightfield and slope limiter',
    terrainModule.includes('heightAt') && terrainModule.includes('limitSlopes'),
  );
} finally {
  await server.close();
}

if (failures.length > 0) {
  console.error('\nDev-server verification FAILED:\n');
  console.error([...checks, ...failures].join('\n'));
  process.exit(1);
}

console.log(`\nDev-server verification passed.\n${checks.join('\n')}`);
