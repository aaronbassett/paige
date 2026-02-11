import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface EnvConfig {
  port: number;
  projectDir: string;
  dataDir: string;
  anthropicApiKey: string | undefined;
}

/**
 * Validates environment variables and returns a typed config.
 * Fails fast with clear error messages for missing/invalid values.
 */
export function loadEnv(): EnvConfig {
  const errors: string[] = [];

  // PORT: optional, default 3001, must be a valid port number
  const rawPort = process.env['PORT'];
  let port = 3001;
  if (rawPort !== undefined) {
    const parsed = Number(rawPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      errors.push(`PORT must be an integer between 1 and 65535, got "${rawPort}"`);
    } else {
      port = parsed;
    }
  }

  // PROJECT_DIR: required, must exist and be a directory
  const rawProjectDir = process.env['PROJECT_DIR'];
  let projectDir = '';
  if (rawProjectDir === undefined || rawProjectDir === '') {
    errors.push('PROJECT_DIR is required. Set it to the absolute path of the project to coach on.');
  } else {
    projectDir = resolve(expandHome(rawProjectDir));
    if (!existsSync(projectDir)) {
      errors.push(`PROJECT_DIR does not exist: ${projectDir}`);
    } else if (!statSync(projectDir).isDirectory()) {
      errors.push(`PROJECT_DIR is not a directory: ${projectDir}`);
    }
  }

  // DATA_DIR: optional, default ~/.paige
  const rawDataDir = process.env['DATA_DIR'];
  const dataDir =
    rawDataDir !== undefined && rawDataDir !== ''
      ? resolve(expandHome(rawDataDir))
      : resolve(homedir(), '.paige');

  // ANTHROPIC_API_KEY: optional
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];

  if (errors.length > 0) {
    const message = [
      'Environment validation failed:',
      ...errors.map((e) => `  - ${e}`),
      '',
      'Check your .env file or environment variables.',
    ].join('\n');
    throw new Error(message);
  }

  return {
    port,
    projectDir,
    dataDir,
    anthropicApiKey,
  };
}

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return filepath.replace('~', homedir());
  }
  return filepath;
}
