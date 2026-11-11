import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';

import { resolveBasePath } from './src/core/Configuration.ts';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string; name: string };

/**
 * Vite configuration.
 *
 * GitHub Pages serves the game from `https://<user>.github.io/<repo>/`, so the
 * production build needs a matching base path. Development must stay at `/` so
 * that the local dev server and the Arena live preview work.
 *
 * Override the production base path with `VITE_BASE_PATH` (for example when a
 * custom domain serves the game from the root).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isProductionBuild = mode === 'production';
  const rawBasePath = env.VITE_BASE_PATH;
  const base = resolveBasePath(rawBasePath === '' ? undefined : rawBasePath, isProductionBuild);

  return {
    base,
    define: {
      __APP_NAME__: JSON.stringify('Factory Frontier'),
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      // The Arena preview is served from a proxied host name.
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: false,
      allowedHosts: true,
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      reportCompressedSize: false,
      // Three.js is the renderer and intentionally ships as one dependency
      // chunk in Phase 0; code splitting is a later optimization.
      chunkSizeWarningLimit: 800,
    },
  };
});
