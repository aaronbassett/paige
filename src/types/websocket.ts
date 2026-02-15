/**
 * WebSocket protocol type definitions for Backend <-> Electron communication.
 *
 * 55 message types total:
 *   - 23 Client->Server (Electron to Backend)
 *   - 32 Server->Client (Backend to Electron)
 *
 * All messages follow the { type, data } discriminated union pattern.
 * Derived from specs/002-backend-server/contracts/websocket.json
 */

import type { HintLevel, PhaseStatus } from './domain.js';
import type { TreeNode } from '../file-system/tree.js';

// ── Shared Sub-Types ────────────────────────────────────────────────────────

/** Editor text selection range (character offsets). */
export interface SelectionRange {
  readonly start: number;
  readonly end: number;
}

/** Editor cursor range (line/column coordinates). */
export interface EditorRange {
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

/** Line range for "Explain This" feature. */
export interface LineRange {
  readonly startLine: number;
  readonly endLine: number;
}

/** Editor line highlight decoration. */
export type HighlightStyle = 'info' | 'warning' | 'error';

export interface HighlightRange {
  readonly start: number;
  readonly end: number;
  readonly style: HighlightStyle;
}

/** File tree hint style. */
export type ExplorerHintStyle = 'suggested' | 'warning' | 'error';

/** Connection error codes. */
export type ConnectionErrorCode = 'NOT_IMPLEMENTED' | 'INVALID_MESSAGE' | 'INTERNAL_ERROR';

/** File system watcher action. */
export type FsTreeAction = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

/** Coaching message severity. */
export type CoachingMessageType = 'info' | 'success' | 'warning' | 'error';

/** Observer nudge signal types. */
export type NudgeSignal =
  | 'stuck_on_implementation'
  | 'long_idle'
  | 'excessive_hints'
  | 'repeated_errors';

/** Dashboard stats time period. */
export type StatsPeriod = 'today' | 'last_week' | 'last_month' | 'all_time';

/** Issue suitability assessment. */
export type IssueSuitability = 'excellent' | 'good' | 'fair' | 'poor';

/** Issue difficulty assessment for scored issues. */
export type IssueDifficulty = 'low' | 'medium' | 'high' | 'very_high' | 'extreme';

// ── Dashboard / Landing Page Sub-Types ──────────────────────────────────────

/** Repository info returned by the repos:list flow. */
export interface RepoInfo {
  readonly fullName: string;
  readonly name: string;
  readonly owner: string;
  readonly description: string;
  readonly language: string;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;
  readonly openPRs: number;
  readonly license: string;
  readonly updatedAt: string;
  readonly pushedAt: string;
}

/** Single activity entry for a repository. */
export interface RepoActivityEntry {
  readonly timestamp: string;
  readonly activityType: string;
}

/** Issue label with name and color. */
export interface ScoredIssueLabel {
  readonly name: string;
  readonly color: string;
}

/** Issue author information. */
export interface ScoredIssueAuthor {
  readonly login: string;
  readonly avatarUrl: string;
}

/** Fully scored issue payload for the dashboard. */
export interface ScoredIssuePayload {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly summary: string;
  readonly difficulty: IssueDifficulty;
  readonly labels: readonly ScoredIssueLabel[];
  readonly author: ScoredIssueAuthor;
  readonly assignees: readonly ScoredIssueAuthor[];
  readonly commentCount: number;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly htmlUrl: string;
  readonly score: number;
}

/** PR status for the dashboard. */
export type PRStatus = 'open' | 'draft';

/** Item type discriminator for the in-progress panel. */
export type InProgressItemType = 'issue' | 'pr';

/** Unified in-progress item payload (issues + PRs). */
export interface InProgressItemPayload {
  readonly type: InProgressItemType;
  readonly number: number;
  readonly title: string;
  readonly labels: readonly ScoredIssueLabel[];
  readonly author: ScoredIssueAuthor;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly htmlUrl: string;
  readonly difficulty?: IssueDifficulty; // issue-specific
  readonly summary?: string; // issue-specific
  readonly prStatus?: PRStatus; // PR-specific
}

export interface DashboardInProgressItemData {
  readonly item: InProgressItemPayload;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DashboardInProgressCompleteData {}

// ── Client -> Server Message Data ───────────────────────────────────────────

export interface ConnectionHelloData {
  readonly version: string;
  readonly platform: string;
  readonly windowSize: {
    readonly width: number;
    readonly height: number;
  };
}

export interface FileOpenData {
  readonly path: string;
}

export interface FileSaveData {
  readonly path: string;
  readonly content: string;
}

export interface FileCloseData {
  readonly path: string;
}

export interface FileCreateData {
  readonly path: string;
}

export interface FileDeleteData {
  readonly path: string;
}

export interface BufferUpdateData {
  readonly path: string;
  readonly content: string;
  readonly cursorPosition: number;
  readonly selections: readonly SelectionRange[];
}

export interface EditorTabSwitchData {
  readonly fromPath: string;
  readonly toPath: string;
}

export interface EditorSelectionData {
  readonly path: string;
  readonly range: EditorRange;
  readonly selectedText: string;
}

export interface HintsLevelChangeData {
  readonly from: HintLevel;
  readonly to: HintLevel;
}

export interface UserIdleStartData {
  readonly durationMs: number;
}

export interface UserIdleEndData {
  readonly idleDurationMs: number;
}

export interface UserExplainData {
  readonly path: string;
  readonly range: LineRange;
  readonly text: string;
}

export interface ObserverMuteData {
  readonly muted: boolean;
}

export interface PracticeSubmitSolutionData {
  readonly kataId: number;
  readonly code: string;
  readonly activeConstraints: readonly string[];
}

export interface PracticeRequestHintData {
  readonly kataId: number;
}

export interface PracticeViewPreviousAttemptsData {
  readonly kataId: number;
}

export interface ChallengeLoadData {
  readonly kataId: number;
}

export interface ChallengeLoadedData {
  readonly kataId: number;
  readonly title: string;
  readonly description: string;
  readonly scaffoldingCode: string;
  readonly constraints: readonly { readonly id: string; readonly description: string }[];
}

export interface ChallengeLoadErrorData {
  readonly error: string;
}

export interface DashboardRequestData {
  readonly statsPeriod: StatsPeriod;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DashboardRefreshIssuesData {}

export interface DashboardResumeTaskData {
  readonly issueNumber: number;
}

export interface TerminalCommandData {
  readonly command: string;
}

export interface TerminalReadyData {
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalResizeData {
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalInputData {
  readonly data: string;
}

export interface TreeExpandData {
  readonly path: string;
}

export interface TreeCollapseData {
  readonly path: string;
}

// ── Review / Commit / PR / Git Data ─────────────────────────────────────

export type ReviewScope = 'phase' | 'current_file' | 'open_files' | 'current_task';

export type CodeCommentSeverity = 'suggestion' | 'issue' | 'praise';

export type ConventionalCommitType =
  | 'fix'
  | 'feat'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'test'
  | 'chore'
  | 'perf'
  | 'ci'
  | 'build';

export interface ReviewRequestData {
  readonly scope: ReviewScope;
  readonly activeFilePath?: string;
  readonly openFilePaths?: readonly string[];
}

export interface ReviewCodeComment {
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly comment: string;
  readonly severity: CodeCommentSeverity;
}

export interface ReviewTaskFeedback {
  readonly taskTitle: string;
  readonly feedback: string;
  readonly taskComplete: boolean;
}

export interface ReviewResultData {
  readonly overallFeedback: string;
  readonly codeComments: readonly ReviewCodeComment[];
  readonly taskFeedback?: readonly ReviewTaskFeedback[];
  readonly phaseComplete?: boolean;
}

export interface CommitSuggestData {
  readonly phaseNumber: number;
}

export interface CommitSuggestionData {
  readonly type: ConventionalCommitType;
  readonly subject: string;
  readonly body: string;
}

export interface CommitExecuteData {
  readonly type: ConventionalCommitType;
  readonly subject: string;
  readonly body: string;
}

export interface CommitErrorData {
  readonly error: string;
}

export interface PrSuggestData {
  readonly phaseNumber: number;
}

export interface PrSuggestionData {
  readonly title: string;
  readonly body: string;
}

export interface PrCreateData {
  readonly title: string;
  readonly body: string;
}

export interface PrCreatedData {
  readonly prUrl: string;
  readonly prNumber: number;
}

export interface PrErrorData {
  readonly error: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GitStatusRequestData {}

export interface GitStatusResultData {
  readonly clean: boolean;
  readonly modifiedFiles: readonly string[];
  readonly untrackedFiles: readonly string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GitSaveAndExitData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GitDiscardAndExitData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GitExitCompleteData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReposListRequestData {}

export interface ReposActivityRequestData {
  readonly repos: readonly string[];
}

export interface SessionStartRepoData {
  readonly owner: string;
  readonly repo: string;
}

export interface SessionSelectIssueWsData {
  readonly issueNumber: number;
}

// ── Planning Message Data ───────────────────────────────────────────────────

export interface PlanningStartedData {
  readonly sessionId: string;
  readonly issueTitle: string;
}

export interface PlanningProgressData {
  readonly message: string;
  readonly toolName?: string | undefined;
  readonly filePath?: string | undefined;
}

export type PlanningPhase = 'fetching' | 'exploring' | 'planning' | 'writing_hints';

export interface PlanningPhaseUpdateData {
  readonly phase: PlanningPhase;
  readonly progress: number;
}

export interface PlanTask {
  readonly title: string;
  readonly description: string;
  readonly targetFiles: readonly string[];
  readonly hints: {
    readonly low: string;
    readonly medium: string;
    readonly high: string;
  };
}

export interface PlanPhase {
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly hint: string;
  readonly status: 'pending' | 'active';
  readonly tasks: readonly PlanTask[];
}

export interface PlanningCompleteData {
  readonly sessionId: string;
  readonly repoPath: string;
  readonly plan: {
    readonly title: string;
    readonly summary: string;
    readonly phases: readonly PlanPhase[];
  };
  readonly fileTree: readonly TreeNode[];
  readonly fileHints: readonly {
    readonly path: string;
    readonly style: 'subtle' | 'obvious' | 'unmissable';
    readonly phase: number;
  }[];
  readonly issueContext: {
    readonly title: string;
    readonly number: number;
    readonly body: string;
    readonly labels: readonly string[];
    readonly url: string;
  };
}

export interface PlanningErrorData {
  readonly sessionId: string;
  readonly error: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FsRequestTreeData {}

// ── Server -> Client Message Data ───────────────────────────────────────────

export interface ConnectionInitData {
  readonly sessionId: string;
  readonly projectDir: string;
  readonly capabilities: {
    readonly chromadb_available: boolean;
    readonly github_api_available: boolean;
  };
  readonly featureFlags: {
    readonly observer_enabled: boolean;
    readonly practice_mode_enabled: boolean;
  };
}

export interface ConnectionErrorData {
  readonly code: ConnectionErrorCode;
  readonly message: string;
  readonly context?: Record<string, unknown> | undefined;
}

export interface FsContentData {
  readonly path: string;
  readonly content: string;
  readonly language: string;
  readonly lineCount: number;
}

export interface FsSaveAckData {
  readonly path: string;
  readonly success: boolean;
  readonly timestamp: string;
}

export interface FsSaveErrorData {
  readonly path: string;
  readonly error: string;
}

export interface FsTreeUpdateData {
  readonly action: FsTreeAction;
  readonly path: string;
  readonly newPath?: string | undefined;
}

export interface EditorOpenFileData {
  readonly path: string;
  readonly content: string;
  readonly language: string;
  readonly lineCount: number;
}

export interface EditorHighlightLinesData {
  readonly path: string;
  readonly ranges: readonly HighlightRange[];
}

export interface EditorClearHighlightsData {
  readonly path?: string | undefined;
}

export interface ExplorerHintFilesData {
  readonly paths: readonly string[];
  readonly style: ExplorerHintStyle;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExplorerClearHintsData {}

export interface CoachingPlanPhase {
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly hint_level: string;
}

export interface CoachingPlan {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly total_phases: number;
  readonly phases: readonly CoachingPlanPhase[];
}

export interface CoachingPlanReadyData {
  readonly plan: CoachingPlan;
}

export interface CoachingPhase {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly status: PhaseStatus;
  readonly started_at?: string | undefined;
  readonly completed_at?: string | undefined;
}

export interface CoachingPhaseUpdateData {
  readonly phase: CoachingPhase;
}

export interface CoachingMessageData {
  readonly message: string;
  readonly type: CoachingMessageType;
}

export interface CoachingIssueContextData {
  readonly title: string;
  readonly summary: string;
}

export interface ObserverStatusData {
  readonly active: boolean;
  readonly muted: boolean;
}

export interface ObserverNudgeData {
  readonly signal: NudgeSignal;
  readonly confidence: number;
  readonly context: string;
}

export interface ExplainResponseData {
  readonly explanation: string;
  readonly phaseConnection?: string | undefined;
}

export interface ExplainErrorData {
  readonly error: string;
}

export interface PracticeSolutionReviewData {
  readonly review: string;
  readonly level: number;
  readonly passed: boolean;
  readonly constraintsUnlocked: readonly string[];
}

export interface PracticeHintData {
  readonly hint: string;
}

export interface PracticeAttempt {
  readonly code: string;
  readonly review: string;
  readonly level: number;
  readonly passed: boolean;
  readonly constraints: readonly string[];
  readonly submitted_at: string;
}

export interface PracticePreviousAttemptsData {
  readonly attempts: readonly PracticeAttempt[];
}

export interface ReviewProgressData {
  readonly message: string;
  readonly toolName?: string | undefined;
  readonly filePath?: string | undefined;
}

export interface ReviewErrorData {
  readonly error: string;
}

export interface DreyfusAssessmentEntry {
  readonly skill_area: string;
  readonly stage: string;
  readonly confidence: number;
}

/** All 25 stat identifiers for the dashboard bento grid. */
export type StatId =
  | 'sessions'
  | 'total_time'
  | 'total_cost'
  | 'api_calls'
  | 'actions'
  | 'coaching_messages'
  | 'hint_level_breakdown'
  | 'issues_worked_on'
  | 'dreyfus_progression'
  | 'self_sufficiency'
  | 'questions_asked'
  | 'reviews_requested'
  | 'files_touched'
  | 'lines_changed'
  | 'issues_started'
  | 'avg_session_duration'
  | 'cost_per_session'
  | 'streak'
  | 'materials_viewed'
  | 'most_active_language'
  | 'token_efficiency'
  | 'kata_completion'
  | 'oldest_issue_closed'
  | 'youngest_issue_closed'
  | 'knowledge_gaps_closed';

/** Rich payload for a single stat in the dashboard. */
export interface StatPayload {
  readonly value: number | string;
  readonly change: number;
  readonly unit: 'count' | 'duration' | 'currency' | 'percentage' | 'text';
  readonly sparkline?: ReadonlyArray<{ x: string; y: number }>;
  readonly breakdown?: ReadonlyArray<{ label: string; value: number; color?: string }>;
  readonly pills?: ReadonlyArray<{ label: string; color: string; count: number }>;
  readonly progression?: ReadonlyArray<{ skill: string; level: string }>;
}

/** Map of stat IDs to their payloads. Partial because not all stats may be available. */
export type StatsData = Partial<Record<StatId, StatPayload>>;

/** Dashboard stats data with period context. */
export interface DashboardStatsData {
  readonly period: StatsPeriod;
  readonly stats: StatsData;
}

export interface DashboardStateData {
  readonly dreyfus: readonly DreyfusAssessmentEntry[];
  readonly stats: DashboardStatsData;
  readonly issues: readonly unknown[];
  readonly challenges: readonly unknown[];
  readonly learning_materials: readonly unknown[];
}

export interface DashboardIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly suitability: IssueSuitability;
  readonly recommended_focus: string;
  readonly labels: readonly string[];
}

export interface DashboardIssuesData {
  readonly issues: readonly DashboardIssue[];
}

export interface DashboardChallenge {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly attempts: number;
  readonly maxLevel: number;
  readonly gap: string;
}

export interface DashboardChallengesData {
  readonly challenges: readonly DashboardChallenge[];
}

export interface LearningResource {
  readonly title: string;
  readonly url: string;
  readonly description: string;
}

export interface LearningMaterialEntry {
  readonly gap: string;
  readonly resources: readonly LearningResource[];
}

export interface DashboardLearningMaterialsData {
  readonly materials: readonly LearningMaterialEntry[];
}

export interface DashboardIssuesErrorData {
  readonly error: string;
}

export interface SessionStartedData {
  readonly sessionId: number;
  readonly project_dir: string;
}

export interface SessionCompletedData {
  readonly memories_added: number;
  readonly gaps_identified: number;
  readonly katas_generated: number;
  readonly assessments_updated: number;
}

export interface ReposListResponseData {
  readonly repos: readonly RepoInfo[];
}

export interface RepoActivityResponseData {
  readonly repo: string;
  readonly activities: readonly RepoActivityEntry[];
}

export interface SessionRepoStartedData {
  readonly owner: string;
  readonly repo: string;
}

export interface SessionIssueSelectedResponseData {
  readonly sessionId: number;
  readonly issueNumber: number;
}

export interface DashboardSingleIssueData {
  readonly issue: ScoredIssuePayload;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DashboardIssuesCompleteData {}

// ── Client -> Server Messages (Discriminated Union) ─────────────────────────

export interface ConnectionHelloMessage {
  readonly type: 'connection:hello';
  readonly data: ConnectionHelloData;
}

export interface FileOpenMessage {
  readonly type: 'file:open';
  readonly data: FileOpenData;
}

export interface FileSaveMessage {
  readonly type: 'file:save';
  readonly data: FileSaveData;
}

export interface FileCloseMessage {
  readonly type: 'file:close';
  readonly data: FileCloseData;
}

export interface FileCreateMessage {
  readonly type: 'file:create';
  readonly data: FileCreateData;
}

export interface FileDeleteMessage {
  readonly type: 'file:delete';
  readonly data: FileDeleteData;
}

export interface BufferUpdateMessage {
  readonly type: 'buffer:update';
  readonly data: BufferUpdateData;
}

export interface EditorTabSwitchMessage {
  readonly type: 'editor:tab_switch';
  readonly data: EditorTabSwitchData;
}

export interface EditorSelectionMessage {
  readonly type: 'editor:selection';
  readonly data: EditorSelectionData;
}

export interface HintsLevelChangeMessage {
  readonly type: 'hints:level_change';
  readonly data: HintsLevelChangeData;
}

export interface UserIdleStartMessage {
  readonly type: 'user:idle_start';
  readonly data: UserIdleStartData;
}

export interface UserIdleEndMessage {
  readonly type: 'user:idle_end';
  readonly data: UserIdleEndData;
}

export interface UserExplainMessage {
  readonly type: 'user:explain';
  readonly data: UserExplainData;
}

export interface ObserverMuteMessage {
  readonly type: 'observer:mute';
  readonly data: ObserverMuteData;
}

export interface PracticeSubmitSolutionMessage {
  readonly type: 'practice:submit_solution';
  readonly data: PracticeSubmitSolutionData;
}

export interface PracticeRequestHintMessage {
  readonly type: 'practice:request_hint';
  readonly data: PracticeRequestHintData;
}

export interface PracticeViewPreviousAttemptsMessage {
  readonly type: 'practice:view_previous_attempts';
  readonly data: PracticeViewPreviousAttemptsData;
}

export interface ChallengeLoadMessage {
  readonly type: 'challenge:load';
  readonly data: ChallengeLoadData;
}

export interface DashboardRequestMessage {
  readonly type: 'dashboard:request';
  readonly data: DashboardRequestData;
}

export interface DashboardRefreshIssuesMessage {
  readonly type: 'dashboard:refresh_issues';
  readonly data: DashboardRefreshIssuesData;
}

export interface DashboardResumeTaskMessage {
  readonly type: 'dashboard:resume_task';
  readonly data: DashboardResumeTaskData;
}

export interface TerminalCommandMessage {
  readonly type: 'terminal:command';
  readonly data: TerminalCommandData;
}

export interface TerminalReadyMessage {
  readonly type: 'terminal:ready';
  readonly data: TerminalReadyData;
}

export interface TerminalResizeMessage {
  readonly type: 'terminal:resize';
  readonly data: TerminalResizeData;
}

export interface TerminalInputMessage {
  readonly type: 'terminal:input';
  readonly data: TerminalInputData;
}

export interface TreeExpandMessage {
  readonly type: 'tree:expand';
  readonly data: TreeExpandData;
}

export interface TreeCollapseMessage {
  readonly type: 'tree:collapse';
  readonly data: TreeCollapseData;
}

export interface ReviewRequestMessage {
  readonly type: 'review:request';
  readonly data: ReviewRequestData;
}

export interface ReposListRequestMessage {
  readonly type: 'repos:list';
  readonly data: ReposListRequestData;
}

export interface ReposActivityRequestMessage {
  readonly type: 'repos:activity';
  readonly data: ReposActivityRequestData;
}

export interface SessionStartRepoMessage {
  readonly type: 'session:start_repo';
  readonly data: SessionStartRepoData;
}

export interface SessionSelectIssueWsMessage {
  readonly type: 'session:select_issue';
  readonly data: SessionSelectIssueWsData;
}

export interface FsRequestTreeMessage {
  readonly type: 'fs:request_tree';
  readonly data: FsRequestTreeData;
}

export interface CommitSuggestMessage {
  readonly type: 'commit:suggest';
  readonly data: CommitSuggestData;
}

export interface CommitExecuteMessage {
  readonly type: 'commit:execute';
  readonly data: CommitExecuteData;
}

export interface PrSuggestMessage {
  readonly type: 'pr:suggest';
  readonly data: PrSuggestData;
}

export interface PrCreateMessage {
  readonly type: 'pr:create';
  readonly data: PrCreateData;
}

export interface GitStatusRequestMessage {
  readonly type: 'git:status';
  readonly data: GitStatusRequestData;
}

export interface GitSaveAndExitMessage {
  readonly type: 'git:save_and_exit';
  readonly data: GitSaveAndExitData;
}

export interface GitDiscardAndExitMessage {
  readonly type: 'git:discard_and_exit';
  readonly data: GitDiscardAndExitData;
}

/** Union of all client-to-server message types. */
export type ClientToServerMessage =
  | ConnectionHelloMessage
  | FileOpenMessage
  | FileSaveMessage
  | FileCloseMessage
  | FileCreateMessage
  | FileDeleteMessage
  | BufferUpdateMessage
  | EditorTabSwitchMessage
  | EditorSelectionMessage
  | HintsLevelChangeMessage
  | UserIdleStartMessage
  | UserIdleEndMessage
  | UserExplainMessage
  | ObserverMuteMessage
  | PracticeSubmitSolutionMessage
  | PracticeRequestHintMessage
  | PracticeViewPreviousAttemptsMessage
  | ChallengeLoadMessage
  | DashboardRequestMessage
  | DashboardRefreshIssuesMessage
  | DashboardResumeTaskMessage
  | TerminalCommandMessage
  | TerminalReadyMessage
  | TerminalResizeMessage
  | TerminalInputMessage
  | TreeExpandMessage
  | TreeCollapseMessage
  | ReviewRequestMessage
  | CommitSuggestMessage
  | CommitExecuteMessage
  | PrSuggestMessage
  | PrCreateMessage
  | GitStatusRequestMessage
  | GitSaveAndExitMessage
  | GitDiscardAndExitMessage
  | ReposListRequestMessage
  | ReposActivityRequestMessage
  | SessionStartRepoMessage
  | SessionSelectIssueWsMessage
  | FsRequestTreeMessage;

// ── Server -> Client Messages (Discriminated Union) ─────────────────────────

export interface ConnectionInitMessage {
  readonly type: 'connection:init';
  readonly data: ConnectionInitData;
}

export interface ConnectionErrorMessage {
  readonly type: 'connection:error';
  readonly data: ConnectionErrorData;
}

export interface FsContentMessage {
  readonly type: 'fs:content';
  readonly data: FsContentData;
}

export interface FsSaveAckMessage {
  readonly type: 'fs:save_ack';
  readonly data: FsSaveAckData;
}

export interface FsSaveErrorMessage {
  readonly type: 'fs:save_error';
  readonly data: FsSaveErrorData;
}

export interface FsTreeUpdateMessage {
  readonly type: 'fs:tree_update';
  readonly data: FsTreeUpdateData;
}

export interface EditorOpenFileMessage {
  readonly type: 'editor:open_file';
  readonly data: EditorOpenFileData;
}

export interface EditorHighlightLinesMessage {
  readonly type: 'editor:highlight_lines';
  readonly data: EditorHighlightLinesData;
}

export interface EditorClearHighlightsMessage {
  readonly type: 'editor:clear_highlights';
  readonly data: EditorClearHighlightsData;
}

export interface ExplorerHintFilesMessage {
  readonly type: 'explorer:hint_files';
  readonly data: ExplorerHintFilesData;
}

export interface ExplorerClearHintsMessage {
  readonly type: 'explorer:clear_hints';
  readonly data: ExplorerClearHintsData;
}

export interface CoachingPlanReadyMessage {
  readonly type: 'coaching:plan_ready';
  readonly data: CoachingPlanReadyData;
}

export interface CoachingPhaseUpdateMessage {
  readonly type: 'coaching:phase_update';
  readonly data: CoachingPhaseUpdateData;
}

export interface CoachingMessageMessage {
  readonly type: 'coaching:message';
  readonly data: CoachingMessageData;
}

export interface CoachingIssueContextMessage {
  readonly type: 'coaching:issue_context';
  readonly data: CoachingIssueContextData;
}

export interface ObserverStatusMessage {
  readonly type: 'observer:status';
  readonly data: ObserverStatusData;
}

export interface ObserverNudgeMessage {
  readonly type: 'observer:nudge';
  readonly data: ObserverNudgeData;
}

export interface ExplainResponseMessage {
  readonly type: 'explain:response';
  readonly data: ExplainResponseData;
}

export interface ExplainErrorMessage {
  readonly type: 'explain:error';
  readonly data: ExplainErrorData;
}

export interface PracticeSolutionReviewMessage {
  readonly type: 'practice:solution_review';
  readonly data: PracticeSolutionReviewData;
}

export interface PracticeHintMessage {
  readonly type: 'practice:hint';
  readonly data: PracticeHintData;
}

export interface PracticePreviousAttemptsMessage {
  readonly type: 'practice:previous_attempts';
  readonly data: PracticePreviousAttemptsData;
}

export interface ChallengeLoadedMessage {
  readonly type: 'challenge:loaded';
  readonly data: ChallengeLoadedData;
}

export interface ChallengeLoadErrorMessage {
  readonly type: 'challenge:load_error';
  readonly data: ChallengeLoadErrorData;
}

export interface ReviewProgressMessage {
  readonly type: 'review:progress';
  readonly data: ReviewProgressData;
}

export interface ReviewErrorMessage {
  readonly type: 'review:error';
  readonly data: ReviewErrorData;
}

export interface DashboardStateMessage {
  readonly type: 'dashboard:state';
  readonly data: DashboardStateData;
}

export interface DashboardIssuesMessage {
  readonly type: 'dashboard:issues';
  readonly data: DashboardIssuesData;
}

export interface DashboardChallengesMessage {
  readonly type: 'dashboard:challenges';
  readonly data: DashboardChallengesData;
}

export interface DashboardLearningMaterialsMessage {
  readonly type: 'dashboard:learning_materials';
  readonly data: DashboardLearningMaterialsData;
}

export interface DashboardIssuesErrorMessage {
  readonly type: 'dashboard:issues_error';
  readonly data: DashboardIssuesErrorData;
}

export interface SessionStartedMessage {
  readonly type: 'session:started';
  readonly data: SessionStartedData;
}

export interface SessionCompletedMessage {
  readonly type: 'session:completed';
  readonly data: SessionCompletedData;
}

export interface ReposListResponseMessage {
  readonly type: 'repos:list_response';
  readonly data: ReposListResponseData;
}

export interface RepoActivityResponseMessage {
  readonly type: 'repo:activity';
  readonly data: RepoActivityResponseData;
}

export interface SessionRepoStartedMessage {
  readonly type: 'session:repo_started';
  readonly data: SessionRepoStartedData;
}

export interface SessionIssueSelectedResponseMessage {
  readonly type: 'session:issue_selected';
  readonly data: SessionIssueSelectedResponseData;
}

export interface DashboardSingleIssueMessage {
  readonly type: 'dashboard:issue';
  readonly data: DashboardSingleIssueData;
}

export interface DashboardIssuesCompleteMessage {
  readonly type: 'dashboard:issues_complete';
  readonly data: DashboardIssuesCompleteData;
}

export interface DashboardInProgressItemMessage {
  readonly type: 'dashboard:in_progress_item';
  readonly data: DashboardInProgressItemData;
}

export interface DashboardInProgressCompleteMessage {
  readonly type: 'dashboard:in_progress_complete';
  readonly data: DashboardInProgressCompleteData;
}

export interface PlanningStartedMessage {
  readonly type: 'planning:started';
  readonly data: PlanningStartedData;
}

export interface PlanningProgressMessage {
  readonly type: 'planning:progress';
  readonly data: PlanningProgressData;
}

export interface PlanningPhaseUpdateMessage {
  readonly type: 'planning:phase_update';
  readonly data: PlanningPhaseUpdateData;
}

export interface PlanningCompleteMessage {
  readonly type: 'planning:complete';
  readonly data: PlanningCompleteData;
}

export interface PlanningErrorMessage {
  readonly type: 'planning:error';
  readonly data: PlanningErrorData;
}

export interface ReviewResultMessage {
  readonly type: 'review:result';
  readonly data: ReviewResultData;
}

export interface CommitSuggestionMessage {
  readonly type: 'commit:suggestion';
  readonly data: CommitSuggestionData;
}

export interface CommitErrorMessage {
  readonly type: 'commit:error';
  readonly data: CommitErrorData;
}

export interface PrSuggestionMessage {
  readonly type: 'pr:suggestion';
  readonly data: PrSuggestionData;
}

export interface PrCreatedMessage {
  readonly type: 'pr:created';
  readonly data: PrCreatedData;
}

export interface PrErrorMessage {
  readonly type: 'pr:error';
  readonly data: PrErrorData;
}

export interface GitStatusResultMessage {
  readonly type: 'git:status_result';
  readonly data: GitStatusResultData;
}

export interface GitExitCompleteMessage {
  readonly type: 'git:exit_complete';
  readonly data: GitExitCompleteData;
}

/** Union of all server-to-client message types. */
export type ServerToClientMessage =
  | ConnectionInitMessage
  | ConnectionErrorMessage
  | FsContentMessage
  | FsSaveAckMessage
  | FsSaveErrorMessage
  | FsTreeUpdateMessage
  | EditorOpenFileMessage
  | EditorHighlightLinesMessage
  | EditorClearHighlightsMessage
  | ExplorerHintFilesMessage
  | ExplorerClearHintsMessage
  | CoachingPlanReadyMessage
  | CoachingPhaseUpdateMessage
  | CoachingMessageMessage
  | CoachingIssueContextMessage
  | ObserverStatusMessage
  | ObserverNudgeMessage
  | ExplainResponseMessage
  | ExplainErrorMessage
  | PracticeSolutionReviewMessage
  | PracticeHintMessage
  | PracticePreviousAttemptsMessage
  | ChallengeLoadedMessage
  | ChallengeLoadErrorMessage
  | ReviewErrorMessage
  | DashboardStateMessage
  | DashboardIssuesMessage
  | DashboardChallengesMessage
  | DashboardLearningMaterialsMessage
  | DashboardIssuesErrorMessage
  | SessionStartedMessage
  | SessionCompletedMessage
  | ReposListResponseMessage
  | RepoActivityResponseMessage
  | SessionRepoStartedMessage
  | SessionIssueSelectedResponseMessage
  | DashboardSingleIssueMessage
  | DashboardIssuesCompleteMessage
  | DashboardInProgressItemMessage
  | DashboardInProgressCompleteMessage
  | PlanningStartedMessage
  | PlanningProgressMessage
  | PlanningPhaseUpdateMessage
  | PlanningCompleteMessage
  | PlanningErrorMessage
  | ReviewResultMessage
  | ReviewProgressMessage
  | CommitSuggestionMessage
  | CommitErrorMessage
  | PrSuggestionMessage
  | PrCreatedMessage
  | PrErrorMessage
  | GitStatusResultMessage
  | GitExitCompleteMessage;

// ── Combined Type ───────────────────────────────────────────────────────────

/** Any WebSocket message (client or server). */
export type WebSocketMessage = ClientToServerMessage | ServerToClientMessage;

// ── Type-Safe Message Type Literals ─────────────────────────────────────────

/** All valid client-to-server message type strings. */
export type ClientToServerMessageType = ClientToServerMessage['type'];

/** All valid server-to-client message type strings. */
export type ServerToClientMessageType = ServerToClientMessage['type'];

/** All valid WebSocket message type strings. */
export type WebSocketMessageType = WebSocketMessage['type'];

// ── Type-Safe Message Extraction ────────────────────────────────────────────

/**
 * Extract the data type for a specific message type string.
 *
 * Usage:
 *   type Data = MessageDataFor<"file:open">; // FileOpenData
 *   type Data = MessageDataFor<"connection:init">; // ConnectionInitData
 */
export type MessageDataFor<T extends WebSocketMessageType> = Extract<
  WebSocketMessage,
  { readonly type: T }
>['data'];

/**
 * Extract the full message type for a specific message type string.
 *
 * Usage:
 *   type Msg = MessageFor<"file:open">; // FileOpenMessage
 *   type Msg = MessageFor<"connection:init">; // ConnectionInitMessage
 */
export type MessageFor<T extends WebSocketMessageType> = Extract<
  WebSocketMessage,
  { readonly type: T }
>;

// ── Type-Safe Message Handler Map ───────────────────────────────────────────

/**
 * Maps each client-to-server message type to its handler function signature.
 * Useful for building type-safe WebSocket routers.
 *
 * Usage:
 *   const handlers: ClientMessageHandlers = {
 *     "file:open": (data) => { ... }, // data is FileOpenData
 *     "file:save": (data) => { ... }, // data is FileSaveData
 *     ...
 *   };
 */
export type ClientMessageHandlers = {
  readonly [T in ClientToServerMessageType]: (data: MessageDataFor<T>) => void | Promise<void>;
};

/**
 * Partial handler map for client-to-server messages.
 * Allows registering handlers for only a subset of message types.
 */
export type PartialClientMessageHandlers = {
  readonly [T in ClientToServerMessageType]?: (data: MessageDataFor<T>) => void | Promise<void>;
};
