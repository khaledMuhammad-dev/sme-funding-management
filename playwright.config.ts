import { defineConfig, devices } from '@playwright/test'

/**
 * Happy-path E2E suite for the client demo.
 *
 * The app is frontend-only, so there is nothing to seed or reset between tests
 * beyond the browser context — every test starts from the fixtures in
 * `src/data/fixtures` with a fresh in-memory store.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /*
    Capped deliberately. Every worker drives the same Vite **dev** server (the
    suite needs `import.meta.env.DEV` hooks, so it cannot run against a preview
    build), and at the default worker count that server becomes the bottleneck:
    unrelated tests then fail a different assertion on each run purely on
    timing. Six workers keeps the whole suite near two minutes and stable.
  */
  workers: process.env.CI ? 2 : 6,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
