/**
 * WebSocket message type definitions for the Paige Electron UI.
 *
 * Defines all 51 message types exchanged between the Electron client
 * and the backend server over WebSocket. Matches the protocol contract
 * in specs/001-electron-ui/contracts/websocket-protocol.md v1.0.0.
 *
 * All types are named exports -- no default export.
 */

import type {
  IssueContext,
  Phase,
  TreeNode,
  HintLevel,
  AppView,
  RepoInfo,
  RepoActivityEntry,
  ScoredIssue,
} from './entities';

// ---------------------------------------------------------------------------
// MessageType — string literal union of all 51 message types
// ---------------------------------------------------------------------------

/** Server-to-client message type literals (28 types). */
export type ServerMessageType =
  // Connection lifecycle (3)
  | 'connection:hello'
  | 'connection:init'
  | 'connection:error'
  // Session management (3)
  | 'session:start'
  | 'session:restore'
  | 'session:end'
  // Dashboard data (6)
  | 'dashboard:dreyfus'
  | 'dashboard:stats'
  | 'dashboard:in_progress'
  | 'dashboard:issues'
  | 'dashboard:challenges'
  | 'dashboard:materials'
  // File system (4)
  | 'fs:tree'
  | 'fs:tree_update'
  | 'buffer:content'
  | 'save:ack'
  // Explorer hints (2)
  | 'explorer:hint_files'
  | 'explorer:clear_hints'
  // Editor decorations (2)
  | 'editor:decorations'
  | 'editor:clear_decorations'
  // Coaching messages (3)
  | 'coaching:message'
  | 'coaching:review_result'
  | 'coaching:clear'
  // Phase management (1)
  | 'phase:transition'
  // Observer nudges (1)
  | 'observer:nudge'
  // Planning flow (5)
  | 'planning:started'
  | 'planning:progress'
  | 'planning:phase_update'
  | 'planning:complete'
  | 'planning:error'
  // Errors (3)
  | 'error:file_not_found'
  | 'error:permission_denied'
  | 'error:general'
  // Landing page / repo picker (6)
  | 'repos:list_response'
  | 'repo:activity'
  | 'session:repo_started'
  | 'session:issue_selected'
  | 'dashboard:issue'
  | 'dashboard:issues_complete';

/** Client-to-server message type literals (23 types). */
export type ClientMessageType =
  // Connection lifecycle (1)
  | 'connection:ready'
  // Dashboard actions (3)
  | 'dashboard:stats_period'
  | 'dashboard:resume_task'
  | 'dashboard:start_issue'
  // File operations (3)
  | 'file:open'
  | 'file:close'
  | 'file:save'
  // Editor events (4)
  | 'buffer:update'
  | 'editor:cursor'
  | 'editor:scroll'
  | 'editor:selection'
  // Terminal events (3)
  | 'terminal:ready'
  | 'terminal:input'
  | 'terminal:resize'
  // Hints & coaching (5)
  | 'hints:level_change'
  | 'user:explain'
  | 'user:review'
  | 'coaching:dismiss'
  | 'coaching:feedback'
  // User activity (3)
  | 'user:idle_start'
  | 'user:idle_end'
  | 'user:navigation'
  // Phase actions (1)
  | 'phase:expand_step'
  // Landing page / repo picker (4)
  | 'repos:list'
  | 'repos:activity'
  | 'session:start_repo'
  | 'session:select_issue';

/** All 51 message types (server + client). */
export type MessageType = ServerMessageType | ClientMessageType;

// ---------------------------------------------------------------------------
// BaseMessage — the envelope every message shares
// ---------------------------------------------------------------------------

/** Common envelope for all WebSocket messages. */
export interface BaseMessage {
  /** One of the 51 defined message types. */
  type: MessageType;
  /** Type-specific payload (narrowed by each concrete interface). */
  payload: unknown;
  /** Optional correlation ID for request/response pairing. */
  id?: string;
  /** Unix epoch in milliseconds. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Shared sub-types used by multiple message payloads
// ---------------------------------------------------------------------------

/** Inline code range used by decoration and review payloads. */
export interface InlineCodeRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/** Position within a file (line + column). */
export interface InlinePosition {
  line: number;
  column: number;
}

// ---------------------------------------------------------------------------
// Server -> Client message interfaces (28)
// ---------------------------------------------------------------------------

// -- Connection lifecycle (3) ------------------------------------------------

/** Initial handshake from backend. */
export interface ConnectionHelloMessage extends BaseMessage {
  type: 'connection:hello';
  payload: {
    serverId: string;
    version: string;
    capabilities: string[];
  };
}

/** Backend ready for commands. */
export interface ConnectionInitMessage extends BaseMessage {
  type: 'connection:init';
  payload: {
    sessionId: string;
    projectDir: string;
    capabilities: {
      chromadb_available: boolean;
      github_api_available: boolean;
    };
    featureFlags: {
      observer_enabled: boolean;
      practice_mode_enabled: boolean;
    };
  };
}

/** Connection-level error. */
export interface ConnectionErrorMessage extends BaseMessage {
  type: 'connection:error';
  payload: {
    code: string;
    message: string;
  };
}

// -- Session management (3) --------------------------------------------------

/** New coding session started. */
export interface SessionStartMessage extends BaseMessage {
  type: 'session:start';
  payload: {
    sessionId: string;
    issueContext: IssueContext;
    phases: Phase[];
    initialHintLevel: HintLevel;
  };
}

/** Tab state snapshot sent during session restore. */
export interface RestoreTabState {
  path: string;
  content: string;
  language: string;
  cursorPosition: InlinePosition;
  scrollPosition: InlinePosition;
}

/** Restore session after reconnect. */
export interface SessionRestoreMessage extends BaseMessage {
  type: 'session:restore';
  payload: {
    sessionId: string;
    issueContext: IssueContext;
    phases: Phase[];
    openTabs: RestoreTabState[];
    activeTabPath: string;
    hintLevel: HintLevel;
  };
}

/** Session terminated. */
export interface SessionEndMessage extends BaseMessage {
  type: 'session:end';
  payload: {
    sessionId: string;
    reason: 'completed' | 'cancelled' | 'error';
  };
}

// -- Dashboard data (6) ------------------------------------------------------

/** Dreyfus model skill levels. */
export interface DashboardDreyfusMessage extends BaseMessage {
  type: 'dashboard:dreyfus';
  payload: {
    axes: Array<{
      skill: string;
      level: 1 | 2 | 3 | 4 | 5;
    }>;
  };
}

/** Coding statistics for a period. */
export interface DashboardStatsMessage extends BaseMessage {
  type: 'dashboard:stats';
  payload: {
    period: 'today' | 'last_week' | 'last_month' | 'all_time';
    stats: Partial<
      Record<
        string,
        {
          value: number | string;
          change: number;
          unit: 'count' | 'duration' | 'currency' | 'percentage' | 'text';
          sparkline?: ReadonlyArray<{ x: string; y: number }>;
          breakdown?: ReadonlyArray<{
            label: string;
            value: number;
            color?: string;
          }>;
          pills?: ReadonlyArray<{
            label: string;
            color: string;
            count: number;
          }>;
          progression?: ReadonlyArray<{ skill: string; level: string }>;
        }
      >
    >;
  };
}

/** In-progress tasks. */
export interface DashboardInProgressMessage extends BaseMessage {
  type: 'dashboard:in_progress';
  payload: {
    tasks: Array<{
      id: string;
      title: string;
      progress: number;
      dueDate?: string;
    }>;
  };
}

/** GitHub issues assigned to user. */
export interface DashboardIssuesMessage extends BaseMessage {
  type: 'dashboard:issues';
  payload: {
    issues: Array<{
      number: number;
      title: string;
      labels: Array<{ name: string; color: string }>;
      url: string;
    }>;
  };
}

/** Practice challenges. */
export interface DashboardChallengesMessage extends BaseMessage {
  type: 'dashboard:challenges';
  payload: {
    challenges: Array<{
      id: string;
      title: string;
      difficulty: 'easy' | 'medium' | 'hard';
      estimatedMinutes: number;
    }>;
  };
}

/** Learning materials. */
export interface DashboardMaterialsMessage extends BaseMessage {
  type: 'dashboard:materials';
  payload: {
    materials: Array<{
      id: string;
      title: string;
      type: 'article' | 'video' | 'tutorial';
      url: string;
    }>;
  };
}

// -- File system (4) ---------------------------------------------------------

/** Initial file tree. */
export interface FsTreeMessage extends BaseMessage {
  type: 'fs:tree';
  payload: {
    root: TreeNode;
  };
}

/** Incremental file tree change. */
export interface FsTreeUpdateMessage extends BaseMessage {
  type: 'fs:tree_update';
  payload: {
    action: 'add' | 'remove' | 'rename';
    path: string;
    newPath?: string;
    node?: TreeNode;
  };
}

/** File content response. */
export interface BufferContentMessage extends BaseMessage {
  type: 'buffer:content';
  payload: {
    path: string;
    content: string;
    language: string;
  };
}

/** Save operation acknowledgement. */
export interface SaveAckMessage extends BaseMessage {
  type: 'save:ack';
  payload: {
    path: string;
    success: boolean;
    error?: string;
  };
}

// -- Explorer hints (2) ------------------------------------------------------

/** File tree hints (glow effects). */
export interface ExplorerHintFilesMessage extends BaseMessage {
  type: 'explorer:hint_files';
  payload: {
    hints: Array<{
      path: string;
      style: 'subtle' | 'obvious' | 'unmissable';
      directories?: string[];
    }>;
  };
}

/** Clear all file hints. */
export interface ExplorerClearHintsMessage extends BaseMessage {
  type: 'explorer:clear_hints';
  payload: Record<string, never>;
}

// -- Editor decorations (2) --------------------------------------------------

/** Apply Monaco decorations to a file. */
export interface EditorDecorationsMessage extends BaseMessage {
  type: 'editor:decorations';
  payload: {
    path: string;
    decorations: Array<{
      type: 'line-highlight' | 'gutter-marker' | 'squiggly';
      range: InlineCodeRange;
      message?: string;
      style: 'hint' | 'error' | 'warning' | 'success';
      level: HintLevel;
    }>;
  };
}

/** Clear decorations for a file. */
export interface EditorClearDecorationsMessage extends BaseMessage {
  type: 'editor:clear_decorations';
  payload: {
    path: string;
  };
}

// -- Coaching messages (3) ---------------------------------------------------

/** Coaching hint or guidance. */
export interface CoachingMessageMessage extends BaseMessage {
  type: 'coaching:message';
  payload: {
    messageId: string;
    message: string;
    type: 'hint' | 'info' | 'success' | 'warning';
    anchor?: {
      path: string;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
    source: 'coaching' | 'explain' | 'observer';
  };
}

/** Review result with inline comments. */
export interface CoachingReviewResultMessage extends BaseMessage {
  type: 'coaching:review_result';
  payload: {
    scope: 'current' | 'file' | 'last_review' | 'last_phase' | 'issue_start';
    comments: Array<{
      messageId: string;
      path: string;
      range: InlineCodeRange;
      message: string;
      type: 'hint' | 'info' | 'success' | 'warning';
    }>;
  };
}

/** Clear coaching messages. */
export interface CoachingClearMessage extends BaseMessage {
  type: 'coaching:clear';
  payload: {
    messageIds?: string[];
  };
}

// -- Phase management (1) ----------------------------------------------------

/** Phase status transition. */
export interface PhaseTransitionMessage extends BaseMessage {
  type: 'phase:transition';
  payload: {
    phaseNumber: 1 | 2 | 3 | 4 | 5;
    newStatus: 'pending' | 'active' | 'complete';
  };
}

// -- Observer nudges (1) -----------------------------------------------------

/** AI coaching nudge injected into terminal. */
export interface ObserverNudgeMessage extends BaseMessage {
  type: 'observer:nudge';
  payload: {
    message: string;
  };
}

// -- Planning flow (5) -------------------------------------------------------

/** The four loading phases shown during planning. */
export type PlanningPhase = 'fetching' | 'exploring' | 'planning' | 'writing_hints';

/** Planning agent started. */
export interface PlanningStartedMessage extends BaseMessage {
  type: 'planning:started';
  payload: {
    sessionId: string;
    issueTitle: string;
  };
}

/** Planning agent progress event (tool use). */
export interface PlanningProgressMessage extends BaseMessage {
  type: 'planning:progress';
  payload: {
    message: string;
    toolName?: string;
    filePath?: string;
  };
}

/** Planning agent phase transition. */
export interface PlanningPhaseUpdateMessage extends BaseMessage {
  type: 'planning:phase_update';
  payload: {
    phase: PlanningPhase;
    progress: number;
  };
}

/** A task within a plan phase. */
export interface PlanTask {
  title: string;
  description: string;
  targetFiles: string[];
  hints: { low: string; medium: string; high: string };
}

/** A phase within the completed plan. */
export interface PlanPhase {
  number: number;
  title: string;
  description: string;
  hint: string;
  status: 'pending' | 'active';
  tasks: PlanTask[];
}

/** Planning agent completed with full plan payload. */
export interface PlanningCompleteMessage extends BaseMessage {
  type: 'planning:complete';
  payload: PlanningCompletePayload;
}

/** Payload of the planning:complete message. */
export interface PlanningCompletePayload {
  sessionId: string;
  plan: {
    title: string;
    summary: string;
    phases: PlanPhase[];
  };
  fileTree: TreeNode[];
  fileHints: Array<{
    path: string;
    style: 'subtle' | 'obvious' | 'unmissable';
    phase: number;
  }>;
  issueContext: {
    title: string;
    number: number;
    body: string;
    labels: string[];
    url: string;
  };
}

/** Planning agent error. */
export interface PlanningErrorMessage extends BaseMessage {
  type: 'planning:error';
  payload: {
    sessionId: string;
    error: string;
  };
}

// -- Errors (3) --------------------------------------------------------------

/** File not found error. */
export interface ErrorFileNotFoundMessage extends BaseMessage {
  type: 'error:file_not_found';
  payload: {
    path: string;
    operation: 'open' | 'save' | 'delete';
  };
}

/** Permission denied error. */
export interface ErrorPermissionDeniedMessage extends BaseMessage {
  type: 'error:permission_denied';
  payload: {
    path: string;
    operation: 'open' | 'save' | 'delete';
  };
}

/** Generic error. */
export interface ErrorGeneralMessage extends BaseMessage {
  type: 'error:general';
  payload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// -- Landing page / repo picker (6) ------------------------------------------

/** List of repositories the user has access to. */
export interface ReposListResponseMessage extends BaseMessage {
  type: 'repos:list_response';
  payload: {
    repos: RepoInfo[];
  };
}

/** Activity data for a single repository. */
export interface RepoActivityResponseMessage extends BaseMessage {
  type: 'repo:activity';
  payload: {
    repo: string;
    activities: RepoActivityEntry[];
  };
}

/** Confirmation that a repo-based session has started. */
export interface SessionRepoStartedMessage extends BaseMessage {
  type: 'session:repo_started';
  payload: {
    owner: string;
    repo: string;
  };
}

/** Confirmation that an issue was selected for a session. */
export interface SessionIssueSelectedMessage extends BaseMessage {
  type: 'session:issue_selected';
  payload: {
    sessionId: number;
    issueNumber: number;
  };
}

/** A single scored issue streamed from the backend. */
export interface DashboardSingleIssueMessage extends BaseMessage {
  type: 'dashboard:issue';
  payload: {
    issue: ScoredIssue;
  };
}

/** Signal that all issues have been streamed. */
export interface DashboardIssuesCompleteMessage extends BaseMessage {
  type: 'dashboard:issues_complete';
  payload: Record<string, never>;
}

// ---------------------------------------------------------------------------
// Client -> Server message interfaces (27)
// ---------------------------------------------------------------------------

// -- Connection lifecycle (1) ------------------------------------------------

/** Client ready to receive data. */
export interface ConnectionReadyMessage extends BaseMessage {
  type: 'connection:ready';
  payload: {
    clientVersion: string;
    capabilities: string[];
  };
}

// -- Dashboard actions (3) ---------------------------------------------------

/** Change stats period. */
export interface DashboardStatsPeriodMessage extends BaseMessage {
  type: 'dashboard:stats_period';
  payload: {
    period: 'today' | 'last_week' | 'last_month' | 'all_time';
  };
}

/** Resume an in-progress task. */
export interface DashboardResumeTaskMessage extends BaseMessage {
  type: 'dashboard:resume_task';
  payload: {
    taskId: string;
  };
}

/** Start work on a GitHub issue. */
export interface DashboardStartIssueMessage extends BaseMessage {
  type: 'dashboard:start_issue';
  payload: {
    issueNumber: number;
  };
}

// -- File operations (3) -----------------------------------------------------

/** Request file content. */
export interface FileOpenMessage extends BaseMessage {
  type: 'file:open';
  payload: {
    path: string;
  };
}

/** Close file tab (notify backend). */
export interface FileCloseMessage extends BaseMessage {
  type: 'file:close';
  payload: {
    path: string;
  };
}

/** Save file content. */
export interface FileSaveMessage extends BaseMessage {
  type: 'file:save';
  payload: {
    path: string;
    content: string;
  };
}

// -- Editor events (4) -------------------------------------------------------

/** File content changed (debounced 300ms). */
export interface BufferUpdateMessage extends BaseMessage {
  type: 'buffer:update';
  payload: {
    path: string;
    content: string;
    cursorPosition: InlinePosition;
  };
}

/** Cursor position changed. */
export interface EditorCursorMessage extends BaseMessage {
  type: 'editor:cursor';
  payload: {
    path: string;
    line: number;
    column: number;
  };
}

/** Editor scrolled (debounced 200ms). */
export interface EditorScrollMessage extends BaseMessage {
  type: 'editor:scroll';
  payload: {
    path: string;
    line: number;
    column: number;
  };
}

/** Text selected in editor. */
export interface EditorSelectionMessage extends BaseMessage {
  type: 'editor:selection';
  payload: {
    path: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    text: string;
  };
}

// -- Terminal events (3) -----------------------------------------------------

/** Terminal ready, send initial size. */
export interface TerminalReadyMessage extends BaseMessage {
  type: 'terminal:ready';
  payload: {
    cols: number;
    rows: number;
  };
}

/** User typed in terminal. */
export interface TerminalInputMessage extends BaseMessage {
  type: 'terminal:input';
  payload: {
    data: string;
  };
}

/** Terminal resized. */
export interface TerminalResizeMessage extends BaseMessage {
  type: 'terminal:resize';
  payload: {
    cols: number;
    rows: number;
  };
}

// -- Hints & coaching (5) ----------------------------------------------------

/** User changed hint level (debounced 200ms). */
export interface HintsLevelChangeMessage extends BaseMessage {
  type: 'hints:level_change';
  payload: {
    level: HintLevel;
  };
}

/** User requested code explanation. */
export interface UserExplainMessage extends BaseMessage {
  type: 'user:explain';
  payload: {
    path: string;
    range: InlineCodeRange;
    text: string;
  };
}

/** User requested code review. */
export interface UserReviewMessage extends BaseMessage {
  type: 'user:review';
  payload: {
    scope: 'current' | 'file' | 'last_review' | 'last_phase' | 'issue_start';
  };
}

/** User dismissed a coaching message. */
export interface CoachingDismissMessage extends BaseMessage {
  type: 'coaching:dismiss';
  payload: {
    messageId: string;
  };
}

/** User feedback on a coaching message. */
export interface CoachingFeedbackMessage extends BaseMessage {
  type: 'coaching:feedback';
  payload: {
    messageId: string;
    helpful: boolean;
  };
}

// -- User activity (3) -------------------------------------------------------

/** User idle for threshold duration. */
export interface UserIdleStartMessage extends BaseMessage {
  type: 'user:idle_start';
  payload: {
    durationMs: number;
  };
}

/** User active again after idle. */
export interface UserIdleEndMessage extends BaseMessage {
  type: 'user:idle_end';
  payload: Record<string, never>;
}

/** View navigation (dashboard <-> IDE). */
export interface UserNavigationMessage extends BaseMessage {
  type: 'user:navigation';
  payload: {
    from: AppView;
    to: AppView;
  };
}

// -- Phase actions (1) -------------------------------------------------------

/** User expanded a phase sub-step accordion. */
export interface PhaseExpandStepMessage extends BaseMessage {
  type: 'phase:expand_step';
  payload: {
    phaseNumber: 1 | 2 | 3 | 4 | 5;
    stepIndex: number;
  };
}

// -- Landing page / repo picker (4) ------------------------------------------

/** Request the list of repos the user has access to. */
export interface ReposListRequestMessage extends BaseMessage {
  type: 'repos:list';
  payload: Record<string, never>;
}

/** Request activity data for specific repos. */
export interface ReposActivityRequestMessage extends BaseMessage {
  type: 'repos:activity';
  payload: {
    repos: string[];
  };
}

/** Start a session with a specific repo. */
export interface SessionStartRepoMessage extends BaseMessage {
  type: 'session:start_repo';
  payload: {
    owner: string;
    repo: string;
  };
}

/** Select an issue within the current repo session. */
export interface SessionSelectIssueMessage extends BaseMessage {
  type: 'session:select_issue';
  payload: {
    issueNumber: number;
  };
}

// ---------------------------------------------------------------------------
// Aggregate union types
// ---------------------------------------------------------------------------

/** Union of all 28 server-to-client messages. */
export type ServerMessage =
  | ConnectionHelloMessage
  | ConnectionInitMessage
  | ConnectionErrorMessage
  | SessionStartMessage
  | SessionRestoreMessage
  | SessionEndMessage
  | DashboardDreyfusMessage
  | DashboardStatsMessage
  | DashboardInProgressMessage
  | DashboardIssuesMessage
  | DashboardChallengesMessage
  | DashboardMaterialsMessage
  | FsTreeMessage
  | FsTreeUpdateMessage
  | BufferContentMessage
  | SaveAckMessage
  | ExplorerHintFilesMessage
  | ExplorerClearHintsMessage
  | EditorDecorationsMessage
  | EditorClearDecorationsMessage
  | CoachingMessageMessage
  | CoachingReviewResultMessage
  | CoachingClearMessage
  | PhaseTransitionMessage
  | ObserverNudgeMessage
  | PlanningStartedMessage
  | PlanningProgressMessage
  | PlanningPhaseUpdateMessage
  | PlanningCompleteMessage
  | PlanningErrorMessage
  | ErrorFileNotFoundMessage
  | ErrorPermissionDeniedMessage
  | ErrorGeneralMessage
  | ReposListResponseMessage
  | RepoActivityResponseMessage
  | SessionRepoStartedMessage
  | SessionIssueSelectedMessage
  | DashboardSingleIssueMessage
  | DashboardIssuesCompleteMessage;

/** Union of all 27 client-to-server messages. */
export type ClientMessage =
  | ConnectionReadyMessage
  | DashboardStatsPeriodMessage
  | DashboardResumeTaskMessage
  | DashboardStartIssueMessage
  | FileOpenMessage
  | FileCloseMessage
  | FileSaveMessage
  | BufferUpdateMessage
  | EditorCursorMessage
  | EditorScrollMessage
  | EditorSelectionMessage
  | TerminalReadyMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | HintsLevelChangeMessage
  | UserExplainMessage
  | UserReviewMessage
  | CoachingDismissMessage
  | CoachingFeedbackMessage
  | UserIdleStartMessage
  | UserIdleEndMessage
  | UserNavigationMessage
  | PhaseExpandStepMessage
  | ReposListRequestMessage
  | ReposActivityRequestMessage
  | SessionStartRepoMessage
  | SessionSelectIssueMessage;

/** Union of all 61 WebSocket messages. */
export type WebSocketMessage = ServerMessage | ClientMessage;

// ---------------------------------------------------------------------------
// Type guard functions
// ---------------------------------------------------------------------------

/**
 * Narrow a WebSocketMessage to ConnectionHelloMessage.
 * Use at the WebSocket boundary to safely handle incoming messages.
 */
export function isConnectionHelloMessage(msg: WebSocketMessage): msg is ConnectionHelloMessage {
  return msg.type === 'connection:hello';
}

/**
 * Narrow a WebSocketMessage to SessionStartMessage.
 */
export function isSessionStartMessage(msg: WebSocketMessage): msg is SessionStartMessage {
  return msg.type === 'session:start';
}

/**
 * Narrow a WebSocketMessage to SessionRestoreMessage.
 */
export function isSessionRestoreMessage(msg: WebSocketMessage): msg is SessionRestoreMessage {
  return msg.type === 'session:restore';
}

/**
 * Narrow a WebSocketMessage to BufferContentMessage.
 */
export function isBufferContentMessage(msg: WebSocketMessage): msg is BufferContentMessage {
  return msg.type === 'buffer:content';
}

/**
 * Narrow a WebSocketMessage to SaveAckMessage.
 */
export function isSaveAckMessage(msg: WebSocketMessage): msg is SaveAckMessage {
  return msg.type === 'save:ack';
}

/**
 * Narrow a WebSocketMessage to CoachingMessageMessage.
 */
export function isCoachingMessageMessage(msg: WebSocketMessage): msg is CoachingMessageMessage {
  return msg.type === 'coaching:message';
}

/**
 * Narrow a WebSocketMessage to PhaseTransitionMessage.
 */
export function isPhaseTransitionMessage(msg: WebSocketMessage): msg is PhaseTransitionMessage {
  return msg.type === 'phase:transition';
}

/**
 * Narrow a WebSocketMessage to ExplorerHintFilesMessage.
 */
export function isExplorerHintFilesMessage(msg: WebSocketMessage): msg is ExplorerHintFilesMessage {
  return msg.type === 'explorer:hint_files';
}

/**
 * Narrow a WebSocketMessage to EditorDecorationsMessage.
 */
export function isEditorDecorationsMessage(msg: WebSocketMessage): msg is EditorDecorationsMessage {
  return msg.type === 'editor:decorations';
}

/**
 * Narrow a WebSocketMessage to DashboardIssuesMessage.
 */
export function isDashboardIssuesMessage(msg: WebSocketMessage): msg is DashboardIssuesMessage {
  return msg.type === 'dashboard:issues';
}
