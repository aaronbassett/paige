// LogTape structured logging setup for Paige backend server
// Must be called once at application startup before any logging occurs.

import { configure, getConsoleSink, getLogger } from '@logtape/logtape';
import { prettyFormatter } from '@logtape/pretty';

/**
 * Initialize LogTape with pretty console output.
 * Call this once at the top of the application entry point.
 */
export async function setupLogging(): Promise<void> {
  await configure({
    sinks: {
      console: getConsoleSink({ formatter: prettyFormatter }),
    },
    loggers: [
      {
        category: ['paige'],
        lowestLevel: 'debug',
        sinks: ['console'],
      },
    ],
  });
}

// Re-export getLogger for convenience.
// Usage: const logger = getLogger(['paige', 'module-name']);
export { getLogger };
