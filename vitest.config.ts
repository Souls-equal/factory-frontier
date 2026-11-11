import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirrors the compile-time constants provided by `vite.config.ts`.
  define: {
    __APP_NAME__: JSON.stringify('Factory Frontier'),
    __APP_VERSION__: JSON.stringify('0.1.0-test'),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
});
