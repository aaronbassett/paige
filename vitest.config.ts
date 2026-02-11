import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the Paige backend server.
 *
 * Three test projects separated by purpose:
 *   - unit:        Fast, isolated, mocked dependencies (tests/unit/)
 *   - integration: Multi-module with real SQLite, file system, WebSocket (tests/integration/)
 *   - contract:    MCP/WebSocket protocol conformance (tests/contract/)
 *
 * Run all:          pnpm test
 * Run by project:   pnpm test:unit | pnpm test:integration | pnpm test:contract
 */
export default defineConfig({
  test: {
    /* Explicit imports preferred — use `import { describe, it, expect } from 'vitest'` */
    globals: false,

    /* Use forks pool for full isolation between test files (separate processes) */
    pool: 'forks',

    /* Fail fast: disallow .only in CI */
    allowOnly: false,

    /* Reporter */
    reporters: ['default'],

    /* Coverage — run via `pnpm test:coverage` */
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/**/types/**',
        'src/index.ts',
      ],
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
    },

    /* Project definitions (replaces vitest.workspace.ts in Vitest 4.x) */
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],

          /* Unit tests must be fast — 5s default timeout per test */
          testTimeout: 5_000,

          /* Unit tests are isolated and can run concurrently */
          fileParallelism: true,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],

          /* Integration tests touch SQLite, file system, and WebSocket — allow more time */
          testTimeout: 10_000,

          /* Hook timeout for setup/teardown of real resources (DB connections, temp dirs) */
          hookTimeout: 10_000,

          /* Run integration test files sequentially to avoid SQLite contention */
          fileParallelism: false,

          /* Retry flaky I/O tests once before failing */
          retry: 1,
        },
      },
      {
        test: {
          name: 'contract',
          include: ['tests/contract/**/*.test.ts'],

          /* Contract tests validate MCP/WebSocket protocol conformance */
          testTimeout: 5_000,

          /* Contract tests are independent — run concurrently */
          fileParallelism: true,
        },
      },
    ],
  },
});
