# Data Model: Backend Server

**Feature**: Backend Server | **Date**: 2026-02-11

## Entity Relationship Diagram

```
sessions ──< plans ──< phases ──< phase_hints
                              ──< progress_events
sessions ──< knowledge_gaps ──< kata_specs
sessions ──< action_log
sessions ──< api_call_log
sessions ──< session_wrap_up_errors
dreyfus_assessments (global, no FK)
```

---

## Core Entities

### 1. Session

**Purpose**: Represents a coaching session tied to a GitHub issue.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique session ID |
| `project_dir` | TEXT | NOT NULL | Absolute path to project directory |
| `issue_number` | INTEGER | NULL | GitHub issue number (if applicable) |
| `issue_title` | TEXT | NULL | GitHub issue title |
| `status` | TEXT | NOT NULL, CHECK (status IN ('active', 'completed')) | Session status |
| `started_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `ended_at` | TEXT | NULL | ISO 8601 timestamp (NULL if active) |

**Validation Rules**:
- Only one session can have `status = 'active'` at a time
- `ended_at` must be NULL when `status = 'active'`
- `ended_at` must be NOT NULL when `status = 'completed'`
- `project_dir` must resolve to an existing directory

**State Transitions**:
```
[NEW] → active → completed
```

**Relationships**:
- One session has many plans
- One session has many knowledge gaps
- One session has many action log entries
- One session has many API call log entries

---

### 2. Plan

**Purpose**: A structured, multi-phase coaching plan generated from an issue.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique plan ID |
| `session_id` | INTEGER | NOT NULL, FK(sessions.id) | Parent session |
| `title` | TEXT | NOT NULL | Plan title (from Coach Agent) |
| `description` | TEXT | NOT NULL | Plan description |
| `total_phases` | INTEGER | NOT NULL | Number of phases |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | Boolean: 1 = active, 0 = inactive |

**Validation Rules**:
- Only one plan per session can have `is_active = 1`
- `total_phases` must match the count of phases for this plan
- When a new plan is created for a session, previous plans must be marked `is_active = 0`

**Relationships**:
- One plan belongs to one session
- One plan has many phases

---

### 3. Phase

**Purpose**: A discrete coaching step with hints, expected files, and status tracking.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique phase ID |
| `plan_id` | INTEGER | NOT NULL, FK(plans.id) | Parent plan |
| `number` | INTEGER | NOT NULL | Phase number (1-indexed) |
| `title` | TEXT | NOT NULL | Phase title |
| `description` | TEXT | NOT NULL | Phase description |
| `hint_level` | TEXT | NOT NULL, CHECK (hint_level IN ('off', 'low', 'medium', 'high')) | Current hint level |
| `status` | TEXT | NOT NULL, CHECK (status IN ('pending', 'active', 'complete')) | Phase status |
| `started_at` | TEXT | NULL | ISO 8601 timestamp |
| `completed_at` | TEXT | NULL | ISO 8601 timestamp |

**Validation Rules**:
- `(plan_id, number)` must be UNIQUE
- Only one phase per plan can have `status = 'active'` at a time
- `hint_level` determines which hints are displayed in Electron
- `started_at` must be NULL when `status = 'pending'`
- `completed_at` must be NULL when `status != 'complete'`

**State Transitions**:
```
pending → active → complete
```

**Relationships**:
- One phase belongs to one plan
- One phase has many hints
- One phase has many progress events

---

### 4. Phase Hint

**Purpose**: Visual cues in Electron (file decorations, line highlights).

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique hint ID |
| `phase_id` | INTEGER | NOT NULL, FK(phases.id) | Parent phase |
| `type` | TEXT | NOT NULL, CHECK (type IN ('file', 'line')) | Hint type |
| `path` | TEXT | NOT NULL | File path (relative to PROJECT_DIR) |
| `line_start` | INTEGER | NULL | Start line (1-indexed, NULL for file hints) |
| `line_end` | INTEGER | NULL | End line (1-indexed, inclusive, NULL for file hints) |
| `style` | TEXT | NOT NULL, CHECK (style IN ('suggested', 'warning', 'error')) | Visual style |
| `hover_text` | TEXT | NULL | Tooltip text (optional) |
| `required_level` | TEXT | NOT NULL, CHECK (required_level IN ('low', 'medium', 'high')) | Minimum hint level to display |

**Validation Rules**:
- If `type = 'file'`, then `line_start` and `line_end` must be NULL
- If `type = 'line'`, then `line_start` must be NOT NULL
- If `line_end` is set, then `line_end >= line_start`
- Hints are displayed only if `phase.hint_level >= required_level` (low < medium < high)

**Relationships**:
- One hint belongs to one phase

---

### 5. Progress Event

**Purpose**: Timeline of phase-level events (hint usage, escalations, reviews).

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique event ID |
| `phase_id` | INTEGER | NOT NULL, FK(phases.id) | Parent phase |
| `event_type` | TEXT | NOT NULL | Event type (see catalog below) |
| `data` | TEXT | NULL | JSON metadata (optional) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Event Types Catalog**:
- `hint_used`: User requested a hint
- `hint_escalated`: Hint level increased (data: `{ from: 'low', to: 'medium' }`)
- `review_requested`: User requested code review
- `review_passed`: Review completed successfully
- `review_failed`: Review failed with feedback (data: `{ feedback: string }`)

**Data Field JSON Schemas** (by event type):
```json
{
  "hint_used": {
    "hint_id": "uuid",
    "hint_level": "low" | "medium" | "high",
    "path": "string"
  },
  "hint_escalated": {
    "from_level": "off" | "low" | "medium" | "high",
    "to_level": "low" | "medium" | "high",
    "phase_id": "integer"
  },
  "review_requested": {
    "context": "string | null",
    "phase_id": "integer | null"
  },
  "review_passed": {
    "review_score": "number (0-10)",
    "feedback_summary": "string"
  },
  "review_failed": {
    "feedback": "string",
    "issues_count": "number"
  }
}
```

**Validation Rules**:
- `event_type` must be from the catalog above
- `data` must be valid JSON if present
- `data` schema must match the event type (validated at insert time)

**Relationships**:
- One event belongs to one phase

---

### 6. Dreyfus Assessment

**Purpose**: Global skill level tracking (Novice → Expert) per skill area.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique assessment ID |
| `skill_area` | TEXT | NOT NULL, UNIQUE | Skill domain (e.g., "React state management") |
| `stage` | TEXT | NOT NULL, CHECK (stage IN ('Novice', 'Advanced Beginner', 'Competent', 'Proficient', 'Expert')) | Dreyfus stage |
| `confidence` | REAL | NOT NULL, CHECK (confidence >= 0.0 AND confidence <= 1.0) | Confidence score (0.0 - 1.0) |
| `evidence` | TEXT | NOT NULL | Evidence from session behavior |
| `assessed_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Validation Rules**:
- `skill_area` is UNIQUE (updating overwrites existing assessment)
- `stage` progression: Novice → Advanced Beginner → Competent → Proficient → Expert
- `confidence` must be between 0.0 and 1.0

**Relationships**:
- Global table (no foreign keys)
- Assessments are referenced by coaching pipeline and UI-driven APIs

---

### 7. Knowledge Gap

**Purpose**: Topics where user struggled, with severity and evidence.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique gap ID |
| `session_id` | INTEGER | NOT NULL, FK(sessions.id) | Parent session |
| `topic` | TEXT | NOT NULL | Gap topic (e.g., "async/await error handling") |
| `severity` | TEXT | NOT NULL, CHECK (severity IN ('low', 'medium', 'high')) | Severity level |
| `evidence` | TEXT | NOT NULL | Evidence from session |
| `related_concepts` | TEXT | NOT NULL | JSON array of related concepts |
| `addressed` | INTEGER | NOT NULL DEFAULT 0 | Boolean: 0 = unaddressed, 1 = addressed |
| `identified_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Validation Rules**:
- `related_concepts` must be valid JSON array (e.g., `["promises", "try-catch", "error propagation"]`)
- `addressed` is set to 1 when user completes related kata or receives targeted coaching

**Relationships**:
- One gap belongs to one session
- One gap can have many kata specs

---

### 8. Kata Spec

**Purpose**: Practice exercises generated from knowledge gaps with progressive constraints.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique kata ID |
| `gap_id` | INTEGER | NOT NULL, FK(knowledge_gaps.id) | Parent knowledge gap |
| `title` | TEXT | NOT NULL | Kata title |
| `description` | TEXT | NOT NULL | Kata description |
| `scaffolding_code` | TEXT | NOT NULL | Starter code template |
| `instructor_notes` | TEXT | NOT NULL | Guidance for Paige when reviewing |
| `constraints` | TEXT | NOT NULL | JSON array of constraint objects |
| `user_attempts` | TEXT | NOT NULL DEFAULT '[]' | JSON array of attempt objects |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**JSON Schemas**:

**Constraints** (array of objects):
```json
[
  {
    "id": "no-libraries",
    "description": "No external libraries",
    "minLevel": 1
  },
  {
    "id": "error-handling",
    "description": "Must handle all edge cases",
    "minLevel": 3
  },
  {
    "id": "performance",
    "description": "O(n) time complexity required",
    "minLevel": 5
  }
]
```

**User Attempts** (array of objects):
```json
[
  {
    "code": "...",
    "review": "Good error handling, but...",
    "level": 3,
    "passed": true,
    "constraints": ["no-libraries", "error-handling"],
    "submitted_at": "2026-02-11T10:30:00Z"
  }
]
```

**Validation Rules**:
- `constraints` must be valid JSON array
- `user_attempts` must be valid JSON array
- Constraints unlock based on max level achieved across all attempts

**Constraint Unlocking**:
- User starts with all constraints having `minLevel = 1`
- When Sonnet assigns `level = N` to an attempt, constraints with `minLevel <= N` unlock for future attempts
- Constraint unlocking is per-kata (not global)

**Relationships**:
- One kata belongs to one knowledge gap

---

### 9. Action Log

**Purpose**: Timeline of all user actions and system events for observability.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique log entry ID |
| `session_id` | INTEGER | NOT NULL, FK(sessions.id) | Parent session |
| `action_type` | TEXT | NOT NULL | Action type (see catalog below) |
| `data` | TEXT | NULL | JSON metadata (optional) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Action Types Catalog** (27 types):

**File Operations**:
- `file_open`: User opened a file (data: `{ path }`)
- `file_save`: User saved a file (data: `{ path, charCount }`)
- `file_close`: User closed a file (data: `{ path }`)
- `file_create`: User created a new file (data: `{ path }`)
- `file_delete`: User deleted a file (data: `{ path }`)

**Editor Actions**:
- `editor_tab_switch`: User switched tabs (data: `{ fromPath, toPath }`)
- `editor_selection`: User selected text (data: `{ path, range }`)

**Buffer Updates**:
- `buffer_summary`: Periodic buffer state snapshot (data: `{ path, charCount, dirty }`)
- `buffer_significant_change`: Large edit detected (data: `{ path, charDelta, percentDelta }`)

**Coaching Actions**:
- `coaching_pipeline_run`: Pipeline executed (data: `{ planId }`)
- `coaching_message`: Message shown to user (data: `{ message, type }`)
- `phase_started`: Phase began (data: `{ phaseId, phaseNumber }`)
- `phase_completed`: Phase finished (data: `{ phaseId, phaseNumber }`)
- `hints_level_change`: Hint level changed (data: `{ phaseId, from, to }`)
- `decorations_applied`: Highlights applied (data: `{ path, lineCount }`)
- `file_hints_applied`: File hints applied (data: `{ paths, style }`)

**User Interactions**:
- `user_idle_start`: User went idle (data: `{ durationMs }`)
- `user_idle_end`: User returned (data: `{ idleDurationMs }`)
- `user_explain_request`: "Explain This" clicked (data: `{ path, range }`)

**Observer Actions**:
- `observer_triage`: Triage evaluation occurred (data: `{ shouldNudge, confidence, signal }`)
- `nudge_sent`: Nudge delivered to PTY (data: `{ signal, confidence }`)
- `nudge_suppressed`: Nudge blocked (data: `{ reason }`)

**Nudge Suppression Reasons** (enum for `nudge_suppressed.data.reason`):
- `"cooldown"`: Nudge sent in last 120 seconds
- `"low_confidence"`: Haiku confidence < 0.7 threshold
- `"flow_state"`: >10 actions in last 60 seconds (user in flow)
- `"muted"`: Observer manually muted via WebSocket

**MCP Actions**:
- `mcp_tool_call`: MCP tool invoked (data: `{ toolName, args }`)

**Practice Actions**:
- `practice_solution_submitted`: Kata solution submitted (data: `{ kataId, constraintsActive }`)
- `practice_solution_reviewed`: Kata review completed (data: `{ kataId, level, passed }`)

**Dashboard Actions**:
- `dashboard_loaded`: Dashboard data assembled (data: `{ flowsCompleted }`)

**Session Lifecycle**:
- `session_started`: Session created (data: `{ issueNumber, issueTitle }`)
- `session_ended`: Session completed (data: `{ duration, actions, apiCalls }`)

**Validation Rules**:
- `action_type` must be from the catalog above
- `data` must be valid JSON if present

**Query Patterns**:
- Recent actions for Observer: `SELECT * FROM action_log WHERE session_id = ? ORDER BY created_at DESC LIMIT N`
- Actions by type: `SELECT * FROM action_log WHERE session_id = ? AND action_type = ?`
- Time-since-last: `SELECT created_at FROM action_log WHERE session_id = ? AND action_type = ? ORDER BY created_at DESC LIMIT 1`

**Relationships**:
- One action log entry belongs to one session

---

### 10. API Call Log

**Purpose**: Cost tracking and metadata for all Claude API calls.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique call ID |
| `session_id` | INTEGER | NOT NULL, FK(sessions.id) | Parent session |
| `call_type` | TEXT | NOT NULL | Call purpose (see catalog below) |
| `model` | TEXT | NOT NULL | Model ID used |
| `input_hash` | TEXT | NULL | SHA256 hash of input (for deduplication) |
| `latency_ms` | INTEGER | NOT NULL | Latency in milliseconds (-1 if failed) |
| `input_tokens` | INTEGER | NOT NULL | Input token count (0 if failed) |
| `output_tokens` | INTEGER | NOT NULL | Output token count (0 if failed) |
| `cost_estimate` | REAL | NOT NULL | Estimated cost in USD (0 if failed) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Call Types Catalog**:
- `coach_agent`: Issue → Plan transformation
- `reflection_agent`: Session → Memories
- `knowledge_gap_agent`: Session → Gaps + Katas
- `dreyfus_agent`: Session → Assessments
- `triage_model`: Observer triage evaluation
- `explain_this`: User-requested code explanation
- `practice_review`: Kata solution review
- `issue_suitability`: Dashboard issue assessment

**Validation Rules**:
- `latency_ms = -1` indicates failure (tokens and cost are 0)
- `cost_estimate` is calculated from tokens × pricing table
- `input_hash` enables deduplication analysis (optional)

**Aggregation Queries**:
- Total cost: `SELECT SUM(cost_estimate) FROM api_call_log WHERE session_id = ?`
- Cost by model: `SELECT model, SUM(cost_estimate) FROM api_call_log WHERE session_id = ? GROUP BY model`
- Average latency: `SELECT AVG(latency_ms) FROM api_call_log WHERE session_id = ? AND latency_ms > 0`

**Relationships**:
- One API call log entry belongs to one session

---

### 11. Session Wrap-Up Errors

**Purpose**: Tracks failures in session wrap-up agents (Reflection, Knowledge Gap, Dreyfus) for recovery.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique error ID |
| `session_id` | INTEGER | NOT NULL, FK(sessions.id) | Parent session |
| `agent_name` | TEXT | NOT NULL, CHECK (agent_name IN ('reflection', 'knowledge_gap', 'dreyfus')) | Which wrap-up agent failed |
| `error_message` | TEXT | NOT NULL | Error details for debugging |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Validation Rules**:
- `agent_name` must be one of the three wrap-up agents
- Multiple errors per session are allowed (agents can fail independently)

**Recovery Patterns**:
- Dashboard displays warning: "Session completed with errors. [Retry]"
- MCP tool `paige_retry_wrap_up({ sessionId, agent? })` re-runs failed agents
- If agent succeeds on retry, error row is retained for audit

**Relationships**:
- One error entry belongs to one session

---

## Indexes

**Performance Optimization**:

```sql
-- Session lookups
CREATE INDEX idx_sessions_status ON sessions(status);

-- Plan lookups
CREATE INDEX idx_plans_session_id ON plans(session_id);
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- Phase lookups
CREATE INDEX idx_phases_plan_id ON phases(plan_id);
CREATE INDEX idx_phases_status ON phases(status);

-- Hint lookups
CREATE INDEX idx_phase_hints_phase_id ON phase_hints(phase_id);

-- Progress event lookups
CREATE INDEX idx_progress_events_phase_id ON progress_events(phase_id);

-- Knowledge gap lookups
CREATE INDEX idx_knowledge_gaps_session_id ON knowledge_gaps(session_id);
CREATE INDEX idx_knowledge_gaps_addressed ON knowledge_gaps(addressed);

-- Kata spec lookups
CREATE INDEX idx_kata_specs_gap_id ON kata_specs(gap_id);

-- Action log lookups (most critical for Observer)
CREATE INDEX idx_action_log_session_id ON action_log(session_id);
CREATE INDEX idx_action_log_created_at ON action_log(created_at);
CREATE INDEX idx_action_log_type ON action_log(action_type);

-- API call log lookups
CREATE INDEX idx_api_call_log_session_id ON api_call_log(session_id);

-- Wrap-up error lookups
CREATE INDEX idx_wrap_up_errors_session_id ON session_wrap_up_errors(session_id);
```

---

## Summary

- **11 tables** with clear foreign key relationships
- **Session** is the top-level entity (everything links to a session except Dreyfus)
- **Plans** support versioning with `is_active` boolean (multiple plans per session)
- **Phases** use hint levels ("off", "low", "medium", "high") for progressive disclosure
- **Kata Specs** use constraint unlocking based on user level progression
- **Action Log** captures 27 event types for observability and Observer intelligence
- **API Call Log** enables cost tracking and budget analysis
- **Wrap-Up Errors** tracks session end agent failures for recovery

**Ready for contract generation** (MCP tools, WebSocket messages).
