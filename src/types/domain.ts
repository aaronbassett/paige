// Core domain types for the Paige backend server
// Derived from specs/002-backend-server/data-model.md

// ── Session ──────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'completed';

export interface Session {
  id: number;
  project_dir: string;
  issue_number: number | null;
  issue_title: string | null;
  status: SessionStatus;
  started_at: string; // ISO 8601
  ended_at: string | null; // ISO 8601, null if active
}

// ── Plan ─────────────────────────────────────────────────────────────────────

export interface Plan {
  id: number;
  session_id: number;
  title: string;
  description: string;
  total_phases: number;
  created_at: string; // ISO 8601
  is_active: number; // 1 = active, 0 = inactive (SQLite boolean)
}

// ── Phase ────────────────────────────────────────────────────────────────────

export type HintLevel = 'off' | 'low' | 'medium' | 'high';
export type PhaseStatus = 'pending' | 'active' | 'complete';

export interface Phase {
  id: number;
  plan_id: number;
  number: number; // 1-indexed
  title: string;
  description: string;
  hint_level: HintLevel;
  status: PhaseStatus;
  started_at: string | null; // ISO 8601
  completed_at: string | null; // ISO 8601
}

// ── Phase Hint ───────────────────────────────────────────────────────────────

export type HintType = 'file' | 'line';
export type HintStyle = 'suggested' | 'warning' | 'error';
export type HintRequiredLevel = 'low' | 'medium' | 'high';

export interface PhaseHint {
  id: number;
  phase_id: number;
  type: HintType;
  path: string; // relative to PROJECT_DIR
  line_start: number | null; // 1-indexed, null for file hints
  line_end: number | null; // 1-indexed, inclusive, null for file hints
  style: HintStyle;
  hover_text: string | null;
  required_level: HintRequiredLevel;
}

// ── Progress Event ───────────────────────────────────────────────────────────

export type ProgressEventType =
  | 'hint_used'
  | 'hint_escalated'
  | 'review_requested'
  | 'review_passed'
  | 'review_failed';

export interface ProgressEvent {
  id: number;
  phase_id: number;
  event_type: ProgressEventType;
  data: string | null; // JSON metadata
  created_at: string; // ISO 8601
}

// ── Dreyfus Assessment ───────────────────────────────────────────────────────

export type DreyfusStage = 'Novice' | 'Advanced Beginner' | 'Competent' | 'Proficient' | 'Expert';

export interface DreyfusAssessment {
  id: number;
  skill_area: string; // UNIQUE
  stage: DreyfusStage;
  confidence: number; // 0.0 - 1.0
  evidence: string;
  assessed_at: string; // ISO 8601
}

// ── Knowledge Gap ────────────────────────────────────────────────────────────

export type GapSeverity = 'low' | 'medium' | 'high';

export interface KnowledgeGap {
  id: number;
  session_id: number;
  topic: string;
  severity: GapSeverity;
  evidence: string;
  related_concepts: string; // JSON array
  addressed: number; // 0 = unaddressed, 1 = addressed (SQLite boolean)
  identified_at: string; // ISO 8601
}

// ── Kata Spec ────────────────────────────────────────────────────────────────

export interface KataConstraint {
  id: string;
  description: string;
  minLevel: number;
}

export interface KataAttempt {
  code: string;
  review: string;
  level: number;
  passed: boolean;
  constraints: string[];
  submitted_at: string; // ISO 8601
}

export interface KataSpec {
  id: number;
  gap_id: number;
  title: string;
  description: string;
  scaffolding_code: string;
  instructor_notes: string;
  constraints: string; // JSON array of KataConstraint
  user_attempts: string; // JSON array of KataAttempt
  created_at: string; // ISO 8601
}

// ── Action Log ───────────────────────────────────────────────────────────────

export type ActionType =
  // File Operations
  | 'file_open'
  | 'file_save'
  | 'file_close'
  | 'file_create'
  | 'file_delete'
  // Editor Actions
  | 'editor_tab_switch'
  | 'editor_selection'
  // Buffer Updates
  | 'buffer_summary'
  | 'buffer_significant_change'
  // Coaching Actions
  | 'coaching_pipeline_run'
  | 'coaching_message'
  | 'phase_started'
  | 'phase_completed'
  | 'hints_level_change'
  | 'decorations_applied'
  | 'file_hints_applied'
  // User Interactions
  | 'user_idle_start'
  | 'user_idle_end'
  | 'user_explain_request'
  // Observer Actions
  | 'observer_triage'
  | 'nudge_sent'
  | 'nudge_suppressed'
  // MCP Actions
  | 'mcp_tool_call'
  // Practice Actions
  | 'practice_solution_submitted'
  | 'practice_solution_reviewed'
  // Dashboard Actions
  | 'dashboard_loaded'
  // Session Lifecycle
  | 'session_started'
  | 'session_ended';

export interface ActionLogEntry {
  id: number;
  session_id: number;
  action_type: ActionType;
  data: string | null; // JSON metadata
  created_at: string; // ISO 8601
}

// ── API Call Log ─────────────────────────────────────────────────────────────

export type ApiCallType =
  | 'coach_agent'
  | 'reflection_agent'
  | 'knowledge_gap_agent'
  | 'dreyfus_agent'
  | 'triage_model'
  | 'explain_this'
  | 'practice_review'
  | 'issue_suitability'
  | 'issue_summary';

export interface ApiCallLogEntry {
  id: number;
  session_id: number;
  call_type: ApiCallType;
  model: string;
  input_hash: string | null; // SHA256
  latency_ms: number; // -1 if failed
  input_tokens: number; // 0 if failed
  output_tokens: number; // 0 if failed
  cost_estimate: number; // USD, 0 if failed
  created_at: string; // ISO 8601
}

// ── Session Wrap-Up Errors ───────────────────────────────────────────────────

export type WrapUpAgentName = 'reflection' | 'knowledge_gap' | 'dreyfus';

export interface SessionWrapUpError {
  id: number;
  session_id: number;
  agent_name: WrapUpAgentName;
  error_message: string;
  created_at: string; // ISO 8601
}

// ── Nudge Suppression ────────────────────────────────────────────────────────

export type NudgeSuppressionReason = 'cooldown' | 'low_confidence' | 'flow_state' | 'muted';

// ── Database Table Types (for Kysely) ────────────────────────────────────────

export interface DatabaseTables {
  sessions: Session;
  plans: Plan;
  phases: Phase;
  phase_hints: PhaseHint;
  progress_events: ProgressEvent;
  dreyfus_assessments: DreyfusAssessment;
  knowledge_gaps: KnowledgeGap;
  kata_specs: KataSpec;
  action_log: ActionLogEntry;
  api_call_log: ApiCallLogEntry;
  session_wrap_up_errors: SessionWrapUpError;
}
