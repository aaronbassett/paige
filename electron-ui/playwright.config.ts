/**
 * Playwright E2E configuration for Paige Electron UI.
 *
 * These tests are designed to run against the packaged Electron app.
 * In headless CI environments without a display server, all test cases
 * are marked with `test.skip()` and serve as structured scaffolding
 * that documents the intended verification scenarios.
 *
 * To run locally with a display:
 *   npx playwright test
 *
 * Electron-specific notes:
 * - Playwright's Electron support uses `electron.launch()` from
 *   `@playwright/test` (or the `electron` fixture from a helper).
 * - Tests interact with `BrowserWindow` pages via `electronApp.firstWindow()`.
 * - The app must be built before E2E tests: `npm run build`
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1, // Electron tests must run serially (single app instance)
  use: {
    trace: 'on-first-retry',
  },
  expect: {
    timeout: 5_000,
  },
});
