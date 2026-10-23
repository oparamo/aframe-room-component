import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/.DS_Store'],
      reporter: ['text', 'json-summary'],
      // Floors, not targets: CI fails on a real drop without demanding tests for unreachable guards.
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 }
    }
  }
});
