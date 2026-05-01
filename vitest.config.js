import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/.DS_Store'],
      reporter: ['text', 'json-summary']
    }
  }
});
