import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../../../src/config/env.js';

describe('loadEnv', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let tempDir: string;

  beforeEach(() => {
    savedEnv = { ...process.env };
    tempDir = mkdtempSync(join(tmpdir(), 'paige-test-'));
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  function setMinimalEnv(): void {
    process.env['PROJECT_DIR'] = tempDir;
  }

  it('returns defaults when only PROJECT_DIR is set', () => {
    setMinimalEnv();

    const config = loadEnv();

    expect(config.port).toBe(3001);
    expect(config.projectDir).toBe(tempDir);
    expect(config.dataDir).toContain('.paige');
    expect(config.anthropicApiKey).toBeUndefined();
  });

  it('uses custom PORT when provided', () => {
    setMinimalEnv();
    process.env['PORT'] = '8080';

    const config = loadEnv();

    expect(config.port).toBe(8080);
  });

  it('throws on invalid PORT (not a number)', () => {
    setMinimalEnv();
    process.env['PORT'] = 'abc';

    expect(() => loadEnv()).toThrow('PORT must be an integer');
  });

  it('throws on PORT out of range', () => {
    setMinimalEnv();
    process.env['PORT'] = '70000';

    expect(() => loadEnv()).toThrow('PORT must be an integer between 1 and 65535');
  });

  it('throws on PORT with decimal', () => {
    setMinimalEnv();
    process.env['PORT'] = '3001.5';

    expect(() => loadEnv()).toThrow('PORT must be an integer');
  });

  it('throws when PROJECT_DIR is missing', () => {
    delete process.env['PROJECT_DIR'];

    expect(() => loadEnv()).toThrow('PROJECT_DIR is required');
  });

  it('throws when PROJECT_DIR is empty string', () => {
    process.env['PROJECT_DIR'] = '';

    expect(() => loadEnv()).toThrow('PROJECT_DIR is required');
  });

  it('throws when PROJECT_DIR does not exist', () => {
    process.env['PROJECT_DIR'] = '/nonexistent/path/xyz';

    expect(() => loadEnv()).toThrow('PROJECT_DIR does not exist');
  });

  it('throws when PROJECT_DIR is a file, not a directory', () => {
    const filePath = join(tempDir, 'not-a-dir.txt');
    writeFileSync(filePath, 'hello');
    process.env['PROJECT_DIR'] = filePath;

    expect(() => loadEnv()).toThrow('PROJECT_DIR is not a directory');
  });

  it('uses custom DATA_DIR when provided', () => {
    setMinimalEnv();
    process.env['DATA_DIR'] = '/tmp/custom-data';

    const config = loadEnv();

    expect(config.dataDir).toBe('/tmp/custom-data');
  });

  it('expands tilde in DATA_DIR', () => {
    setMinimalEnv();
    process.env['DATA_DIR'] = '~/custom-paige';

    const config = loadEnv();

    expect(config.dataDir).not.toContain('~');
    expect(config.dataDir).toContain('custom-paige');
  });

  it('captures ANTHROPIC_API_KEY when provided', () => {
    setMinimalEnv();
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';

    const config = loadEnv();

    expect(config.anthropicApiKey).toBe('sk-ant-test-key');
  });

  it('collects multiple errors into a single message', () => {
    process.env['PORT'] = 'notanumber';
    delete process.env['PROJECT_DIR'];

    expect(() => loadEnv()).toThrow(/PORT must be an integer[\s\S]*PROJECT_DIR is required/);
  });

  it('includes guidance in the error message', () => {
    delete process.env['PROJECT_DIR'];

    expect(() => loadEnv()).toThrow('Check your .env file');
  });
});
