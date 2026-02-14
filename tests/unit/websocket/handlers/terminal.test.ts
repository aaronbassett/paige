import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket as WsWebSocket } from 'ws';

// ── Mock dependencies BEFORE imports ──────────────────────────────────────────

vi.mock('../../../../src/websocket/server.js', () => ({
  sendToClient: vi.fn(),
  broadcast: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  handleTerminalReady,
  handleTerminalResize,
  handleTerminalInput,
  getTerminalState,
} from '../../../../src/websocket/handlers/terminal.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_WS = {} as WsWebSocket;
const CONNECTION_ID = 'conn-terminal-1';

describe('terminal handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleTerminalReady', () => {
    it('should store terminal dimensions and ready state', () => {
      handleTerminalReady(FAKE_WS, { cols: 80, rows: 24 }, CONNECTION_ID);

      const state = getTerminalState(CONNECTION_ID);
      expect(state).toEqual({
        ready: true,
        cols: 80,
        rows: 24,
      });
    });
  });

  describe('handleTerminalResize', () => {
    it('should update terminal dimensions', () => {
      handleTerminalReady(FAKE_WS, { cols: 80, rows: 24 }, CONNECTION_ID);
      handleTerminalResize(FAKE_WS, { cols: 120, rows: 40 }, CONNECTION_ID);

      const state = getTerminalState(CONNECTION_ID);
      expect(state).toEqual({
        ready: true,
        cols: 120,
        rows: 40,
      });
    });
  });

  describe('handleTerminalInput', () => {
    it('should not throw', () => {
      expect(() => {
        handleTerminalInput(FAKE_WS, { data: 'ls\n' }, CONNECTION_ID);
      }).not.toThrow();
    });
  });

  describe('getTerminalState', () => {
    it('should return null for unknown connections', () => {
      expect(getTerminalState('unknown-conn')).toBeNull();
    });
  });
});
