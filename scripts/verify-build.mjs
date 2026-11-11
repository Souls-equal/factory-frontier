#!/usr/bin/env node
/**
 * Static verification of the production build.
 *
 * Checks the Phase 0 acceptance criteria that can be validated without a
 * browser: the build exists, assets resolve under the GitHub Pages base path,
 * and no development-only or localhost URLs leak into the artifacts.
 *
 * Run after `npm run build`.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(projectRoot, 'dist');
const indexPath = join(distDir, 'index.html');
const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  if (condition) {
    checks.push(`  PASS  ${name}`);
  } else {
    failures.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function normalizeBase(raw) {
  if (!raw) return '/factory-frontier/';
  let base = raw.trim();
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

const expectedBase = normalizeBase(process.env.VITE_BASE_PATH);

if (!existsSync(indexPath)) {
  console.error('Build output is missing. Run `npm run build` first.');
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');

check('dist/index.html exists', true);
check(
  `entry HTML references assets under the Pages base path "${expectedBase}"`,
  html.includes(`${expectedBase}assets/`),
  'no asset URL matched the configured base path',
);
check('entry HTML no longer references raw /src/main.ts', !/src="\/src\/main\.ts"/.test(html));
check('entry HTML contains the canvas mount point', html.includes('id="game-canvas"'));
check('entry HTML contains the boot overlay', html.includes('data-ui="boot"'));
check('entry HTML contains the crosshair', html.includes('class="crosshair"'));
check(
  'entry HTML contains the controls hint',
  html.includes('data-ui="controls-hint"'),
);
check(
  'entry HTML contains the interaction prompt',
  html.includes('data-ui="interaction-prompt"') && html.includes('data-ui="interaction-name"'),
);
check(
  'entry HTML contains the interaction feedback slot',
  html.includes('data-ui="interaction-feedback"'),
);
check('entry HTML contains inventory controls', html.includes('data-ui="inventory"') && html.includes('data-inventory-grid') && html.includes('data-inventory-split'));
check(
  'favicon is referenced under the base path',
  html.includes(`${expectedBase}favicon.svg`),
  'favicon URL does not use the configured base path',
);
check('favicon exists on disk', existsSync(join(distDir, 'favicon.svg')));

const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
check('entry HTML references a JavaScript and a CSS bundle', assetUrls.some((url) => url.endsWith('.js')) && assetUrls.some((url) => url.endsWith('.css')));

for (const url of assetUrls) {
  check(`asset URL starts with the base path: ${url.slice(0, 42)}`, url.startsWith(expectedBase), url);
  const assetPath = join(distDir, decodeURI(url.slice(expectedBase.length)));
  check(`asset exists on disk: ${url.slice(expectedBase.length)}`, existsSync(assetPath));
  if (existsSync(assetPath)) {
    check(`asset is not empty: ${url.slice(expectedBase.length)}`, statSync(assetPath).size > 0);
  }
}

const jsUrl = assetUrls.find((url) => url.endsWith('.js'));
if (jsUrl) {
  const jsPath = join(distDir, decodeURI(jsUrl.slice(expectedBase.length)));
  const js = readFileSync(jsPath, 'utf8');

  check('JavaScript bundle is a real application bundle (> 100 kB)', js.length > 100_000, `${js.length} bytes`);
  check('JavaScript bundle includes the game bootstrap', js.includes('Factory Frontier'));
  check('JavaScript bundle excludes localhost URLs', !/localhost|127\.0\.0\.1/.test(js));
  check('JavaScript bundle ships a source map reference', /sourceMappingURL=/.test(js));
  check(
    'source map exists next to the bundle',
    existsSync(`${jsPath}.map`),
  );
}

check('no localhost or loopback URL in index.html', !/localhost|127\.0\.0\.1/.test(html));
check('no development module paths in index.html', !/\/@vite\/client|\/src\//.test(html));

if (failures.length > 0) {
  console.error('\nBuild verification FAILED:\n');
  console.error([...checks, ...failures].join('\n'));
  process.exit(1);
}

console.log(`\nBuild verification passed (base path: ${expectedBase}).\n${checks.join('\n')}`);
