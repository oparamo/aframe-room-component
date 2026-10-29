import { defineConfig } from '@playwright/test';

const PORT = '8001';

export default defineConfig({
  testDir: 'tests/browser',
  // Flaky tests should fail loudly, not pass on a second try.
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // SwiftShader gives headless Chromium a software WebGL context.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    // The tests read scene state, not pixels. Software rendering is fill-bound, and a small canvas keeps
    // frames fast enough that waiting on them stays well inside the timeout.
    viewport: { width: 320, height: 240 },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `vite --port ${PORT} --strictPort --no-open`,
    url: `http://localhost:${PORT}/example/index.html`,
    reuseExistingServer: !process.env.CI
  }
});
