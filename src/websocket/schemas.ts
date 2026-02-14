// Zod schemas for validating incoming WebSocket messages at runtime.
// Prevents untrusted client input from bypassing type safety.

import { z } from 'zod';

// ── Shared Sub-Type Schemas ─────────────────────────────────────────────────

const selectionRangeSchema = z.object({
  start: z.number(),
  end: z.number(),
});

const editorRangeSchema = z.object({
  startLine: z.number(),
  startColumn: z.number(),
  endLine: z.number(),
  endColumn: z.number(),
});

const lineRangeSchema = z.object({
  startLine: z.number(),
  endLine: z.number(),
});

// ── Client -> Server Message Data Schemas ───────────────────────────────────

const connectionHelloDataSchema = z.object({
  version: z.string(),
  platform: z.string(),
  windowSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

const fileOpenDataSchema = z.object({
  path: z.string(),
});

const fileSaveDataSchema = z.object({
  path: z.string(),
  content: z.string(),
});

const fileCloseDataSchema = z.object({
  path: z.string(),
});

const fileCreateDataSchema = z.object({
  path: z.string(),
});

const fileDeleteDataSchema = z.object({
  path: z.string(),
});

const bufferUpdateDataSchema = z.object({
  path: z.string(),
  content: z.string(),
  cursorPosition: z.number(),
  selections: z.array(selectionRangeSchema),
});

const editorTabSwitchDataSchema = z.object({
  fromPath: z.string(),
  toPath: z.string(),
});

const editorSelectionDataSchema = z.object({
  path: z.string(),
  range: editorRangeSchema,
  selectedText: z.string(),
});

const hintsLevelChangeDataSchema = z.object({
  from: z.enum(['off', 'low', 'medium', 'high']),
  to: z.enum(['off', 'low', 'medium', 'high']),
});

const userIdleStartDataSchema = z.object({
  durationMs: z.number(),
});

const userIdleEndDataSchema = z.object({
  idleDurationMs: z.number(),
});

const userExplainDataSchema = z.object({
  path: z.string(),
  range: lineRangeSchema,
  selectedText: z.string(),
});

const observerMuteDataSchema = z.object({
  muted: z.boolean(),
});

const practiceSubmitSolutionDataSchema = z.object({
  kataId: z.number(),
  code: z.string(),
  activeConstraints: z.array(z.string()),
});

const practiceRequestHintDataSchema = z.object({
  kataId: z.number(),
});

const practiceViewPreviousAttemptsDataSchema = z.object({
  kataId: z.number(),
});

const dashboardRequestDataSchema = z.object({
  statsPeriod: z.enum(['today', 'last_week', 'last_month', 'all_time']),
});

const dashboardStatsPeriodDataSchema = z.object({
  period: z.enum(['today', 'last_week', 'last_month', 'all_time']),
});

const dashboardRefreshIssuesDataSchema = z.object({});

const terminalCommandDataSchema = z.object({
  command: z.string(),
});

const terminalReadyDataSchema = z.object({
  cols: z.number(),
  rows: z.number(),
});

const terminalResizeDataSchema = z.object({
  cols: z.number(),
  rows: z.number(),
});

const terminalInputDataSchema = z.object({
  data: z.string(),
});

const treeExpandDataSchema = z.object({
  path: z.string(),
});

const treeCollapseDataSchema = z.object({
  path: z.string(),
});

const reviewRequestDataSchema = z.object({
  phaseId: z.number(),
});

const reposListRequestDataSchema = z.object({});

const reposActivityRequestDataSchema = z.object({
  repos: z.array(z.string()),
});

const sessionStartRepoDataSchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

const sessionSelectIssueWsDataSchema = z.object({
  issueNumber: z.number(),
  issueTitle: z.string().optional(),
  issueBody: z.string().optional(),
  issueLabels: z.array(z.string()).optional(),
  issueUrl: z.string().optional(),
});

const fsRequestTreeDataSchema = z.object({});

// ── Message Envelope Schema ─────────────────────────────────────────────────

/**
 * Base schema for all WebSocket messages: { type, data }.
 * This only validates the envelope structure, not the specific data payload.
 * Both type and data are required fields.
 */
export const messageEnvelopeSchema = z
  .object({
    type: z.string(),
    data: z.unknown(),
  })
  .strict(); // Reject additional properties

/**
 * Map of message type -> data schema.
 * Used for validating the data payload based on the message type.
 */
export const messageDataSchemas = {
  'connection:hello': connectionHelloDataSchema,
  'file:open': fileOpenDataSchema,
  'file:save': fileSaveDataSchema,
  'file:close': fileCloseDataSchema,
  'file:create': fileCreateDataSchema,
  'file:delete': fileDeleteDataSchema,
  'buffer:update': bufferUpdateDataSchema,
  'editor:tab_switch': editorTabSwitchDataSchema,
  'editor:selection': editorSelectionDataSchema,
  'hints:level_change': hintsLevelChangeDataSchema,
  'user:idle_start': userIdleStartDataSchema,
  'user:idle_end': userIdleEndDataSchema,
  'user:explain': userExplainDataSchema,
  'observer:mute': observerMuteDataSchema,
  'practice:submit_solution': practiceSubmitSolutionDataSchema,
  'practice:request_hint': practiceRequestHintDataSchema,
  'practice:view_previous_attempts': practiceViewPreviousAttemptsDataSchema,
  'dashboard:request': dashboardRequestDataSchema,
  'dashboard:refresh_issues': dashboardRefreshIssuesDataSchema,
  'dashboard:stats_period': dashboardStatsPeriodDataSchema,
  'terminal:command': terminalCommandDataSchema,
  'terminal:ready': terminalReadyDataSchema,
  'terminal:resize': terminalResizeDataSchema,
  'terminal:input': terminalInputDataSchema,
  'tree:expand': treeExpandDataSchema,
  'tree:collapse': treeCollapseDataSchema,
  'review:request': reviewRequestDataSchema,
  'repos:list': reposListRequestDataSchema,
  'repos:activity': reposActivityRequestDataSchema,
  'session:start_repo': sessionStartRepoDataSchema,
  'session:select_issue': sessionSelectIssueWsDataSchema,
  'fs:request_tree': fsRequestTreeDataSchema,
} as const;

/**
 * Validates a parsed WebSocket message envelope and its data payload.
 *
 * @param parsed - The parsed JSON object to validate
 * @returns Validated message with type and data, or throws ZodError
 *
 * @example
 * ```ts
 * const parsed = JSON.parse(rawMessage);
 * const validated = validateClientMessage(parsed);
 * // validated.type is narrowed to a valid message type
 * // validated.data is validated against the schema for that type
 * ```
 */
export function validateClientMessage(parsed: unknown): { type: string; data: unknown } {
  // First validate the envelope structure
  const envelope = messageEnvelopeSchema.parse(parsed);

  // Ensure data field is present for known message types
  const dataSchema = messageDataSchemas[envelope.type as keyof typeof messageDataSchemas];

  if (!dataSchema) {
    // Unknown message type — let it pass through to the router
    // The router will handle unknown types with NOT_IMPLEMENTED error
    // Still require the data field to be present
    if (!('data' in (parsed as object))) {
      throw new Error('Message must contain "data" field');
    }
    return envelope;
  }

  // Validate the data payload for known message types
  const validatedData = dataSchema.parse(envelope.data);

  return {
    type: envelope.type,
    data: validatedData,
  };
}
