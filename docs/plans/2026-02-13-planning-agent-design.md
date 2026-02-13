# Planning Agent & Loading Screen Design

## Problem

When a user selects a GitHub issue on the dashboard and clicks "Work on this", they need to wait while the system analyzes the codebase and builds an implementation plan. Currently there is no loading screen or planning pipeline connecting issue selection to the IDE view.

## Solution

Use the Claude Agent SDK (Opus 4.6) on the backend to autonomously explore the codebase, understand the issue, and produce a structured implementation plan with phases, tasks, and multi-level hints. Stream progress to a loading screen in real-time. When complete, transition to the IDE with all data pre-loaded.

## Architecture

```
Dashboard                    Backend                         Electron
   |                           |                               |
   |--session:select_issue---->|                                |
   |                           |-- create session (SQLite)      |
   |                           |-- fetch issue (GitHub API)     |
   |                           |-- start Agent SDK query()      |
   |<--planning:started--------|----planning:started----------->|
   |                           |                                |
   |  (transition to loader)   |   Agent reads files...         |
   |                           |----planning:progress---------->|
   |                           |   Agent analyzes...            |
   |                           |----planning:phase_update------>|
   |                           |   Agent builds plan...         |
   |                           |----planning:phase_update------>|
   |                           |                                |
   |                           |-- parse JSON, store in SQLite  |
   |                           |-- build IDE payload            |
   |                           |----planning:complete---------->|
   |                           |                                |
   |                           |         Loader --> IDE          |
```

## Planning Agent

**Module:** `backend-server/src/planning/agent.ts`

**SDK configuration:**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const planStream = query({
  prompt: buildPlanningPrompt(issue, repoPath),
  options: {
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "bypassPermissions",
    cwd: repoPath,
    model: "claude-opus-4-6",
  }
});
```

**Key decisions:**
- Opus 4.6 for plan quality (this is the primary coaching artifact)
- Read-only tools only — agent never modifies files
- `bypassPermissions` is safe because all tools are read-only
- `cwd` set to the cloned repo directory

**System prompt instructs the agent to:**
1. Read the GitHub issue details (provided in the user prompt)
2. Explore the codebase architecture (package.json, directory structure, key files)
3. Identify all files relevant to implementing the issue
4. Create a phased implementation plan broken into tasks
5. Write multi-level hints for each task (low/medium/high detail)
6. Output structured JSON as the final response

**Output schema:**

```typescript
interface AgentPlanOutput {
  title: string;
  summary: string;
  relevant_files: string[];
  phases: Array<{
    number: number;
    title: string;
    description: string;
    hint: string;
    tasks: Array<{
      title: string;
      description: string;
      target_files: string[];
      hints: {
        low: string;
        medium: string;
        high: string;
      };
    }>;
  }>;
}
```

Validated with Zod on the backend before storage.

**Progress streaming:** Each `SDKMessage` with tool_use info is forwarded to Electron as a `planning:progress` WebSocket message. Tool names are mapped to human-readable descriptions ("Reading package.json...", "Searching for route definitions...").

## Nudge Agent

Replaces the existing Observer → terminal nudge flow with Agent SDK-generated coaching messages pushed to the Electron UI.

**Module:** `backend-server/src/planning/nudge-agent.ts`

**SDK configuration:**

```typescript
const nudgeStream = query({
  prompt: buildNudgePrompt(sessionState, currentPhase, userActivity),
  options: {
    allowedTools: ["Read"],
    permissionMode: "bypassPermissions",
    cwd: repoPath,
    model: "claude-haiku-4-5-20251001",
    maxTurns: 2,
  }
});
```

**Key decisions:**
- Haiku 4.5 for speed and cost (nudges should be fast and cheap)
- `maxTurns: 2` keeps responses brief
- Can read the user's current file for context
- Existing Observer debouncing (5s idle, mute) prevents runaway calls

**Flow:** Observer detects nudge-worthy event → calls nudge agent → result sent as `coaching:nudge` via WebSocket → rendered in coaching sidebar.

## Loading Screen UI

**Component:** `electron-ui/renderer/src/views/PlanningLoader.tsx`

Three visual layers stacked vertically:

### Layer 1: Animated ASCII Art
The "PAIGE" ASCII banner (from Landing view) with a breathing/pulse animation using Framer Motion `SPRING_GENTLE`. Warm palette colors cycle through characters.

### Layer 2: Phased Progress Bar
Four discrete steps with filling progress:

```
[■ Fetching Issue] → [■ Exploring Codebase] → [□ Building Plan] → [□ Writing Hints]
```

Each step fills as `planning:phase_update` messages arrive. Active step pulses. Warm dark palette (charcoal bg, amber/sage accents).

### Layer 3: Streaming Activity Log
Scrolling monospace log of agent activity from `planning:progress` messages:

```
Reading package.json...
Searching for route definitions in src/...
Reading src/auth/middleware.ts...
Found 12 relevant files
Building Phase 1: Set up database schema...
```

Auto-scrolls, new entries fade in with `SPRING_SNAPPY`. Capped at ~50 visible entries.

### Transitions
- **In:** Zoom from dashboard issue card (existing Framer Motion pattern)
- **Out:** Crossfade to IDE when `planning:complete` arrives

## WebSocket Protocol Extensions

### Backend → Electron (server-sent)

| Type | Payload | When |
|------|---------|------|
| `planning:started` | `{ sessionId, issueTitle }` | Agent SDK query begins |
| `planning:progress` | `{ message: string, toolName?: string, filePath?: string }` | Each agent tool_use |
| `planning:phase_update` | `{ phase: 'fetching' \| 'exploring' \| 'planning' \| 'writing_hints', progress: number }` | Major stage transitions |
| `planning:complete` | `PlanningCompletePayload` (see below) | Agent finished |
| `planning:error` | `{ sessionId, error: string }` | Agent failed |

### planning:complete Payload

```typescript
interface PlanningCompletePayload {
  sessionId: string;
  plan: {
    title: string;
    summary: string;
    phases: Array<{
      number: number;
      title: string;
      description: string;
      hint: string;
      status: 'pending' | 'active';
      tasks: Array<{
        title: string;
        description: string;
        targetFiles: string[];
        hints: { low: string; medium: string; high: string };
      }>;
    }>;
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
```

Single payload eliminates IDE initialization round-trips.

## Error Handling

| Scenario | Handling |
|----------|---------|
| Agent timeout (>3min) | Show error on loading screen with "Retry" button. Session preserved. |
| Malformed JSON output | Retry once with stricter prompt. If still fails, show error + retry option. |
| WebSocket disconnect during planning | Reconnect sends `session:restore`. Backend returns current state or completed plan. |
| GitHub issue not found (404) | Immediate `planning:error` before starting agent. |
| Large repos (10k+ files) | Agent manages its own exploration depth. Progress streaming keeps user informed. |

## File Structure

| Component | Location |
|-----------|----------|
| Planning Agent | `backend-server/src/planning/agent.ts` |
| Planning Prompt | `backend-server/src/planning/prompts.ts` |
| Nudge Agent | `backend-server/src/planning/nudge-agent.ts` |
| Plan Parser/Validator | `backend-server/src/planning/parser.ts` |
| WebSocket Handlers | `backend-server/src/websocket/handlers/planning.ts` |
| Loading Screen View | `electron-ui/renderer/src/views/PlanningLoader.tsx` |
| Progress Bar | `electron-ui/renderer/src/components/planning/ProgressBar.tsx` |
| Activity Log | `electron-ui/renderer/src/components/planning/ActivityLog.tsx` |
| Plan Storage | `backend-server/src/database/queries/plans.ts` (existing) |

## Dependencies

- `@anthropic-ai/claude-agent-sdk` (new backend dependency)
- Existing: `@anthropic-ai/sdk`, `better-sqlite3`, `kysely`, `ws`, `zod`
- Existing: `framer-motion`, `react` (Electron UI)
