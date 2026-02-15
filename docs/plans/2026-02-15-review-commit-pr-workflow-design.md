# Review, Commit & PR Workflow Design

**Date**: 2026-02-15
**Status**: Approved
**Scope**: Electron UI (sidebar, modals, status bar) + Backend (git service, review agent, WebSocket handlers)

## Overview

Adds a complete development lifecycle to Paige: code review via multi-turn Claude agent, conventional commit workflow, and PR creation. Includes git branch management (create, stash, restore) tied to issue sessions, and a "back to dashboard" flow with dirty-state handling.

## Decisions

- **Review agent**: Multi-turn Claude Agent SDK `query()` with tool access (read files, git diff, explore context)
- **Review display**: Both sidebar panel (overall + task feedback) and Monaco decorations (code-level comments)
- **Clone strategy**: Full clone (drop `--depth=1`) for branch/commit/push/rebase support
- **Git operations**: Backend-owned git service using `child_process.execFile()`, PRs via existing Octokit integration
- **Commit messages & PR content**: AI-suggested via Haiku (fastest/cheapest), fully editable by user

---

## Section 1: Sidebar Layout & Cosmetic Changes

### 1a. Width

Sidebar: 280px to 560px. Collapsible toggle stays at 32px.

### 1b. Issue Context

Summary always visible below the title. Remove the "Show summary" / "Hide summary" toggle. Keep 250-char truncation with ellipsis.

### 1c. Labels

Change pill styling:
- `border-radius: 10px` to `4px`
- `padding: 2px 8px` to `1px 6px`
- `font-size: calc(var(--font-label-size) - 1px)`
- Keep luminance-based contrast text and background colors

### 1d. Hint Slider — ASCII Redesign

Remove `HintIllustration` component (SVG illustrations, emoji fallbacks).

Replace with ASCII progress bar in monospace font:

```
[====..........]
   Light
   Subtle nudges only
```

Four positions:
- `[..............]` — **None** — "No coaching hints"
- `[====..........]` — **Light** — "Subtle nudges only"
- `[=========.....]` — **Medium** — "Guided directions"
- `[==============]` — **Heavy** — "Detailed walkthroughs"

Track uses `=` for filled and `.` for empty inside `[ ]` brackets. Level name centered below, description below name. Both name and bar are clickable to change level.

---

## Section 2: Review Workflow

### 2a. Remove Review from Status Bar

Delete the "Review My Work" split button, dropdown, and review navigation from `StatusBar.tsx`. Status bar becomes informational only: breadcrumb + cursor position + language.

### 2b. Review Button in Coaching Sidebar

New section below `PhaseStepper`. Split button:
- **Main**: "Review Phase" (default action)
- **Dropdown** (upward): "Review Current File", "Review Open Files", "Review Current Task"

### 2c. Review Flow

1. UI saves all dirty buffers (`file:save` for each, waits for `save:ack`)
2. UI sends `review:request`:
   ```typescript
   {
     scope: 'phase' | 'current_file' | 'open_files' | 'current_task';
     activeFilePath?: string;
     openFilePaths?: string[];
   }
   ```
3. Backend launches Review Agent (multi-turn, Agent SDK `query()`):
   - Tools: read file, git diff, list files, get phase info, get task info
   - System prompt: coaching-oriented code reviewer for junior developers
4. Agent produces structured output:
   ```typescript
   {
     overallFeedback: string;
     codeComments: Array<{
       filePath: string;
       startLine: number;
       endLine: number;
       comment: string;
       severity: 'suggestion' | 'issue' | 'praise';
     }>;
     taskFeedback?: Array<{
       taskTitle: string;
       feedback: string;
       taskComplete: boolean;
     }>;
     phaseComplete?: boolean;
   }
   ```
5. Backend broadcasts:
   - `review:result` — Full structured review for sidebar
   - `editor:decorations` — Code comments as Monaco decorations

### 2d. Sidebar Review Display

`ReviewResults` section below review button:
- Overall feedback text block
- Task feedback list with pass/fail indicators, expandable
- Phase complete success banner if applicable
- Clicking code comments scrolls editor to location
- "Dismiss" button to clear results

### 2e. Loading State

While reviewing: "Reviewing..." with pulse animation, review button disabled.

---

## Section 3: Commit & Continue

### 3a. Button Placement

"Commit & Continue" button next to "Review Phase" in a horizontal row below the phase stepper.

### 3b. Enable/Disable State Machine

```
idle → (review received, phaseComplete=true) → ready_to_commit
ready_to_commit → (buffer:update) → needs_re_review
needs_re_review → (review received, phaseComplete=true) → ready_to_commit
```

- **Disabled**: Before any review, or after review with `phaseComplete === false`, or after file modification post-review
- **Enabled**: After review with `phaseComplete === true`. Styled with `var(--accent-primary)`

### 3c. Commit Modal

On click, opens modal (existing IssueModal pattern):
- **Header**: "Commit Phase {N}" + close button
- **Row 1** (horizontal flex):
  - Commit type select (~120px): `fix`, `feat`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`
  - Subject input (flex: 1): placeholder "Brief description of changes"
- **Row 2**:
  - Body textarea (full width, 4-5 rows): placeholder "Detailed explanation (optional)"
- **Footer**: "Commit changes" button (right-aligned, terracotta)

### 3d. AI-Suggested Commit Message

Modal open triggers `commit:suggest` to backend:
1. `git diff HEAD` for uncommitted changes
2. Get phase title/description from DB
3. `callApi()` with Haiku: `{ type, subject, body }`
4. Broadcast `commit:suggestion`

Skeleton loading (pulsing gray bars) until suggestion arrives. Fields fully editable after.

### 3e. Commit Execution

"Commit changes" click:
1. UI sends `commit:execute` with `{ type, subject, body }`
2. Backend: `git add -A` then `git commit -m "{type}: {subject}\n\n{body}"`
3. Success: broadcast `phase:transition` (current phase to `complete`, next phase to `active`)
4. Modal closes

### 3f. Error Handling

Commit failure: `commit:error` with message. Modal stays open, error displayed inline.

---

## Section 4: Phase Complete & Open PR

### 4a. Phase Complete Handler

On `phase:transition` to `complete`:
1. Mark all tasks in phase as complete
2. Mark phase as complete (green checkmark)
3. Activate next phase if exists
4. Reset commit button to `idle`
5. Clear review results

Uses existing `phase:transition` message type.

### 4b. All Phases Complete

When all phases are `complete`, replace "Review Phase" and "Commit & Continue" buttons with "Open PR" button (full width, terracotta accent).

### 4c. Open PR Modal

- **Header**: "Open Pull Request" + close button
- **PR title input** (full width)
- **PR body textarea** (full width, 6-8 rows)
- **Footer**: "Open PR" button (right-aligned, terracotta)

### 4d. AI-Suggested PR Content

Modal open triggers `pr:suggest`:
1. `git log main..HEAD --oneline`
2. Phase titles/descriptions from DB
3. Issue title/summary
4. `callApi()` with Haiku: `{ title, body }`
5. Broadcast `pr:suggestion`

Same skeleton loading pattern.

### 4e. PR Submission

"Open PR" click:
1. UI sends `pr:create` with `{ title, body }`
2. Backend: `git push -u origin {branchName}`
3. Octokit: `octokit.rest.pulls.create({ owner, repo, title, body, head: branchName, base: 'main' })`
4. Success: broadcast `pr:created` with `{ prUrl, prNumber }`
5. Modal closes, UI navigates to dashboard

### 4f. Error Handling

Push/PR failure: `pr:error` with message. Modal stays open, error inline.

---

## Section 5: Git Branch & Dashboard Workflow

### 5a. Dashboard Opens

On navigation to dashboard, backend:
1. `git checkout main`
2. `git pull origin main`

Non-blocking — errors logged, dashboard loads regardless.

### 5b. First Time Working on Issue

On `session:select_issue` with no previous session for this issue:
1. Haiku suggests branch name from issue title: `{ branchName: string }` (kebab-case, max 50 chars)
2. Get GitHub username via `getAuthenticatedUser()`
3. Full branch: `{username}/{suggested-name}`
4. `git checkout -b {branchName}`
5. Store `branch_name` in session record
6. Proceed with planning agent

### 5c. Returning to Issue

If session exists with `branch_name`:
1. `git checkout {branchName}`
2. `git pull --rebase origin main`
3. If stash exists in DB: `git stash apply {stashName}`, then `git stash drop {stashName}`, clear DB reference
4. Stash apply failure: broadcast error, user resolves in terminal
5. Restore phase state from DB
6. Skip planning agent, go to IDE with restored state

### 5d. Back to Dashboard — Dirty State

"Back to Dashboard" button in sidebar header. On click:
1. Check for dirty buffers in UI
2. Send `git:status` to backend, receive `git:status_result` with `{ clean, modifiedFiles, untrackedFiles }`
3. If dirty buffers OR unclean tree: show Save/Discard modal

**Modal**:
- "Unsaved Changes" header
- "You have unsaved changes. Would you like to save your progress or discard it?"
- "Save & Exit" (primary) / "Discard Changes" (secondary/danger)

### 5e. Save & Exit

1. Save all dirty editor buffers (`file:save` each, wait for `save:ack`)
2. Backend: `git add -A`, `git stash push -m "paige-{issueNumber}-{timestamp}"`
3. Store stash name in DB
4. `git checkout main`
5. Navigate to dashboard

### 5f. Discard Changes

1. Close editor tabs without saving
2. Backend: `git checkout -- .`, `git clean -fd`, `git checkout main`
3. Navigate to dashboard

### 5g. Database Changes

Add to `sessions` table:
- `branch_name TEXT` — Git branch for this issue
- `stash_name TEXT` — Git stash name if progress saved (cleared after restore)

---

## New WebSocket Messages

| Message | Direction | Purpose |
|---------|-----------|---------|
| `review:request` | Client -> Server | Request code review with scope |
| `review:result` | Server -> Client | Structured review feedback |
| `commit:suggest` | Client -> Server | Request AI commit message |
| `commit:suggestion` | Server -> Client | Suggested commit type/subject/body |
| `commit:execute` | Client -> Server | Execute git commit |
| `commit:error` | Server -> Client | Commit failed |
| `pr:suggest` | Client -> Server | Request AI PR title/body |
| `pr:suggestion` | Server -> Client | Suggested PR content |
| `pr:create` | Client -> Server | Push branch and create PR |
| `pr:created` | Server -> Client | PR created with URL |
| `pr:error` | Server -> Client | PR creation failed |
| `git:status` | Client -> Server | Request working tree status |
| `git:status_result` | Server -> Client | Clean/dirty + file lists |
| `git:save_and_exit` | Client -> Server | Save, stash, checkout main |
| `git:discard_and_exit` | Client -> Server | Revert, checkout main |
| `git:exit_complete` | Server -> Client | Safe to navigate to dashboard |

## New Backend Modules

- `src/git/service.ts` — All git operations (branch, commit, stash, push, status) via `child_process.execFile()`
- `src/git/pr.ts` — PR creation via Octokit
- `src/review/agent.ts` — Multi-turn review agent using Agent SDK
- `src/review/tools.ts` — Tools available to the review agent
- `src/websocket/handlers/review.ts` — WebSocket handlers for review messages
- `src/websocket/handlers/commit.ts` — WebSocket handlers for commit messages
- `src/websocket/handlers/pr.ts` — WebSocket handlers for PR messages
- `src/websocket/handlers/git.ts` — WebSocket handlers for git status/exit messages

## Modified Files

### Electron UI
- `renderer/src/components/Sidebar/Sidebar.tsx` — Width change, add review/commit buttons, back button
- `renderer/src/components/Sidebar/IssueContext.tsx` — Always-visible summary, smaller labels
- `renderer/src/components/Sidebar/HintSlider.tsx` — ASCII progress bar redesign
- `renderer/src/components/Sidebar/HintIllustration.tsx` — Delete
- `renderer/src/components/Sidebar/PhaseStepper.tsx` — Phase complete handling
- `renderer/src/components/Editor/StatusBar.tsx` — Remove review button
- `renderer/src/components/Sidebar/ReviewResults.tsx` — New: review display
- `renderer/src/components/Modals/CommitModal.tsx` — New: commit form
- `renderer/src/components/Modals/PrModal.tsx` — New: PR form
- `renderer/src/components/Modals/SaveDiscardModal.tsx` — New: dirty state dialog
- `shared/types/websocket-messages.ts` — New message types
- `shared/types/entities.ts` — Review result types

### Backend
- `src/database/migrations/002-branch-stash.ts` — Add branch_name, stash_name columns
- `src/websocket/router.ts` — Register new handlers
- `src/websocket/handlers/session-start.ts` — Full clone, branch workflow
- `src/types/websocket.ts` — New message type definitions
