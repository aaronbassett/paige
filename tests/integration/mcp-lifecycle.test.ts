import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { createDatabase, closeDatabase } from '../../src/database/db.js';
import { registerLifecycleTools } from '../../src/mcp/tools/lifecycle.js';
import { registerReadTools } from '../../src/mcp/tools/read.js';
import { registerUiTools } from '../../src/mcp/tools/ui.js';
import { updateBuffer, clearAll as clearBuffers } from '../../src/file-system/buffer-cache.js';
import { clearMcpSessions } from '../../src/mcp/session.js';

/**
 * Integration tests for the MCP tool surface.
 *
 * Exercises tool execution over an in-memory MCP transport with a real SQLite
 * database, real buffer cache, and real file system (temp directories).
 *
 * The tool registration functions are currently TDD stubs that register nothing.
 * These tests MUST fail until the tools are implemented in Phase 8.
 *
 * Coverage:
 *   - Session lifecycle (start, end, duplicate-start error, end-without-session error)
 *   - Read tools (get_buffer, get_open_files, get_diff, get_session_state)
 *   - UI control tools (highlight_lines, clear_highlights, hint_files, show_message)
 */

describe('MCP tool surface (integration)', () => {
  let tempDir: string;
  let tempProjectDir: string;
  let mcpServer: McpServer;
  let client: Client;

  beforeAll(async () => {
    // Create isolated temp directories
    tempDir = join(tmpdir(), `paige-mcp-${randomUUID()}`);
    tempProjectDir = join(tmpdir(), `paige-mcp-project-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(tempProjectDir, { recursive: true });

    // Set environment variables expected by tool implementations
    process.env['PROJECT_DIR'] = tempProjectDir;
    process.env['DATA_DIR'] = tempDir;

    // Create real database
    const dbPath = join(tempDir, 'paige.db');
    await createDatabase(dbPath);

    // Set up MCP server with tool registrations
    mcpServer = new McpServer({ name: 'paige', version: '1.0.0' }, { capabilities: { tools: {} } });

    registerLifecycleTools(mcpServer);
    registerReadTools(mcpServer);
    registerUiTools(mcpServer);

    // Connect via in-memory transport
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await mcpServer.connect(serverTransport);

    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await mcpServer.close();
    await closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(tempProjectDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearBuffers();
    clearMcpSessions();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Extracts the text content from an MCP tool result.
   * Tool results return content as an array of content blocks; the first
   * text block contains the JSON-serialized response.
   */
  function extractText(result: Awaited<ReturnType<typeof client.callTool>>): string {
    const block = result.content;
    if (!Array.isArray(block) || block.length === 0) {
      throw new Error('Expected at least one content block in tool result');
    }
    const first = block[0] as { type: string; text?: string };
    if (first.type !== 'text' || typeof first.text !== 'string') {
      throw new Error(`Expected text content block, got type="${first.type}"`);
    }
    return first.text;
  }

  /**
   * Extracts and parses JSON from an MCP tool result.
   */
  function extractJson(result: Awaited<ReturnType<typeof client.callTool>>): unknown {
    return JSON.parse(extractText(result));
  }

  // ── Tool Discovery ───────────────────────────────────────────────────────────

  describe('Tool discovery', () => {
    it('lists all 12 registered tools', async () => {
      const result = await client.listTools();
      const names = result.tools.map((t) => t.name).sort();

      expect(names).toEqual([
        'paige_clear_highlights',
        'paige_clear_hints',
        'paige_end_session',
        'paige_get_buffer',
        'paige_get_diff',
        'paige_get_open_files',
        'paige_get_session_state',
        'paige_highlight_lines',
        'paige_hint_files',
        'paige_open_file',
        'paige_show_issue_context',
        'paige_show_message',
        'paige_start_session',
        'paige_update_phase',
      ]);
    });
  });

  // ── Session Lifecycle ────────────────────────────────────────────────────────

  describe('Session lifecycle', () => {
    it('paige_start_session creates a session and returns session info', async () => {
      const result = await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as {
        session_id: number;
        project_dir: string;
        status: string;
      };

      expect(data.session_id).toBeTypeOf('number');
      expect(data.session_id).toBeGreaterThan(0);
      expect(data.project_dir).toBe(tempProjectDir);
      expect(data.status).toBe('active');
    });

    it('paige_start_session while session is active returns error', async () => {
      // First session
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      // Second session attempt should fail
      const result = await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      expect(result.isError).toBe(true);
    });

    it('paige_end_session ends the current session', async () => {
      // Start a session first
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      // End it
      const result = await client.callTool({
        name: 'paige_end_session',
        arguments: {},
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as {
        success: boolean;
        session_id: number;
        memories_added: number;
        gaps_identified: number;
        katas_generated: number;
        assessments_updated: number;
      };

      expect(data.success).toBe(true);
      expect(data.session_id).toBeTypeOf('number');
    });

    it('paige_end_session without active session returns error', async () => {
      const result = await client.callTool({
        name: 'paige_end_session',
        arguments: {},
      });

      expect(result.isError).toBe(true);
    });
  });

  // ── Read Tools ───────────────────────────────────────────────────────────────

  describe('Read tools', () => {
    it('paige_get_buffer returns buffer content when buffer exists', async () => {
      // Start a session (required context for read tools)
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      // Populate the buffer cache directly
      const filePath = join(tempProjectDir, 'src', 'index.ts');
      const content = 'export const answer = 42;\n';
      updateBuffer(filePath, content, { line: 1, column: 1 });

      const result = await client.callTool({
        name: 'paige_get_buffer',
        arguments: { path: filePath },
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as {
        content: string;
        dirty: boolean;
      };

      expect(data.content).toBe(content);
      expect(data.dirty).toBe(true);
    });

    it('paige_get_buffer returns null for non-existent buffer', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      const result = await client.callTool({
        name: 'paige_get_buffer',
        arguments: { path: join(tempProjectDir, 'does-not-exist.ts') },
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as { content: null } | null;

      // Accept either null or an object with null content
      if (data === null) {
        expect(data).toBeNull();
      } else {
        expect(data.content).toBeNull();
      }
    });

    it('paige_get_open_files returns list of open files', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      // Populate buffers
      const file1 = join(tempProjectDir, 'a.ts');
      const file2 = join(tempProjectDir, 'b.ts');
      updateBuffer(file1, 'a', { line: 1, column: 1 });
      updateBuffer(file2, 'b', { line: 1, column: 1 });

      const result = await client.callTool({
        name: 'paige_get_open_files',
        arguments: {},
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as { files: string[] };

      expect(data.files).toContain(file1);
      expect(data.files).toContain(file2);
      expect(data.files).toHaveLength(2);
    });

    it('paige_get_diff returns unified diff for dirty buffer', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      // Create a real file on disk
      const filePath = join(tempProjectDir, 'diff-test.ts');
      writeFileSync(filePath, 'const x = 1;\n', 'utf-8');

      // Populate buffer with modified content
      updateBuffer(filePath, 'const x = 2;\n', { line: 1, column: 1 });

      const result = await client.callTool({
        name: 'paige_get_diff',
        arguments: { path: filePath },
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as { diff: string };

      expect(data.diff).toContain('---');
      expect(data.diff).toContain('+++');
      expect(data.diff).toContain('-const x = 1;');
      expect(data.diff).toContain('+const x = 2;');
    });

    it('paige_get_session_state returns current session info', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      const result = await client.callTool({
        name: 'paige_get_session_state',
        arguments: {},
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as {
        session_id: number;
        project_dir: string;
        status: string;
      };

      expect(data.session_id).toBeTypeOf('number');
      expect(data.project_dir).toBe(tempProjectDir);
      expect(data.status).toBe('active');
    });
  });

  // ── UI Control Tools ─────────────────────────────────────────────────────────

  describe('UI control tools', () => {
    it('paige_highlight_lines returns success', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      const filePath = join(tempProjectDir, 'highlight-test.ts');
      writeFileSync(filePath, 'line one\nline two\nline three\n', 'utf-8');

      const result = await client.callTool({
        name: 'paige_highlight_lines',
        arguments: {
          path: filePath,
          ranges: [{ start: 1, end: 2, style: 'info' }],
        },
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('paige_clear_highlights returns success', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      const result = await client.callTool({
        name: 'paige_clear_highlights',
        arguments: {},
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('paige_hint_files returns success', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      const result = await client.callTool({
        name: 'paige_hint_files',
        arguments: {
          paths: ['src/index.ts'],
          style: 'suggested',
        },
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('paige_show_message returns success', async () => {
      await client.callTool({
        name: 'paige_start_session',
        arguments: { project_dir: tempProjectDir },
      });

      const result = await client.callTool({
        name: 'paige_show_message',
        arguments: {
          message: 'Great progress! Keep going.',
          type: 'info',
        },
      });

      expect(result.isError).not.toBe(true);

      const data = extractJson(result) as { success: boolean };
      expect(data.success).toBe(true);
    });
  });
});
