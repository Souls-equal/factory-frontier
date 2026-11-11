#!/usr/bin/env node
/**
 * Serve the production build through Vite's preview server and verify that it
 * behaves like a GitHub Pages deployment: the entry document and every asset it
 * references must be reachable under the configured base path.
 *
 * This validates the real HTTP serving path (not just files on disk). WebGL
 * rendering itself requires a browser and is validated separately.
 */

import { preview } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expectedBase = (() => {
  const raw = process.env.VITE_BASE_PATH?.trim();
  if (!raw) return '/factory-frontier/';
  let base = raw;
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
})();

const previewServer = await preview({
  configFile: join(projectRoot, 'vite.config.ts'),
  preview: { host: '127.0.0.1', port: 0, strictPort: false },
});

const address = previewServer.httpServer.address();
if (address === null || typeof address === 'string') {
  await previewServer.close();
  console.error('Preview server did not expose a TCP port.');
  process.exit(1);
}
const origin = `http://127.0.0.1:${address.port}`;

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  if (condition) checks.push(`  PASS  ${name}`);
  else failures.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

try {
  const pageUrl = `${origin}${expectedBase}`;
  const pageResponse = await fetch(pageUrl);
  const html = await pageResponse.text();

  check(`entry page responds at ${expectedBase}`, pageResponse.status === 200, `HTTP ${pageResponse.status}`);
  check('entry page is HTML', (pageResponse.headers.get('content-type') ?? '').includes('text/html'));
  check('entry page includes the game canvas', html.includes('id="game-canvas"'));
  check('entry page includes the boot overlay', html.includes('data-ui="boot"'));
  check('entry page includes the controls hint', html.includes('data-ui="controls-hint"'));

  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
  check('entry page references at least one JS and one CSS asset', assetUrls.length >= 2);

  for (const assetUrl of assetUrls) {
    const response = await fetch(`${origin}${assetUrl}`);
    check(`asset responds 200: ${assetUrl.slice(expectedBase.length)}`, response.status === 200, `HTTP ${response.status}`);
    if (assetUrl.endsWith('.js')) {
      const body = await response.text();
      check('JavaScript bundle is served and non-trivial', body.length > 100_000, `${body.length} bytes`);
    } else {
      await response.text();
    }
  }

  const faviconResponse = await fetch(`${origin}${expectedBase}favicon.svg`);
  check('favicon responds 200', faviconResponse.status === 200, `HTTP ${faviconResponse.status}`);
  await faviconResponse.text();

  const distIndex = readFileSync(resolve(projectRoot, 'dist/index.html'), 'utf8');
  check('served HTML matches the built index.html', html === distIndex);
} finally {
  await previewServer.close();
}

if (failures.length > 0) {
  console.error('\nPreview verification FAILED:\n');
  console.error([...checks, ...failures].join('\n'));
  process.exit(1);
}

console.log(`\nPreview verification passed (${origin}${expectedBase}).\n${checks.join('\n')}`);
