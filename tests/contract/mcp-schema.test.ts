import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerLifecycleTools } from '../../src/mcp/tools/lifecycle.js';
import { registerReadTools } from '../../src/mcp/tools/read.js';
import { registerUiTools } from '../../src/mcp/tools/ui.js';

/**
 * Contract tests for the MCP tool surface (Backend <-> Claude Code Plugin).
 *
 * These tests validate that the MCP server registers the correct tools with
 * the correct schemas, as defined in specs/002-backend-server/contracts/mcp-tools.json.
 *
 * Verified contract invariants:
 *   1. Exactly 14 tools are registered (excluding paige_run_coaching_pipeline)
 *   2. All tool names follow the paige_* naming convention
 *   3. Lifecycle tools (2): paige_start_session, paige_end_session
 *   4. Read tools (4): paige_get_buffer, paige_get_open_files, paige_get_diff, paige_get_session_state
 *   5. UI tools (8): paige_open_file, paige_highlight_lines, paige_clear_highlights,
 *      paige_hint_files, paige_clear_hints, paige_update_phase, paige_show_message,
 *      paige_show_issue_context
 *   6. Required input parameters match the contract for each tool
 *
 * Written TDD-style: these tests FAIL until the registration functions
 * in src/mcp/tools/ actually register tools on the McpServer.
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** Shape returned by client.listTools() for each tool. */
interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, object>;
    required?: string[];
  };
}

// ── Expected tool definitions ───────────────────────────────────────────────

/** All 14 tools expected from the contract (excludes paige_run_coaching_pipeline). */
const EXPECTED_TOOL_NAMES = [
  // Lifecycle (2)
  'paige_start_session',
  'paige_end_session',
  // Read (4)
  'paige_get_buffer',
  'paige_get_open_files',
  'paige_get_diff',
  'paige_get_session_state',
  // UI (8)
  'paige_open_file',
  'paige_highlight_lines',
  'paige_clear_highlights',
  'paige_hint_files',
  'paige_clear_hints',
  'paige_update_phase',
  'paige_show_message',
  'paige_show_issue_context',
] as const;

const LIFECYCLE_TOOLS = ['paige_start_session', 'paige_end_session'] as const;

const READ_TOOLS = [
  'paige_get_buffer',
  'paige_get_open_files',
  'paige_get_diff',
  'paige_get_session_state',
] as const;

const UI_TOOLS = [
  'paige_open_file',
  'paige_highlight_lines',
  'paige_clear_highlights',
  'paige_hint_files',
  'paige_clear_hints',
  'paige_update_phase',
  'paige_show_message',
  'paige_show_issue_context',
] as const;

/**
 * Expected required parameters for each tool, per the contract.
 * Tools with no required params are mapped to an empty array.
 */
const EXPECTED_REQUIRED_PARAMS: Record<string, string[]> = {
  paige_start_session: ['project_dir'],
  paige_end_session: [],
  paige_get_buffer: ['path'],
  paige_get_open_files: [],
  paige_get_diff: [],
  paige_get_session_state: [],
  paige_open_file: ['path'],
  paige_highlight_lines: ['path', 'ranges'],
  paige_clear_highlights: [],
  paige_hint_files: ['paths', 'style'],
  paige_clear_hints: [],
  paige_update_phase: ['phase', 'status'],
  paige_show_message: ['message', 'type'],
  paige_show_issue_context: ['title', 'summary'],
};

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('MCP tool schema contract', () => {
  let client: Client;
  let server: McpServer;
  let tools: ToolInfo[];

  beforeAll(async () => {
    // Create MCP server with tool capabilities
    server = new McpServer({ name: 'paige', version: '1.0.0' }, { capabilities: { tools: {} } });

    // Register all 14 tools via the module functions
    registerLifecycleTools(server);
    registerReadTools(server);
    registerUiTools(server);

    // Connect via in-memory transport (no HTTP needed)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    // Fetch all tools once — reused across tests
    const result = await client.listTools();
    tools = result.tools as ToolInfo[];
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  // ── 1. Tool count ─────────────────────────────────────────────────────

  describe('tool registration count', () => {
    it('registers exactly 14 tools', () => {
      expect(tools).toHaveLength(14);
    });
  });

  // ── 2. Naming convention ──────────────────────────────────────────────

  describe('tool naming convention', () => {
    it('all tool names start with paige_ prefix', () => {
      for (const tool of tools) {
        expect(tool.name).toMatch(/^paige_/);
      }
    });

    it('all expected tool names are present', () => {
      const registeredNames = tools.map((t) => t.name);
      for (const expected of EXPECTED_TOOL_NAMES) {
        expect(registeredNames).toContain(expected);
      }
    });

    it('no unexpected tools are registered', () => {
      const registeredNames = new Set(tools.map((t) => t.name));
      const expectedNames = new Set<string>(EXPECTED_TOOL_NAMES);
      for (const name of registeredNames) {
        expect(expectedNames.has(name)).toBe(true);
      }
    });
  });

  // ── 3. Tool categories ────────────────────────────────────────────────

  describe('tool categories', () => {
    it('contains all 2 lifecycle tools', () => {
      const registeredNames = tools.map((t) => t.name);
      for (const name of LIFECYCLE_TOOLS) {
        expect(registeredNames).toContain(name);
      }
    });

    it('contains all 4 read tools', () => {
      const registeredNames = tools.map((t) => t.name);
      for (const name of READ_TOOLS) {
        expect(registeredNames).toContain(name);
      }
    });

    it('contains all 8 UI tools', () => {
      const registeredNames = tools.map((t) => t.name);
      for (const name of UI_TOOLS) {
        expect(registeredNames).toContain(name);
      }
    });
  });

  // ── 4. Input schema — required parameters ─────────────────────────────

  describe('required input parameters', () => {
    it('paige_start_session requires project_dir', () => {
      const tool = tools.find((t) => t.name === 'paige_start_session');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['project_dir']));
    });

    it('paige_end_session has no required parameters', () => {
      const tool = tools.find((t) => t.name === 'paige_end_session');
      expect(tool).toBeDefined();
      const required = tool?.inputSchema.required ?? [];
      expect(required).toHaveLength(0);
    });

    it('paige_get_buffer requires path', () => {
      const tool = tools.find((t) => t.name === 'paige_get_buffer');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['path']));
    });

    it('paige_get_open_files has no required parameters', () => {
      const tool = tools.find((t) => t.name === 'paige_get_open_files');
      expect(tool).toBeDefined();
      const required = tool?.inputSchema.required ?? [];
      expect(required).toHaveLength(0);
    });

    it('paige_get_diff has no required parameters', () => {
      const tool = tools.find((t) => t.name === 'paige_get_diff');
      expect(tool).toBeDefined();
      const required = tool?.inputSchema.required ?? [];
      expect(required).toHaveLength(0);
    });

    it('paige_get_session_state has no required parameters', () => {
      const tool = tools.find((t) => t.name === 'paige_get_session_state');
      expect(tool).toBeDefined();
      const required = tool?.inputSchema.required ?? [];
      expect(required).toHaveLength(0);
    });

    it('paige_open_file requires path', () => {
      const tool = tools.find((t) => t.name === 'paige_open_file');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['path']));
    });

    it('paige_highlight_lines requires path and ranges', () => {
      const tool = tools.find((t) => t.name === 'paige_highlight_lines');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['path', 'ranges']));
    });

    it('paige_clear_highlights has no required parameters', () => {
      const tool = tools.find((t) => t.name === 'paige_clear_highlights');
      expect(tool).toBeDefined();
      const required = tool?.inputSchema.required ?? [];
      expect(required).toHaveLength(0);
    });

    it('paige_hint_files requires paths and style', () => {
      const tool = tools.find((t) => t.name === 'paige_hint_files');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['paths', 'style']));
    });

    it('paige_clear_hints has no required parameters', () => {
      const tool = tools.find((t) => t.name === 'paige_clear_hints');
      expect(tool).toBeDefined();
      const required = tool?.inputSchema.required ?? [];
      expect(required).toHaveLength(0);
    });

    it('paige_update_phase requires phase and status', () => {
      const tool = tools.find((t) => t.name === 'paige_update_phase');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['phase', 'status']));
    });

    it('paige_show_message requires message and type', () => {
      const tool = tools.find((t) => t.name === 'paige_show_message');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['message', 'type']));
    });

    it('paige_show_issue_context requires title and summary', () => {
      const tool = tools.find((t) => t.name === 'paige_show_issue_context');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(expect.arrayContaining(['title', 'summary']));
    });
  });

  // ── 5. Input schema — property presence ───────────────────────────────

  describe('input schema properties', () => {
    it('paige_start_session has project_dir, issue_number, issue_title properties', () => {
      const tool = tools.find((t) => t.name === 'paige_start_session');
      expect(tool).toBeDefined();
      const props = Object.keys(tool?.inputSchema.properties ?? {});
      expect(props).toContain('project_dir');
      expect(props).toContain('issue_number');
      expect(props).toContain('issue_title');
    });

    it('paige_get_diff has optional path property', () => {
      const tool = tools.find((t) => t.name === 'paige_get_diff');
      expect(tool).toBeDefined();
      const props = Object.keys(tool?.inputSchema.properties ?? {});
      expect(props).toContain('path');
      // path is optional — not in required
      const required = tool?.inputSchema.required ?? [];
      expect(required).not.toContain('path');
    });

    it('paige_get_session_state has optional include property', () => {
      const tool = tools.find((t) => t.name === 'paige_get_session_state');
      expect(tool).toBeDefined();
      const props = Object.keys(tool?.inputSchema.properties ?? {});
      expect(props).toContain('include');
      const required = tool?.inputSchema.required ?? [];
      expect(required).not.toContain('include');
    });

    it('paige_clear_highlights has optional path property', () => {
      const tool = tools.find((t) => t.name === 'paige_clear_highlights');
      expect(tool).toBeDefined();
      const props = Object.keys(tool?.inputSchema.properties ?? {});
      expect(props).toContain('path');
      const required = tool?.inputSchema.required ?? [];
      expect(required).not.toContain('path');
    });
  });

  // ── 6. Tool descriptions ──────────────────────────────────────────────

  describe('tool descriptions', () => {
    it('every tool has a non-empty description', () => {
      for (const tool of tools) {
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.description!.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 7. Comprehensive required params validation ───────────────────────

  describe('all tools match expected required params from contract', () => {
    for (const [toolName, expectedRequired] of Object.entries(EXPECTED_REQUIRED_PARAMS)) {
      it(`${toolName} has correct required params: [${expectedRequired.join(', ') || 'none'}]`, () => {
        const tool = tools.find((t) => t.name === toolName);
        expect(tool).toBeDefined();

        const actual = tool?.inputSchema.required ?? [];

        if (expectedRequired.length === 0) {
          expect(actual).toHaveLength(0);
        } else {
          expect(actual).toEqual(expect.arrayContaining(expectedRequired));
          expect(actual).toHaveLength(expectedRequired.length);
        }
      });
    }
  });

  // ── 8. Read-only contract (no write tools) ────────────────────────────

  describe('read-only enforcement', () => {
    it('no tool names contain write, edit, create, or delete', () => {
      const writePatterns = /write|edit|create|delete|remove|modify/i;
      for (const tool of tools) {
        expect(tool.name).not.toMatch(writePatterns);
      }
    });
  });
});
