import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ServerHandle } from '../../src/index.js';

/**
 * Integration tests for the GET /health endpoint (User Story 1, Scenario 4).
 *
 * These tests start a real HTTP server and make real fetch requests.
 * No mocking -- this validates actual HTTP behavior end-to-end.
 *
 * Written TDD-style: these tests MUST fail until the server
 * implementation is complete (createServer currently throws).
 */

interface HealthResponse {
  status: string;
  uptime: number;
}

describe('GET /health', () => {
  let handle: ServerHandle;
  let baseUrl: string;

  beforeAll(async () => {
    // Create real temp directories so env validation passes
    const tempProjectDir = mkdtempSync(join(tmpdir(), 'paige-health-project-'));
    const tempDataDir = mkdtempSync(join(tmpdir(), 'paige-health-data-'));

    // Set environment variables that loadEnv() requires
    process.env['PROJECT_DIR'] = tempProjectDir;
    process.env['DATA_DIR'] = tempDataDir;
    // ANTHROPIC_API_KEY is optional -- leave unset for health tests

    // Start server on port 0 to let the OS assign a free port
    handle = await createServer({ port: 0 });

    // Extract the actual port assigned by the OS
    const address = handle.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Server did not bind to an address');
    }
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  });

  afterAll(async () => {
    if (handle) {
      await handle.close();
    }
  });

  it('responds with 200 and correct JSON shape', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);

    const body = (await response.json()) as HealthResponse;
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('uptime');
    expect(typeof body.uptime).toBe('number');
  });

  it('returns Content-Type application/json', async () => {
    const response = await fetch(`${baseUrl}/health`);

    const contentType = response.headers.get('content-type');
    expect(contentType).toBeDefined();
    expect(contentType).toContain('application/json');
  });

  it('returns uptime greater than zero after a brief delay', async () => {
    // Wait a small amount so uptime is measurably > 0
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });

    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as HealthResponse;

    expect(body.uptime).toBeGreaterThan(0);
  });

  it('returns increasing uptime across sequential requests', async () => {
    const first = await fetch(`${baseUrl}/health`);
    const firstBody = (await first.json()) as HealthResponse;

    // Small delay to ensure uptime advances
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    const second = await fetch(`${baseUrl}/health`);
    const secondBody = (await second.json()) as HealthResponse;

    expect(secondBody.uptime).toBeGreaterThanOrEqual(firstBody.uptime);
  });

  it('handles multiple rapid requests without crashing', async () => {
    const requests = Array.from({ length: 10 }, () =>
      fetch(`${baseUrl}/health`).then((r) => r.status),
    );

    const statuses = await Promise.all(requests);

    for (const status of statuses) {
      expect(status).toBe(200);
    }
  });

  it('rejects POST /health with 404 or 405', async () => {
    const response = await fetch(`${baseUrl}/health`, { method: 'POST' });

    // Server should not crash; it should return a non-success status
    expect([404, 405]).toContain(response.status);
  });

  it('rejects PUT /health with 404 or 405', async () => {
    const response = await fetch(`${baseUrl}/health`, { method: 'PUT' });

    expect([404, 405]).toContain(response.status);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/nonexistent`);

    expect(response.status).toBe(404);
  });
});
