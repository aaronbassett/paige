// MCP UI control tools — paige_open_file, paige_highlight_lines, paige_clear_highlights,
// paige_hint_files, paige_clear_hints, paige_update_phase, paige_show_message, paige_show_issue_context
// Broadcasts WebSocket messages to Electron UI for editor/explorer/coaching state updates.

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getLogger } from '../../logger/logtape.js';
import { broadcast } from '../../websocket/server.js';

const logger = getLogger(['paige', 'mcp', 'tools']);
import { readFile } from '../../file-system/file-ops.js';
import { loadEnv } from '../../config/env.js';
import { getActiveSessionId } from '../session.js';
import { generateLearningMaterials } from '../../coaching/generate-materials.js';

/** Registers UI control tools on the MCP server. */
export function registerUiTools(server: McpServer): void {
  // ── paige_open_file ──────────────────────────────────────────────────────

  server.tool(
    'paige_open_file',
    'Open a file in Electron editor.',
    {
      path: z.string().describe('File path to open (absolute or relative to project dir)'),
    },
    async ({ path }) => {
      try {
        const env = loadEnv();
        const result = await readFile(path, env.projectDir);
        const lineCount = result.content.split('\n').length;

        broadcast({
          type: 'fs:content',
          data: { path, content: result.content, language: result.language, lineCount },
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, path }) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: message }],
          isError: true,
        };
      }
    },
  );

  // ── paige_highlight_lines ────────────────────────────────────────────────

  server.tool(
    'paige_highlight_lines',
    'Apply line decorations in Electron editor.',
    {
      path: z.string().describe('File path to highlight'),
      ranges: z
        .array(
          z.object({
            start: z.number().describe('Start line number'),
            end: z.number().describe('End line number'),
            style: z.enum(['info', 'warning', 'error']).describe('Highlight style'),
          }),
        )
        .describe('Line ranges to highlight'),
    },
    ({ path, ranges }) => {
      broadcast({
        type: 'editor:highlight_lines',
        data: { path, ranges },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );

  // ── paige_clear_highlights ───────────────────────────────────────────────

  server.tool(
    'paige_clear_highlights',
    'Clear line decorations.',
    {
      path: z.string().optional().describe('File path to clear highlights for (all if omitted)'),
    },
    ({ path }) => {
      broadcast({
        type: 'editor:clear_highlights',
        data: { path },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );

  // ── paige_hint_files ─────────────────────────────────────────────────────

  server.tool(
    'paige_hint_files',
    'Apply file tree decorations.',
    {
      paths: z.array(z.string()).describe('File paths to hint'),
      style: z
        .enum(['suggested', 'warning', 'error'])
        .describe('Hint style for the file tree decoration'),
    },
    ({ paths, style }) => {
      broadcast({
        type: 'explorer:hint_files',
        data: { paths, style },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );

  // ── paige_clear_hints ────────────────────────────────────────────────────

  server.tool('paige_clear_hints', 'Clear all file tree decorations.', {}, () => {
    broadcast({
      type: 'explorer:clear_hints',
      data: {},
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
    };
  });

  // ── paige_update_phase ───────────────────────────────────────────────────

  server.tool(
    'paige_update_phase',
    'Update phase status.',
    {
      phase: z.number().int().describe('Phase number'),
      status: z.enum(['active', 'complete']).describe('New phase status'),
    },
    ({ phase, status }) => {
      // The CoachingPhaseUpdateData expects a full CoachingPhase object, but the MCP
      // tool only receives phase number and status. Construct a minimal object and
      // cast to bypass the strict readonly typing.
      broadcast({
        type: 'coaching:phase_update',
        data: {
          phase: {
            id: 0,
            number: phase,
            title: '',
            status,
          },
        },
      } as never);

      // Fire-and-forget: generate learning materials when a phase completes
      if (status === 'complete') {
        const sessionId = getActiveSessionId();
        if (sessionId !== null) {
          void generateLearningMaterials({
            phaseNumber: phase,
            sessionId,
          }).catch((err: unknown) => {
            logger.error`Failed to generate learning materials: ${err}`;
          });
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );

  // ── paige_show_message ───────────────────────────────────────────────────

  server.tool(
    'paige_show_message',
    'Display a coaching message in Electron UI.',
    {
      message: z.string().describe('Message text to display'),
      type: z.enum(['info', 'success', 'warning', 'error']).describe('Message severity'),
    },
    ({ message, type }) => {
      broadcast({
        type: 'coaching:message',
        data: { message, type },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );

  // ── paige_show_issue_context ─────────────────────────────────────────────

  server.tool(
    'paige_show_issue_context',
    'Display GitHub issue context in Electron UI sidebar.',
    {
      title: z.string().describe('Issue title'),
      summary: z.string().describe('Issue summary'),
    },
    ({ title, summary }) => {
      broadcast({
        type: 'coaching:issue_context',
        data: { title, summary },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }],
      };
    },
  );
}
