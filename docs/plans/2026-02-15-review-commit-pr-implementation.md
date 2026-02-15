# Review, Commit & PR Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add code review (via multi-turn Claude agent), conventional commit, PR creation, and git branch management to Paige's coaching workflow.

**Architecture:** Backend-owned git service (`child_process.execFile`) + review agent (Agent SDK `query()`) + 16 new WebSocket message types. Frontend changes: sidebar polish, review/commit/PR modals, state machine for commit gating.

**Tech Stack:** TypeScript, Electron/React, Node.js, Kysely/SQLite, Claude Agent SDK, Octokit, Framer Motion

**Design doc:** `docs/plans/2026-02-15-review-commit-pr-workflow-design.md`

---

### Task 1: Backend WebSocket Types

Add all 16 new message type definitions to the backend type system.

**Files:**
- Modify: `src/types/websocket.ts`

**Step 1: Add new data interfaces**

Add after the existing `ReviewRequestData` interface (line ~247):

```typescript
// ── Review / Commit / PR / Git Data ─────────────────────────────────────

export type ReviewScope = 'phase' | 'current_file' | 'open_files' | 'current_task';

export type CodeCommentSeverity = 'suggestion' | 'issue' | 'praise';

export type ConventionalCommitType =
  | 'fix' | 'feat' | 'docs' | 'style' | 'refactor'
  | 'test' | 'chore' | 'perf' | 'ci' | 'build';

// Replace the existing ReviewRequestData with:
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

export interface GitStatusRequestData {}

export interface GitStatusResultData {
  readonly clean: boolean;
  readonly modifiedFiles: readonly string[];
  readonly untrackedFiles: readonly string[];
}

export interface GitSaveAndExitData {}

export interface GitDiscardAndExitData {}

export interface GitExitCompleteData {}
```

**Step 2: Add message interfaces**

Add the discriminated union members for each new message type (both client-to-server and server-to-client), following the existing pattern.

**Step 3: Update the `ClientToServerMessage` union**

Add: `ReviewRequestMessage | CommitSuggestMessage | CommitExecuteMessage | PrSuggestMessage | PrCreateMessage | GitStatusRequestMessage | GitSaveAndExitMessage | GitDiscardAndExitMessage`

**Step 4: Update the `ServerToClientMessage` union**

Add: `ReviewResultMessage | CommitSuggestionMessage | CommitErrorMessage | PrSuggestionMessage | PrCreatedMessage | PrErrorMessage | GitStatusResultMessage | GitExitCompleteMessage`

**Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (no consumers of new types yet)

**Step 6: Commit**

```bash
git add src/types/websocket.ts
git commit -m "feat(types): add review, commit, PR, and git WebSocket message types"
```

---

### Task 2: Database Migration — Branch & Stash Columns

Add `branch_name` and `stash_name` columns to the `sessions` table.

**Files:**
- Create: `src/database/migrations/002-branch-stash.ts`
- Modify: `src/database/db.ts` (register migration)

**Step 1: Write the migration test**

Create `tests/unit/database/migrations/002-branch-stash.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { up } from '../../../../src/database/migrations/001-initial.js';
import { up as up002 } from '../../../../src/database/migrations/002-branch-stash.js';

describe('002-branch-stash migration', () => {
  let db: Kysely<unknown>;

  beforeEach(async () => {
    const sqlite = new Database(':memory:');
    db = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    await up(db);
  });

  it('adds branch_name and stash_name columns to sessions', async () => {
    await up002(db);
    // Insert a session with branch_name and stash_name
    await db.insertInto('sessions').values({
      project_dir: '/test',
      status: 'active',
      started_at: new Date().toISOString(),
      branch_name: 'user/fix-bug',
      stash_name: 'paige-42-1739577600',
    }).execute();

    const rows = await db.selectFrom('sessions').selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('branch_name', 'user/fix-bug');
    expect(rows[0]).toHaveProperty('stash_name', 'paige-42-1739577600');
  });

  it('allows null branch_name and stash_name', async () => {
    await up002(db);
    await db.insertInto('sessions').values({
      project_dir: '/test',
      status: 'active',
      started_at: new Date().toISOString(),
    }).execute();

    const rows = await db.selectFrom('sessions').selectAll().execute();
    expect(rows[0]).toHaveProperty('branch_name', null);
    expect(rows[0]).toHaveProperty('stash_name', null);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/database/migrations/002-branch-stash.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the migration**

Create `src/database/migrations/002-branch-stash.ts`:

```typescript
import { type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('sessions')
    .addColumn('branch_name', 'text')
    .execute();

  await db.schema
    .alterTable('sessions')
    .addColumn('stash_name', 'text')
    .execute();
}
```

**Step 4: Register the migration in `db.ts`**

Add import and registration for the new migration in the migration array.

**Step 5: Run test to verify it passes**

Run: `pnpm test tests/unit/database/migrations/002-branch-stash.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/database/migrations/002-branch-stash.ts tests/unit/database/migrations/002-branch-stash.test.ts src/database/db.ts
git commit -m "feat(db): add branch_name and stash_name columns to sessions"
```

---

### Task 3: Backend Git Service

Core module for all git operations.

**Files:**
- Create: `src/git/service.ts`
- Create: `tests/unit/git/service.test.ts`

**Step 1: Write tests for the git service**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gitStatus, gitCheckout, gitCommit, gitPush, gitStash, gitBranchCreate } from '../../../src/git/service.js';

// Mock child_process.execFile
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('git service', () => {
  it('gitStatus returns clean when no changes', async () => { /* ... */ });
  it('gitStatus parses modified and untracked files', async () => { /* ... */ });
  it('gitCheckout runs git checkout', async () => { /* ... */ });
  it('gitCommit formats conventional commit message', async () => { /* ... */ });
  it('gitPush pushes with -u flag', async () => { /* ... */ });
  it('gitStash creates named stash', async () => { /* ... */ });
  it('gitBranchCreate creates and checks out new branch', async () => { /* ... */ });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/git/service.test.ts`
Expected: FAIL

**Step 3: Implement the git service**

Create `src/git/service.ts` with these exported functions:

- `gitExec(args: string[], cwd: string): Promise<string>` — Core wrapper around `execFile('git', args, { cwd })` with Promise interface
- `gitStatus(cwd: string): Promise<{ clean: boolean; modifiedFiles: string[]; untrackedFiles: string[] }>` — Runs `git status --porcelain`, parses output
- `gitCheckout(branch: string, cwd: string): Promise<void>` — `git checkout {branch}`
- `gitBranchCreate(branch: string, cwd: string): Promise<void>` — `git checkout -b {branch}`
- `gitPull(cwd: string): Promise<void>` — `git pull origin main`
- `gitPullRebase(cwd: string): Promise<void>` — `git pull --rebase origin main`
- `gitAddAll(cwd: string): Promise<void>` — `git add -A`
- `gitCommit(type: string, subject: string, body: string, cwd: string): Promise<void>` — `git commit -m "{type}: {subject}\n\n{body}"`
- `gitPush(branch: string, cwd: string): Promise<void>` — `git push -u origin {branch}`
- `gitStashPush(name: string, cwd: string): Promise<void>` — `git stash push -m {name}`
- `gitStashApply(name: string, cwd: string): Promise<void>` — `git stash apply {name}`
- `gitStashDrop(name: string, cwd: string): Promise<void>` — `git stash drop {name}`
- `gitDiff(cwd: string): Promise<string>` — `git diff HEAD`
- `gitLog(range: string, cwd: string): Promise<string>` — `git log {range} --oneline`
- `gitRevertAll(cwd: string): Promise<void>` — `git checkout -- .` + `git clean -fd`

All functions use `execFile` (not `exec`) for safety. All accept `cwd` as parameter.

**Step 4: Run tests**

Run: `pnpm test tests/unit/git/service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/git/service.ts tests/unit/git/service.test.ts
git commit -m "feat(git): add git service module with core operations"
```

---

### Task 4: Backend Git PR Service

PR creation via Octokit.

**Files:**
- Create: `src/git/pr.ts`
- Create: `tests/unit/git/pr.test.ts`

**Step 1: Write test**

Test that `createPullRequest` calls `octokit.rest.pulls.create` with correct params and returns `{ prUrl, prNumber }`.

**Step 2: Implement**

Create `src/git/pr.ts`:

```typescript
import { getOctokit } from '../github/client.js';

export async function createPullRequest(
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<{ prUrl: string; prNumber: number }> {
  const octokit = getOctokit();
  if (octokit === null) throw new Error('GitHub API not available');

  const { data } = await octokit.rest.pulls.create({
    owner, repo, title, body, head, base,
  });

  return { prUrl: data.html_url, prNumber: data.number };
}
```

**Step 3: Run tests, commit**

```bash
git add src/git/pr.ts tests/unit/git/pr.test.ts
git commit -m "feat(git): add PR creation via Octokit"
```

---

### Task 5: Backend Review Agent

Multi-turn review agent using Claude Agent SDK.

**Files:**
- Create: `src/review/agent.ts`
- Create: `src/review/tools.ts`
- Create: `src/review/schemas.ts`
- Create: `tests/unit/review/agent.test.ts`

**Step 1: Write the review tools**

Create `src/review/tools.ts` with tool definitions for the agent:
- `read_file` — reads a file from the project directory
- `git_diff` — runs `git diff HEAD` or `git diff HEAD -- {path}`
- `list_files` — lists files in a directory
- `get_phase_info` — returns current phase title, description, and tasks from DB
- `get_task_info` — returns specific task details

Each tool follows the Agent SDK tool pattern (name, description, input schema, handler function).

**Step 2: Write the Zod schema**

Create `src/review/schemas.ts`:

```typescript
import { z } from 'zod';

export const reviewResultSchema = z.object({
  overallFeedback: z.string(),
  codeComments: z.array(z.object({
    filePath: z.string(),
    startLine: z.number(),
    endLine: z.number(),
    comment: z.string(),
    severity: z.enum(['suggestion', 'issue', 'praise']),
  })),
  taskFeedback: z.array(z.object({
    taskTitle: z.string(),
    feedback: z.string(),
    taskComplete: z.boolean(),
  })).optional(),
  phaseComplete: z.boolean().optional(),
});

export type ReviewResult = z.infer<typeof reviewResultSchema>;
```

**Step 3: Write the review agent**

Create `src/review/agent.ts`:
- Uses Agent SDK `query()` with the review tools
- System prompt: coaching-oriented code reviewer for junior developers
- Parses final output against `reviewResultSchema`
- Accepts scope, phase info, and project directory as inputs

**Step 4: Write tests (mock the Agent SDK)**

**Step 5: Run tests, commit**

```bash
git add src/review/agent.ts src/review/tools.ts src/review/schemas.ts tests/unit/review/
git commit -m "feat(review): add multi-turn review agent with tools"
```

---

### Task 6: Backend WebSocket Handlers — Review

**Files:**
- Create: `src/websocket/handlers/review.ts`
- Modify: `src/websocket/router.ts`

**Step 1: Write handler**

Create `src/websocket/handlers/review.ts`:

```typescript
export function handleReviewRequest(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): void {
  const { scope, activeFilePath, openFilePaths } = data as ReviewRequestData;
  // 1. Get active session, phase, project dir
  // 2. Fire-and-forget: run review agent
  // 3. On complete: broadcast review:result + editor:decorations
  // Pattern: same as handlePlanningStart (fire-and-forget with error broadcasting)
}
```

**Step 2: Register in router.ts**

Replace the `notImplementedHandler('review:request')` stub with the real handler.

**Step 3: Run typecheck**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git add src/websocket/handlers/review.ts src/websocket/router.ts
git commit -m "feat(ws): add review:request handler with agent integration"
```

---

### Task 7: Backend WebSocket Handlers — Commit & PR

**Files:**
- Create: `src/websocket/handlers/commit.ts`
- Create: `src/websocket/handlers/pr.ts`
- Create: `src/websocket/handlers/git.ts`
- Modify: `src/websocket/router.ts`

**Step 1: Write commit handlers**

`src/websocket/handlers/commit.ts`:
- `handleCommitSuggest` — Gets git diff + phase info, calls Haiku via `callApi()` with commit suggestion schema, broadcasts `commit:suggestion`
- `handleCommitExecute` — Calls `gitAddAll` + `gitCommit`, broadcasts `phase:transition` for current phase to complete + next phase to active

**Step 2: Write PR handlers**

`src/websocket/handlers/pr.ts`:
- `handlePrSuggest` — Gets git log + phase info + issue info, calls Haiku, broadcasts `pr:suggestion`
- `handlePrCreate` — Calls `gitPush` + `createPullRequest`, broadcasts `pr:created`

**Step 3: Write git status/exit handlers**

`src/websocket/handlers/git.ts`:
- `handleGitStatus` — Calls `gitStatus`, broadcasts `git:status_result`
- `handleGitSaveAndExit` — Calls `gitAddAll` + `gitStashPush` + `gitCheckout('main')`, broadcasts `git:exit_complete`
- `handleGitDiscardAndExit` — Calls `gitRevertAll` + `gitCheckout('main')`, broadcasts `git:exit_complete`

**Step 4: Register all in router.ts**

Add all new handlers to the handler map.

**Step 5: Run typecheck, commit**

```bash
git add src/websocket/handlers/commit.ts src/websocket/handlers/pr.ts src/websocket/handlers/git.ts src/websocket/router.ts
git commit -m "feat(ws): add commit, PR, and git status handlers"
```

---

### Task 8: Backend Branch Workflow

Modify issue selection to handle branch creation/restoration.

**Files:**
- Modify: `src/websocket/handlers/planning.ts`
- Modify: `src/websocket/handlers/session-start.ts`
- Modify: `src/websocket/handlers/dashboard.ts`

**Step 1: Update session-start.ts**

Change `git clone --depth=1` to `git clone` (remove `--depth=1` flag).

**Step 2: Update planning.ts — handlePlanningStart**

Before running the planning agent:
1. Check DB for existing session with this issue number and a branch_name
2. If **new issue**: call Haiku to suggest branch name, create branch via `gitBranchCreate`, store in DB
3. If **returning**: checkout branch via `gitCheckout`, `gitPullRebase`, apply stash if exists, restore phase state, skip planning agent and send `planning:complete` directly from DB

**Step 3: Update dashboard.ts**

In `handleDashboardRequestWs`, add pre-flight: call `gitCheckout('main')` + `gitPull()` on the active repo dir. Non-blocking, errors logged.

**Step 4: Run typecheck, commit**

```bash
git add src/websocket/handlers/planning.ts src/websocket/handlers/session-start.ts src/websocket/handlers/dashboard.ts
git commit -m "feat(git): add branch creation, restoration, and dashboard preflight"
```

---

### Task 9: Frontend WebSocket Types

Add new message types to the Electron UI shared types.

**Files:**
- Modify: `electron-ui/shared/types/websocket-messages.ts`
- Modify: `electron-ui/shared/types/entities.ts`

**Step 1: Add review result types to entities.ts**

```typescript
export type ReviewScope = 'phase' | 'current_file' | 'open_files' | 'current_task';
export type CodeCommentSeverity = 'suggestion' | 'issue' | 'praise';
export type ConventionalCommitType =
  | 'fix' | 'feat' | 'docs' | 'style' | 'refactor'
  | 'test' | 'chore' | 'perf' | 'ci' | 'build';

export interface ReviewCodeComment {
  filePath: string;
  startLine: number;
  endLine: number;
  comment: string;
  severity: CodeCommentSeverity;
}

export interface ReviewTaskFeedback {
  taskTitle: string;
  feedback: string;
  taskComplete: boolean;
}

export interface ReviewResult {
  overallFeedback: string;
  codeComments: ReviewCodeComment[];
  taskFeedback?: ReviewTaskFeedback[];
  phaseComplete?: boolean;
}
```

**Step 2: Add message types to websocket-messages.ts**

Follow the existing pattern. Add all 16 new message types (8 client-to-server, 8 server-to-client).

**Step 3: Run typecheck**

Run: `cd electron-ui && npm run typecheck`

**Step 4: Commit**

```bash
git add electron-ui/shared/types/
git commit -m "feat(ui-types): add review, commit, PR, and git message types"
```

---

### Task 10: Sidebar Cosmetic Changes

Width, labels, summary, hint slider ASCII redesign.

**Files:**
- Modify: `electron-ui/renderer/src/components/Sidebar/Sidebar.tsx`
- Modify: `electron-ui/renderer/src/components/Sidebar/IssueContext.tsx`
- Modify: `electron-ui/renderer/src/components/Sidebar/HintSlider.tsx`
- Delete: `electron-ui/renderer/src/components/Sidebar/HintIllustration.tsx`

**Step 1: Update sidebar width**

In `Sidebar.tsx`, the width is set by the parent `IDE.tsx`. Find where 280px is defined and change to 560px. Remove the `HintIllustration` import and usage.

**Step 2: Update IssueContext.tsx**

1. Remove the `summaryExpanded` state and toggle button
2. Always render the summary paragraph (remove the conditional)
3. Change label pill styles:
   - `borderRadius: '10px'` → `'4px'`
   - `padding: '2px 8px'` → `'1px 6px'`
   - `fontSize: 'var(--font-label-size)'` → `'calc(var(--font-label-size) - 1px)'`

**Step 3: Redesign HintSlider.tsx**

Replace the dot-slider with ASCII progress bar:

1. Remove `illustrationContainerStyle`, `illustrationStyle`, emoji constants
2. Replace the track/dots with a monospace `<pre>` element rendering `[====..........]`
3. Make the entire bar clickable (divided into 4 zones)
4. Keep the level name centered below, description below that
5. Make level names clickable (existing behavior, keep it)

ASCII rendering logic:
```typescript
const TOTAL_CHARS = 14;
const fillCount = Math.round((level / 3) * TOTAL_CHARS);
const bar = '[' + '='.repeat(fillCount) + '\u00B7'.repeat(TOTAL_CHARS - fillCount) + ']';
```

**Step 4: Delete HintIllustration.tsx**

Remove the file entirely. Remove its import from `Sidebar.tsx`.

**Step 5: Run typecheck and dev server**

Run: `cd electron-ui && npm run typecheck`
Visually verify the changes look correct.

**Step 6: Commit**

```bash
git add electron-ui/renderer/src/components/Sidebar/ -A
git commit -m "feat(sidebar): widen to 560px, always-visible summary, ASCII hint slider"
```

---

### Task 11: StatusBar Cleanup

Remove the review button from the editor status bar.

**Files:**
- Modify: `electron-ui/renderer/src/components/Editor/StatusBar.tsx`

**Step 1: Remove review-related code**

1. Delete the `ReviewScope` type, `REVIEW_OPTIONS` constant
2. Delete the `ReviewSplitButton` component
3. Delete the `ReviewNavigation` component
4. Delete all split button and dropdown styles
5. Remove review-related props from `StatusBarProps` (`onReview`, `reviewActive`, etc.)
6. Remove the right section from the status bar JSX — the bar now only shows the left section (breadcrumb + cursor + language)

**Step 2: Run typecheck**

Find and update any parent components that pass review props to `StatusBar`.

**Step 3: Commit**

```bash
git add electron-ui/renderer/src/components/Editor/StatusBar.tsx
git commit -m "refactor(statusbar): remove review button, keep info-only bar"
```

---

### Task 12: Review Split Button in Sidebar

**Files:**
- Modify: `electron-ui/renderer/src/components/Sidebar/Sidebar.tsx`

**Step 1: Add review button section**

Add a new section below the `PhaseStepper` in the scrollable area. This contains a split button with "Review Phase" as the main action and a dropdown with 3 options.

Port the split button pattern from the old `StatusBar.tsx` (adjust styling for the wider sidebar) and change:
- Main button text: "Review Phase"
- Dropdown options: "Review Current File", "Review Open Files", "Review Current Task"
- Scopes: `'phase'`, `'current_file'`, `'open_files'`, `'current_task'`

**Step 2: Wire up WebSocket send**

On click: save all dirty buffers first, then send `review:request` with scope.

**Step 3: Add "Commit & Continue" button**

Place next to the review button in a horizontal flex row. Initially disabled. Styling: `var(--accent-primary)` background when enabled, grayed out when disabled.

**Step 4: Add commit button state machine**

```typescript
type CommitState = 'idle' | 'ready_to_commit' | 'needs_re_review';

// idle → (review:result with phaseComplete=true) → ready_to_commit
// ready_to_commit → (buffer:update received) → needs_re_review
// needs_re_review → (review:result with phaseComplete=true) → ready_to_commit
```

Subscribe to `buffer:update` messages and `review:result` to drive transitions.

**Step 5: Add "Open PR" button state**

When all phases are `complete`, hide the review/commit buttons and show "Open PR" instead.

**Step 6: Add "Back to Dashboard" button**

Add a clickable "Back to Dashboard" link/button in the sidebar header area (above the issue context).

**Step 7: Run typecheck, commit**

```bash
git add electron-ui/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat(sidebar): add review split button, commit button, and PR button"
```

---

### Task 13: ReviewResults Component

Display review feedback in the sidebar.

**Files:**
- Create: `electron-ui/renderer/src/components/Sidebar/ReviewResults.tsx`
- Modify: `electron-ui/renderer/src/components/Sidebar/Sidebar.tsx`

**Step 1: Create ReviewResults component**

Props: `{ result: ReviewResult | null; onDismiss: () => void; onCodeCommentClick: (filePath: string, line: number) => void }`

Layout:
- Overall feedback as a text block
- Task feedback as expandable list items with pass/fail icons
- Phase complete banner (if `phaseComplete === true`)
- Code comments listed with file path + line number, clickable
- "Dismiss" button at the bottom

**Step 2: Integrate into Sidebar.tsx**

Add state for review results. Subscribe to `review:result` messages. Pass results to `ReviewResults`. Wire up `onCodeCommentClick` to send `file:open` + scroll command.

**Step 3: Add loading state**

When `review:request` is sent, show "Reviewing..." with pulse animation. Clear when `review:result` arrives.

**Step 4: Commit**

```bash
git add electron-ui/renderer/src/components/Sidebar/ReviewResults.tsx electron-ui/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat(sidebar): add review results display with feedback and code comments"
```

---

### Task 14: Commit Modal

**Files:**
- Create: `electron-ui/renderer/src/components/Modals/CommitModal.tsx`
- Modify: `electron-ui/renderer/src/components/Sidebar/Sidebar.tsx`

**Step 1: Create CommitModal component**

Follow `IssueModal.tsx` pattern (fixed overlay, backdrop, Framer Motion entrance).

Props: `{ isOpen: boolean; phaseNumber: number; onClose: () => void }`

Layout:
- Header: "Commit Phase {N}" + close button
- Row 1 (flex): commit type `<select>` (~120px) + subject `<input>` (flex: 1)
- Row 2: body `<textarea>` (full width, 4-5 rows)
- Footer: "Commit changes" button (right-aligned, terracotta)
- Error display: inline above submit button

On mount: send `commit:suggest`, show skeleton loading. On `commit:suggestion`: populate form fields.
On submit: send `commit:execute`. On `commit:error`: show error. On success (phase:transition): close modal.

**Step 2: Wire into Sidebar.tsx**

Open modal when "Commit & Continue" clicked. Pass current phase number.

**Step 3: Commit**

```bash
git add electron-ui/renderer/src/components/Modals/CommitModal.tsx electron-ui/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat(modal): add commit modal with AI-suggested conventional commit messages"
```

---

### Task 15: PR Modal

**Files:**
- Create: `electron-ui/renderer/src/components/Modals/PrModal.tsx`
- Modify: `electron-ui/renderer/src/components/Sidebar/Sidebar.tsx`

**Step 1: Create PrModal component**

Same pattern as CommitModal.

Props: `{ isOpen: boolean; onClose: () => void; onNavigate: (view: AppView) => void }`

Layout:
- Header: "Open Pull Request" + close button
- PR title `<input>` (full width)
- PR body `<textarea>` (full width, 6-8 rows)
- Footer: "Open PR" button

On mount: send `pr:suggest`, show skeleton. On `pr:suggestion`: populate fields.
On submit: send `pr:create`. On `pr:created`: close modal, navigate to dashboard.

**Step 2: Wire into Sidebar.tsx**

Open modal when "Open PR" clicked. Handle navigation on success.

**Step 3: Commit**

```bash
git add electron-ui/renderer/src/components/Modals/PrModal.tsx electron-ui/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat(modal): add PR modal with AI-suggested title and body"
```

---

### Task 16: Save/Discard Modal

**Files:**
- Create: `electron-ui/renderer/src/components/Modals/SaveDiscardModal.tsx`
- Modify: `electron-ui/renderer/src/components/Sidebar/Sidebar.tsx`

**Step 1: Create SaveDiscardModal component**

Props: `{ isOpen: boolean; onSave: () => void; onDiscard: () => void; onClose: () => void }`

Layout:
- Header: "Unsaved Changes"
- Body: "You have unsaved changes. Would you like to save your progress or discard it?"
- Two buttons: "Save & Exit" (primary, terracotta) | "Discard Changes" (secondary)

**Step 2: Wire into Sidebar.tsx "Back to Dashboard" button**

On click:
1. Check for dirty buffers
2. Send `git:status` to backend
3. If dirty or unclean: show SaveDiscardModal
4. If clean: navigate directly to dashboard

On "Save & Exit": save all dirty buffers, send `git:save_and_exit`. On `git:exit_complete`: navigate to dashboard.
On "Discard": send `git:discard_and_exit`. On `git:exit_complete`: navigate to dashboard.

**Step 3: Commit**

```bash
git add electron-ui/renderer/src/components/Modals/SaveDiscardModal.tsx electron-ui/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat(modal): add save/discard modal for dirty state on dashboard return"
```

---

### Task 17: Integration Testing & Polish

**Files:**
- All modified files

**Step 1: Run full test suite**

Backend: `pnpm test`
Frontend: `cd electron-ui && npm test`

**Step 2: Run typecheck on both**

Backend: `pnpm typecheck`
Frontend: `cd electron-ui && npm run typecheck`

**Step 3: Run lint on both**

Backend: `pnpm lint`
Frontend: `cd electron-ui && npm run lint`

**Step 4: Fix any issues**

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: address lint and test issues for review-commit-pr workflow"
```

---

## Task Dependency Graph

```
Task 1 (Backend WS Types)
  └─> Task 6 (Review Handler)
  └─> Task 7 (Commit/PR/Git Handlers)
  └─> Task 8 (Branch Workflow)

Task 2 (DB Migration)
  └─> Task 8 (Branch Workflow)

Task 3 (Git Service)
  └─> Task 7 (Commit/PR/Git Handlers)
  └─> Task 8 (Branch Workflow)

Task 4 (PR Service)
  └─> Task 7 (Commit/PR/Git Handlers)

Task 5 (Review Agent)
  └─> Task 6 (Review Handler)

Task 9 (Frontend WS Types)
  └─> Task 12 (Review Button)
  └─> Task 13 (ReviewResults)
  └─> Task 14 (CommitModal)
  └─> Task 15 (PrModal)
  └─> Task 16 (SaveDiscardModal)

Task 10 (Sidebar Cosmetics) — Independent
Task 11 (StatusBar Cleanup) — Independent

Task 17 (Integration) — Depends on all above
```

**Parallelizable groups:**
- Group A (Backend foundation): Tasks 1, 2, 3, 4, 5 can all be done in parallel
- Group B (Backend handlers): Tasks 6, 7, 8 (after Group A)
- Group C (Frontend foundation): Tasks 9, 10, 11 can be done in parallel (and parallel with Group A)
- Group D (Frontend components): Tasks 12, 13, 14, 15, 16 (after Task 9)
- Group E (Integration): Task 17 (after all)
