/**
 * Entity type definitions for the Paige Electron UI.
 * Matches the data model defined in specs/001-electron-ui/data-model.md.
 * All types are named exports — no default export.
 */

// Phase step sub-entity
export interface PhaseStep {
  title: string;
  description?: string;
}

// Coaching progression stage
export interface Phase {
  number: 1 | 2 | 3 | 4 | 5;
  title: string;
  status: 'pending' | 'active' | 'complete';
  summary?: string;
  steps?: PhaseStep[];
}

// Issue label
export interface IssueLabel {
  name: string;
  color: string; // hex color e.g. '#d97757'
}

// GitHub issue metadata
export interface IssueContext {
  number: number;
  title: string;
  summary?: string; // AI-generated, max 250 chars
  labels?: IssueLabel[];
  url: string;
}

// Code anchor for coaching messages
export interface CodeAnchor {
  path: string;
  startLine: number; // 1-indexed
  startColumn: number; // 1-indexed
  endLine: number;
  endColumn: number;
}

// Code range (used by decorations and review comments)
export interface CodeRange {
  startLine: number; // 1-indexed
  startColumn: number; // 1-indexed
  endLine: number;
  endColumn: number;
}

// Coaching message types
export type CoachingMessageType = 'hint' | 'info' | 'success' | 'warning';
export type CoachingSource = 'coaching' | 'explain' | 'observer';

// Coaching hint/guidance
export interface CoachingMessage {
  messageId: string; // UUID
  message: string;
  type: CoachingMessageType;
  anchor?: CodeAnchor;
  source: CoachingSource;
}

// Monaco decoration types
export type DecorationType = 'line-highlight' | 'gutter-marker' | 'squiggly';
export type DecorationStyle = 'hint' | 'error' | 'warning' | 'success';

// Editor decoration
export interface EditorDecoration {
  id: string;
  type: DecorationType;
  range: CodeRange;
  message?: string;
  style: DecorationStyle;
  level: 0 | 1 | 2 | 3;
}

// Explorer hint styles
export type ExplorerHintStyle = 'subtle' | 'obvious' | 'unmissable';

// File tree glow hint
export interface ExplorerHint {
  path: string;
  style: ExplorerHintStyle;
  directories?: string[];
}

// File tree node
export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

// Cursor position
export interface CursorPosition {
  line: number; // 1-indexed
  column: number; // 1-indexed
}

// Editor tab state
export interface TabState {
  path: string;
  language: string;
  isDirty: boolean;
  icon: string;
  cursorPosition?: CursorPosition;
}

// Hint level type
export type HintLevel = 0 | 1 | 2 | 3;

// App view type
export type AppView = 'dashboard' | 'ide' | 'placeholder';

// Global session state
export interface SessionState {
  sessionId: string;
  issueContext: IssueContext;
  phases: Phase[];
  currentView: AppView;
  openTabs: TabState[];
  activeTabPath?: string;
  hintLevel: HintLevel;
}

// Review comment for navigation
export interface ReviewComment {
  messageId: string;
  path: string;
  range: CodeRange;
  message: string;
  type: CoachingMessageType;
}
