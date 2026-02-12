import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { Server } from 'node:http';
import { createServer, VERSION } from '../../src/index.js';

/**
 * Contract tests for User Story 1: Server Foundation & Lifecycle
 *
 * These tests verify the public API contract of the server module.
 * They run against the real server (no mocks) and validate:
 *   1. Module exports (createServer function, VERSION constant)
 *   2. Server startup on a configurable port
 *   3. Health endpoint shape and status
 *
 * Written TDD-style: these tests are expected to FAIL until
 * `createServer` is implemented in src/index.ts.
 */

describe('server startup contract', () => {
  let server: Server;
  let close: () => Promise<void>;
  let baseUrl: string;

  beforeAll(async () => {
    // Use port 0 to let the OS assign a random available port
    const result = await createServer({ port: 0 });
    server = result.server;
    close = result.close;

    // Retrieve the actual port assigned by the OS
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected server address to be an AddressInfo object');
    }
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  });

  afterAll(async () => {
    await close();
  });

  // --- Module exports contract ---

  it('exports a VERSION string constant', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it('exports a createServer function', () => {
    expect(typeof createServer).toBe('function');
  });

  // --- Server startup contract ---

  it('resolves to an object with server and close properties', () => {
    expect(server).toBeDefined();
    expect(typeof close).toBe('function');
    // server should be a Node.js http.Server (has `listening` property)
    expect(server.listening).toBe(true);
  });

  // --- Health endpoint contract ---

  it('GET /health returns 200 with status ok and numeric uptime', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = (await response.json()) as Record<string, unknown>;

    expect(body['status']).toBe('ok');
    expect(typeof body['uptime']).toBe('number');
    expect(body['uptime']).toBeGreaterThanOrEqual(0);
  });

  it('GET /health uptime increases over time', async () => {
    const first = (await (await fetch(`${baseUrl}/health`)).json()) as Record<string, unknown>;
    const firstUptime = first['uptime'] as number;

    // Wait a short period so uptime is measurably different
    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });

    const second = (await (await fetch(`${baseUrl}/health`)).json()) as Record<string, unknown>;
    const secondUptime = second['uptime'] as number;

    expect(secondUptime).toBeGreaterThan(firstUptime);
  });
});
