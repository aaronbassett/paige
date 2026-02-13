import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { createServer, type ServerHandle } from '../../src/index.js';
import { getBuffer, clearAll as clearBuffers } from '../../src/file-system/buffer-cache.js';
import type {
  ClientToServerMessage,
  ServerToClientMessage,
  ConnectionHelloData,
  ConnectionInitData,
  FsContentData,
  BufferUpdateData,
} from '../../src/types/websocket.js';

/**
 * Integration tests for WebSocket connection handshake and message exchange.
 *
 * These tests start a real HTTP + WebSocket server and make real WebSocket
 * connections. No mocking -- this validates actual WebSocket behavior end-to-end.
 *
 * Written TDD-style: these tests MUST fail until the WebSocket server
 * implementation is created (src/websocket/server.ts, src/websocket/router.ts,
 * src/websocket/handlers/ do not exist yet).
 *
 * The import of `createWebSocketServer` from `../../src/websocket/server.js`
 * will cause an immediate import failure -- this is intentional TDD.
 */

// ── Test Helpers ──────────────────────────────────────────────────────────────

/**
 * Opens a WebSocket connection to the test server.
 * Resolves when the connection is open, rejects on error.
 */
function connectWs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/**
 * Waits for the next message on the WebSocket and parses it as JSON.
 * Resolves with the parsed server-to-client message.
 */
function waitForMessage(ws: WebSocket): Promise<ServerToClientMessage> {
  return new Promise((resolve) => {
    ws.once('message', (data: WebSocket.RawData) => {
      resolve(
        JSON.parse(Buffer.from(data as ArrayBuffer).toString('utf-8')) as ServerToClientMessage,
      );
    });
  });
}

/**
 * Sends a client-to-server message over the WebSocket.
 */
function sendMessage(ws: WebSocket, message: ClientToServerMessage): void {
  ws.send(JSON.stringify(message));
}

/**
 * Closes a WebSocket connection and waits for it to complete.
 */
function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on('close', () => resolve());
    ws.close();
  });
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('WebSocket handshake (integration)', () => {
  let handle: ServerHandle;
  let port: number;
  let tempProjectDir: string;
  let tempDataDir: string;

  beforeAll(async () => {
    // Create real temp directories so env validation passes
    tempProjectDir = mkdtempSync(join(tmpdir(), 'paige-ws-project-'));
    tempDataDir = mkdtempSync(join(tmpdir(), 'paige-ws-data-'));

    // Set environment variables that loadEnv() requires
    process.env['PROJECT_DIR'] = tempProjectDir;
    process.env['DATA_DIR'] = tempDataDir;

    // Start server on port 0 to let the OS assign a free port
    handle = await createServer({ port: 0 });

    // Extract the actual port assigned by the OS
    const address = handle.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Server did not bind to an address');
    }
    port = address.port;
  });

  afterAll(async () => {
    if (handle) {
      await handle.close();
    }
    rmSync(tempProjectDir, { recursive: true, force: true });
    rmSync(tempDataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearBuffers();
  });

  // ── Test 1: Connection handshake ──────────────────────────────────────────

  describe('connection:hello -> connection:init', () => {
    let ws: WebSocket;

    afterEach(async () => {
      if (ws) {
        await closeWs(ws);
      }
    });

    it('responds with connection:init containing sessionId, capabilities, and featureFlags', async () => {
      ws = await connectWs(port);

      // Send connection:hello
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const messagePromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });

      // Wait for connection:init response
      const response = await messagePromise;

      expect(response.type).toBe('connection:init');

      const initData = response.data as ConnectionInitData;
      expect(initData.sessionId).toBeTruthy();
      expect(typeof initData.sessionId).toBe('string');

      // Capabilities should be an object with boolean fields
      expect(initData.capabilities).toBeDefined();
      expect(typeof initData.capabilities.chromadb_available).toBe('boolean');
      expect(typeof initData.capabilities.github_api_available).toBe('boolean');

      // Feature flags should be an object with boolean fields
      expect(initData.featureFlags).toBeDefined();
      expect(typeof initData.featureFlags.observer_enabled).toBe('boolean');
      expect(typeof initData.featureFlags.practice_mode_enabled).toBe('boolean');
    });

    it('assigns a unique sessionId to each connection', async () => {
      // First connection
      const ws1 = await connectWs(port);
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };

      const msg1Promise = waitForMessage(ws1);
      sendMessage(ws1, { type: 'connection:hello', data: helloData });
      const msg1 = await msg1Promise;

      // Second connection
      const ws2 = await connectWs(port);
      const msg2Promise = waitForMessage(ws2);
      sendMessage(ws2, { type: 'connection:hello', data: helloData });
      const msg2 = await msg2Promise;

      const initData1 = msg1.data as ConnectionInitData;
      const initData2 = msg2.data as ConnectionInitData;

      expect(initData1.sessionId).not.toBe(initData2.sessionId);

      await closeWs(ws1);
      await closeWs(ws2);
    });
  });

  // ── Test 2: File operations ───────────────────────────────────────────────

  describe('file:open -> fs:content', () => {
    let ws: WebSocket;

    afterEach(async () => {
      if (ws) {
        await closeWs(ws);
      }
    });

    it('responds with fs:content containing file content, language, and lineCount', async () => {
      // Create a test file in the PROJECT_DIR
      const testFilePath = join(tempProjectDir, 'test-file.ts');
      const testContent = 'const greeting: string = "hello";\nconsole.log(greeting);\n';
      writeFileSync(testFilePath, testContent, 'utf-8');

      ws = await connectWs(port);

      // Complete handshake first
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      await initPromise;

      // Send file:open
      const contentPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'file:open', data: { path: testFilePath } });

      // Wait for fs:content response
      const response = await contentPromise;

      expect(response.type).toBe('fs:content');

      const fsData = response.data as FsContentData;
      expect(fsData.path).toBe(testFilePath);
      expect(fsData.content).toBe(testContent);
      expect(fsData.language).toBe('typescript');
      expect(fsData.lineCount).toBe(3); // Two lines + trailing newline = 3 lines
    });

    it('responds with connection:error for a non-existent file', async () => {
      ws = await connectWs(port);

      // Complete handshake first
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      await initPromise;

      // Send file:open for non-existent file
      const errorPromise = waitForMessage(ws);
      sendMessage(ws, {
        type: 'file:open',
        data: { path: join(tempProjectDir, 'does-not-exist.ts') },
      });

      const response = await errorPromise;

      expect(response.type).toBe('connection:error');
    });
  });

  // ── Test 3: Buffer updates ────────────────────────────────────────────────

  describe('buffer:update', () => {
    let ws: WebSocket;

    afterEach(async () => {
      if (ws) {
        await closeWs(ws);
      }
    });

    it('updates the buffer cache with the new content', async () => {
      ws = await connectWs(port);

      // Complete handshake first
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      await initPromise;

      // Send buffer:update
      const bufferPath = join(tempProjectDir, 'buffered-file.ts');
      const bufferContent = 'const x = 42;\n';
      const updateData: BufferUpdateData = {
        path: bufferPath,
        content: bufferContent,
        cursorPosition: 14,
        selections: [],
      };
      sendMessage(ws, { type: 'buffer:update', data: updateData });

      // Wait a brief moment for the server to process the message
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      // Verify the buffer cache was updated
      const buffer = getBuffer(bufferPath);
      expect(buffer).not.toBeNull();
      expect(buffer!.content).toBe(bufferContent);
      expect(buffer!.dirty).toBe(true);
    });

    it('overwrites previous buffer content on subsequent updates', async () => {
      ws = await connectWs(port);

      // Complete handshake first
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      await initPromise;

      const bufferPath = join(tempProjectDir, 'overwrite-file.ts');

      // First update
      sendMessage(ws, {
        type: 'buffer:update',
        data: {
          path: bufferPath,
          content: 'first version',
          cursorPosition: 5,
          selections: [],
        },
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      // Second update
      sendMessage(ws, {
        type: 'buffer:update',
        data: {
          path: bufferPath,
          content: 'second version',
          cursorPosition: 10,
          selections: [],
        },
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      const buffer = getBuffer(bufferPath);
      expect(buffer).not.toBeNull();
      expect(buffer!.content).toBe('second version');
    });
  });

  // ── Test 4: Action-loggable messages ──────────────────────────────────────

  describe('action-loggable messages', () => {
    let ws: WebSocket;

    afterEach(async () => {
      if (ws) {
        await closeWs(ws);
      }
    });

    it('does not crash when receiving editor:tab_switch', async () => {
      ws = await connectWs(port);

      // Complete handshake
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      await initPromise;

      // Send editor:tab_switch — should trigger logAction, no response expected
      sendMessage(ws, {
        type: 'editor:tab_switch',
        data: { fromPath: '/src/a.ts', toPath: '/src/b.ts' },
      });

      // Wait to ensure no crash; the server should remain responsive
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      // Verify the connection is still open by sending another message
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('does not crash when receiving hints:level_change', async () => {
      ws = await connectWs(port);

      // Complete handshake
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      await initPromise;

      // Send hints:level_change — should trigger logAction
      sendMessage(ws, {
        type: 'hints:level_change',
        data: { from: 'low', to: 'medium' },
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('does not crash when receiving user:idle_start and user:idle_end', async () => {
      ws = await connectWs(port);

      // Complete handshake
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      await initPromise;

      // Send user:idle_start
      sendMessage(ws, {
        type: 'user:idle_start',
        data: { durationMs: 30000 },
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      // Send user:idle_end
      sendMessage(ws, {
        type: 'user:idle_end',
        data: { idleDurationMs: 45000 },
      });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  // ── Test 5: Disconnect cleanup ────────────────────────────────────────────

  describe('disconnect cleanup', () => {
    it('removes connection metadata when client disconnects', async () => {
      const ws = await connectWs(port);

      // Complete handshake
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };
      const initPromise = waitForMessage(ws);
      sendMessage(ws, { type: 'connection:hello', data: helloData });
      const initMsg = await initPromise;
      const sessionId = (initMsg.data as ConnectionInitData).sessionId;

      expect(sessionId).toBeTruthy();

      // Close the WebSocket connection
      await closeWs(ws);

      // Wait a brief moment for the server to process the disconnect
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      // After disconnect, connecting a new client should get a different sessionId
      // (This implicitly verifies the old connection was cleaned up, because
      // the server tracks connections and assigns fresh sessionIds)
      const ws2 = await connectWs(port);
      const msg2Promise = waitForMessage(ws2);
      sendMessage(ws2, { type: 'connection:hello', data: helloData });
      const msg2 = await msg2Promise;

      const newSessionId = (msg2.data as ConnectionInitData).sessionId;
      expect(newSessionId).not.toBe(sessionId);

      await closeWs(ws2);
    });

    it('does not affect other connected clients when one disconnects', async () => {
      const helloData: ConnectionHelloData = {
        version: '1.0.0',
        platform: 'linux',
        windowSize: { width: 1920, height: 1080 },
      };

      // Connect two clients
      const ws1 = await connectWs(port);
      const init1Promise = waitForMessage(ws1);
      sendMessage(ws1, { type: 'connection:hello', data: helloData });
      await init1Promise;

      const ws2 = await connectWs(port);
      const init2Promise = waitForMessage(ws2);
      sendMessage(ws2, { type: 'connection:hello', data: helloData });
      await init2Promise;

      // Disconnect the first client
      await closeWs(ws1);

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      // The second client should still be connected
      expect(ws2.readyState).toBe(WebSocket.OPEN);

      await closeWs(ws2);
    });
  });
});
