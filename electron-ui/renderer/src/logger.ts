// LogTape structured logging setup for Paige Electron renderer process
// Must be called once at application startup before any logging occurs.

import { configure, getConsoleSink, getLogger } from '@logtape/logtape';
import { prettyFormatter } from '@logtape/pretty';

/**
 * Initialize LogTape with pretty console output for the Electron renderer.
 * Call this once before rendering the React tree.
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

export { getLogger };
