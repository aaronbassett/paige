// MCP Coaching tools — paige_run_coaching_pipeline

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCoachingPipeline } from '../../coaching/pipeline.js';

/** Registers coaching tools (paige_run_coaching_pipeline) on the MCP server. */
export function registerCoachingTools(server: McpServer): void {
  // ── paige_run_coaching_pipeline ──────────────────────────────────────────

  server.tool(
    'paige_run_coaching_pipeline',
    'Run the coaching pipeline to generate a phased plan from issue context.',
    {
      plan_text: z.string().describe('Raw plan text from Claude Code'),
      issue_summary: z.string().describe('Summary of the GitHub issue or task'),
      issue_number: z.number().int().optional().describe('GitHub issue number'),
    },
    async ({ plan_text, issue_summary, issue_number }) => {
      const input: Parameters<typeof runCoachingPipeline>[0] = {
        planText: plan_text,
        issueSummary: issue_summary,
      };
      if (issue_number !== undefined) {
        input.issueNumber = issue_number;
      }
      const result = await runCoachingPipeline(input);

      if (result.error !== undefined) {
        return {
          content: [{ type: 'text' as const, text: result.error }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              plan: {
                id: result.planId,
                title: result.title,
                total_phases: result.totalPhases,
              },
            }),
          },
        ],
      };
    },
  );
}
