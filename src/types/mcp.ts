// MCP tool type definitions for the Paige backend server
// Derived from specs/002-backend-server/contracts/mcp-tools.json
//
// Tools are organized into four categories:
//   - Lifecycle: session start/end, coaching pipeline
//   - Read: buffer state, open files, diffs, session state
//   - UI Control: highlights, hints, messages, file opening, phase updates
//   - Display: issue context

import type {
  Session,
  Plan,
  Phase,
  DreyfusAssessment,
  KnowledgeGap,
  KataSpec,
  ActionLogEntry,
} from './domain.js';

// ── Lifecycle Tools ─────────────────────────────────────────────────────────

/** Input for paige_start_session */
export interface StartSessionInput {
  /** Absolute path to the project directory */
  project_dir: string;
  /** GitHub issue number (optional) */
  issue_number?: number | undefined;
  /** GitHub issue title (optional) */
  issue_title?: string | undefined;
}

/** Output for paige_start_session */
export interface StartSessionOutput {
  success: boolean;
  session: Pick<
    Session,
    'id' | 'project_dir' | 'issue_number' | 'issue_title' | 'status' | 'started_at'
  >;
}

/** Input for paige_end_session (no parameters) */
export type EndSessionInput = Record<string, never>;

/** Output for paige_end_session */
export interface EndSessionOutput {
  success: boolean;
  /** Number of memories added to ChromaDB */
  memories_added: number;
  /** Number of knowledge gaps identified */
  gaps_identified: number;
  /** Number of kata exercises generated */
  katas_generated: number;
  /** Number of Dreyfus assessments updated */
  assessments_updated: number;
}

/** Input for paige_run_coaching_pipeline (no parameters) */
export type RunCoachingPipelineInput = Record<string, never>;

/** Output for paige_run_coaching_pipeline */
export interface RunCoachingPipelineOutput {
  success: boolean;
  plan: Pick<Plan, 'id' | 'title' | 'total_phases'>;
}

// ── Read Tools ──────────────────────────────────────────────────────────────

/** Input for paige_get_buffer */
export interface GetBufferInput {
  /** File path (absolute or relative to PROJECT_DIR) */
  path: string;
}

/** Buffer state returned by paige_get_buffer */
export interface BufferState {
  path: string;
  content: string;
  cursorPosition: number;
  dirty: boolean;
  /** ISO 8601 timestamp */
  lastUpdated: string;
}

/** Output for paige_get_buffer (null if no buffer entry exists) */
export type GetBufferOutput = BufferState | null;

/** Input for paige_get_open_files (no parameters) */
export type GetOpenFilesInput = Record<string, never>;

/** Output for paige_get_open_files */
export interface GetOpenFilesOutput {
  paths: string[];
}

/** Input for paige_get_diff */
export interface GetDiffInput {
  /** Optional file path. If omitted, returns diffs for all dirty files. */
  path?: string | undefined;
}

/** A single file diff entry */
export interface FileDiff {
  path: string;
  /** Unified diff format */
  diff: string;
}

/** Output for paige_get_diff */
export interface GetDiffOutput {
  diffs: FileDiff[];
}

/** Valid state filter keys for paige_get_session_state */
export type SessionStateKey =
  | 'session'
  | 'plan'
  | 'phase'
  | 'dreyfus'
  | 'gaps'
  | 'katas'
  | 'actions'
  | 'diffs'
  | 'open_files';

/** Input for paige_get_session_state */
export interface GetSessionStateInput {
  /** Optional filter. If omitted, returns all state items. */
  include?: SessionStateKey[] | undefined;
}

/** Output for paige_get_session_state (all fields optional based on include filter) */
export interface GetSessionStateOutput {
  session?: Session | undefined;
  plan?: Plan | undefined;
  phase?: Phase | undefined;
  dreyfus?: DreyfusAssessment[] | undefined;
  gaps?: KnowledgeGap[] | undefined;
  katas?: KataSpec[] | undefined;
  actions?: ActionLogEntry[] | undefined;
  diffs?: FileDiff[] | undefined;
  open_files?: string[] | undefined;
}

// ── UI Control Tools ────────────────────────────────────────────────────────

/** Input for paige_open_file */
export interface OpenFileInput {
  /** File path (absolute or relative to PROJECT_DIR) */
  path: string;
}

/** Output for paige_open_file */
export interface OpenFileOutput {
  success: boolean;
  path: string;
}

/** Decoration style for line highlights */
export type HighlightStyle = 'info' | 'warning' | 'error';

/** A line range with decoration style */
export interface HighlightRange {
  /** Start line (1-indexed) */
  start: number;
  /** End line (1-indexed, inclusive) */
  end: number;
  /** Decoration style */
  style: HighlightStyle;
}

/** Input for paige_highlight_lines */
export interface HighlightLinesInput {
  /** File path */
  path: string;
  /** Line ranges to highlight */
  ranges: HighlightRange[];
}

/** Output for paige_highlight_lines */
export interface HighlightLinesOutput {
  success: boolean;
}

/** Input for paige_clear_highlights */
export interface ClearHighlightsInput {
  /** Optional file path. If omitted, clears all files. */
  path?: string | undefined;
}

/** Output for paige_clear_highlights */
export interface ClearHighlightsOutput {
  success: boolean;
}

/** File tree hint style */
export type FileHintStyle = 'suggested' | 'warning' | 'error';

/** Input for paige_hint_files */
export interface HintFilesInput {
  /** File paths to hint */
  paths: string[];
  /** Decoration style */
  style: FileHintStyle;
}

/** Output for paige_hint_files */
export interface HintFilesOutput {
  success: boolean;
}

/** Input for paige_clear_hints (no parameters) */
export type ClearHintsInput = Record<string, never>;

/** Output for paige_clear_hints */
export interface ClearHintsOutput {
  success: boolean;
}

/** Phase status transitions (cannot go back to pending) */
export type PhaseUpdateStatus = 'active' | 'complete';

/** Input for paige_update_phase */
export interface UpdatePhaseInput {
  /** Phase number (1-indexed) */
  phase: number;
  /** New status */
  status: PhaseUpdateStatus;
}

/** Output for paige_update_phase */
export interface UpdatePhaseOutput {
  success: boolean;
  phase: Pick<Phase, 'id' | 'number' | 'title' | 'status'>;
}

/** Message type for coaching messages */
export type MessageType = 'info' | 'success' | 'warning' | 'error';

/** Input for paige_show_message */
export interface ShowMessageInput {
  /** Message text */
  message: string;
  /** Message type */
  type: MessageType;
}

/** Output for paige_show_message */
export interface ShowMessageOutput {
  success: boolean;
}

// ── Display Tools ───────────────────────────────────────────────────────────

/** Input for paige_show_issue_context */
export interface ShowIssueContextInput {
  /** Issue title */
  title: string;
  /** Issue summary or description */
  summary: string;
}

/** Output for paige_show_issue_context */
export interface ShowIssueContextOutput {
  success: boolean;
}

// ── Tool Name Union & Mapping ───────────────────────────────────────────────

/** String literal union of all MCP tool names */
export type McpToolName =
  // Lifecycle
  | 'paige_start_session'
  | 'paige_end_session'
  | 'paige_run_coaching_pipeline'
  // Read
  | 'paige_get_buffer'
  | 'paige_get_open_files'
  | 'paige_get_diff'
  | 'paige_get_session_state'
  // UI Control
  | 'paige_open_file'
  | 'paige_highlight_lines'
  | 'paige_clear_highlights'
  | 'paige_hint_files'
  | 'paige_clear_hints'
  | 'paige_update_phase'
  | 'paige_show_message'
  // Display
  | 'paige_show_issue_context';

/** Maps each MCP tool name to its input and output types */
export interface McpToolMap {
  // Lifecycle
  paige_start_session: { input: StartSessionInput; output: StartSessionOutput };
  paige_end_session: { input: EndSessionInput; output: EndSessionOutput };
  paige_run_coaching_pipeline: {
    input: RunCoachingPipelineInput;
    output: RunCoachingPipelineOutput;
  };
  // Read
  paige_get_buffer: { input: GetBufferInput; output: GetBufferOutput };
  paige_get_open_files: { input: GetOpenFilesInput; output: GetOpenFilesOutput };
  paige_get_diff: { input: GetDiffInput; output: GetDiffOutput };
  paige_get_session_state: { input: GetSessionStateInput; output: GetSessionStateOutput };
  // UI Control
  paige_open_file: { input: OpenFileInput; output: OpenFileOutput };
  paige_highlight_lines: { input: HighlightLinesInput; output: HighlightLinesOutput };
  paige_clear_highlights: { input: ClearHighlightsInput; output: ClearHighlightsOutput };
  paige_hint_files: { input: HintFilesInput; output: HintFilesOutput };
  paige_clear_hints: { input: ClearHintsInput; output: ClearHintsOutput };
  paige_update_phase: { input: UpdatePhaseInput; output: UpdatePhaseOutput };
  paige_show_message: { input: ShowMessageInput; output: ShowMessageOutput };
  // Display
  paige_show_issue_context: { input: ShowIssueContextInput; output: ShowIssueContextOutput };
}

/** Extract the input type for a given MCP tool */
export type McpToolInput<T extends McpToolName> = McpToolMap[T]['input'];

/** Extract the output type for a given MCP tool */
export type McpToolOutput<T extends McpToolName> = McpToolMap[T]['output'];

/** Generic MCP tool handler function signature */
export type McpToolHandler<T extends McpToolName> = (
  input: McpToolInput<T>,
) => Promise<McpToolOutput<T>>;
