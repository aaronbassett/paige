# Dashboard In-Progress Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic InProgressTasks panel with a new panel showing in-progress GitHub issues (from local DB) and authored open PRs (from GitHub API), with filter/sort controls.

**Architecture:** New backend flow fetches in-progress issue numbers from SQLite sessions table and open PRs from GitHub API, streams them as `InProgressItem` messages. Frontend replaces `InProgressTasks.tsx` with a new `InProgress.tsx` component consuming the stream. A shared `SortButton` component is added to both panels.

**Tech Stack:** TypeScript, React 18, Framer Motion, WebSocket, Octokit, Kysely/SQLite, Vitest

---

### Task 1: Add backend types for in-progress items

**Files:**
- Modify: `src/types/websocket.ts`

**Step 1: Add `InProgressItemPayload` type and WS message types**

Add after the `ScoredIssuePayload` interface (line ~125):

```typescript
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
  readonly difficulty?: IssueDifficulty;  // issue-specific
  readonly summary?: string;              // issue-specific
  readonly prStatus?: PRStatus;           // PR-specific
}

export interface DashboardInProgressItemData {
  readonly item: InProgressItemPayload;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DashboardInProgressCompleteData {}
```

**Step 2: Add the message interfaces**

Add after `DashboardIssuesCompleteMessage` (line ~1013):

```typescript
export interface DashboardInProgressItemMessage {
  readonly type: 'dashboard:in_progress_item';
  readonly data: DashboardInProgressItemData;
}

export interface DashboardInProgressCompleteMessage {
  readonly type: 'dashboard:in_progress_complete';
  readonly data: DashboardInProgressCompleteData;
}
```

**Step 3: Add to `ServerToClientMessage` union**

Add `DashboardInProgressItemMessage` and `DashboardInProgressCompleteMessage` to the `ServerToClientMessage` union (around line ~1082).

**Step 4: Commit**

```
git add src/types/websocket.ts
git commit -m "feat(types): add InProgressItemPayload and WS message types"
```

---

### Task 2: Add shared frontend types for in-progress items

**Files:**
- Modify: `electron-ui/shared/types/entities.ts`
- Modify: `electron-ui/shared/types/websocket-messages.ts`

**Step 1: Add entity types to `entities.ts`**

Add after the `ScoredIssue` interface (line ~192):

```typescript
// PR status for the dashboard
export type PRStatus = 'open' | 'draft';

// Item type discriminator for the in-progress panel
export type InProgressItemType = 'issue' | 'pr';

// Unified in-progress item for the dashboard
export interface InProgressItem {
  type: InProgressItemType;
  number: number;
  title: string;
  labels: ScoredIssueLabel[];
  author: ScoredIssueAuthor;
  updatedAt: string;
  createdAt: string;
  htmlUrl: string;
  difficulty?: IssueDifficulty;  // issue-specific
  summary?: string;              // issue-specific
  prStatus?: PRStatus;           // PR-specific
}
```

**Step 2: Add WS message types to `websocket-messages.ts`**

Add `InProgressItem` to the imports from `'./entities'` (line ~20).

Add to `ServerMessageType` union (around line ~77):

```typescript
  | 'dashboard:in_progress_item'
  | 'dashboard:in_progress_complete'
```

Remove `'dashboard:in_progress'` from `ServerMessageType`.

Add new message interfaces after `DashboardIssuesCompleteMessage` (line ~656):

```typescript
/** A single in-progress item streamed from the backend. */
export interface DashboardInProgressItemMessage extends BaseMessage {
  type: 'dashboard:in_progress_item';
  payload: {
    item: InProgressItem;
  };
}

/** Signal that all in-progress items have been streamed. */
export interface DashboardInProgressCompleteMessage extends BaseMessage {
  type: 'dashboard:in_progress_complete';
  payload: Record<string, never>;
}
```

Remove `DashboardInProgressMessage` interface (lines ~285-296).

Add `DashboardInProgressItemMessage` and `DashboardInProgressCompleteMessage` to the `ServerMessage` union. Remove `DashboardInProgressMessage` from the union.

**Step 3: Commit**

```
git add electron-ui/shared/types/entities.ts electron-ui/shared/types/websocket-messages.ts
git commit -m "feat(shared): add InProgressItem entity and WS message types"
```

---

### Task 3: Add `getInProgressIssueNumbers` DB query

**Files:**
- Modify: `src/database/queries/sessions.ts`
- Create: `src/database/queries/__tests__/sessions.test.ts`

**Step 1: Write the failing test**

Create `src/database/queries/__tests__/sessions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, destroyTestDatabase } from '../../test-helpers.js';
import { createSession, type CreateSessionInput } from '../sessions.js';
import { getInProgressIssueNumbers } from '../sessions.js';
import type { AppDatabase } from '../../db.js';

describe('getInProgressIssueNumbers', () => {
  let db: AppDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await destroyTestDatabase(db);
  });

  it('returns empty array when no active sessions', async () => {
    const result = await getInProgressIssueNumbers(db);
    expect(result).toEqual([]);
  });

  it('returns issue numbers from active sessions', async () => {
    await createSession(db, {
      project_dir: '/test',
      status: 'active',
      started_at: new Date().toISOString(),
      issue_number: 42,
      issue_title: 'Test issue',
    });
    await createSession(db, {
      project_dir: '/test',
      status: 'active',
      started_at: new Date().toISOString(),
      issue_number: 99,
      issue_title: 'Another issue',
    });

    const result = await getInProgressIssueNumbers(db);
    expect(result).toEqual(expect.arrayContaining([42, 99]));
    expect(result).toHaveLength(2);
  });

  it('excludes completed sessions', async () => {
    await createSession(db, {
      project_dir: '/test',
      status: 'active',
      started_at: new Date().toISOString(),
      issue_number: 42,
      issue_title: 'Active',
    });
    await createSession(db, {
      project_dir: '/test',
      status: 'completed',
      started_at: new Date().toISOString(),
      issue_number: 99,
      issue_title: 'Completed',
    });

    const result = await getInProgressIssueNumbers(db);
    expect(result).toEqual([42]);
  });

  it('excludes sessions without issue numbers', async () => {
    await createSession(db, {
      project_dir: '/test',
      status: 'active',
      started_at: new Date().toISOString(),
    });

    const result = await getInProgressIssueNumbers(db);
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs && pnpm vitest run src/database/queries/__tests__/sessions.test.ts`

Expected: FAIL — `getInProgressIssueNumbers` is not exported.

> **Note:** Check if `createTestDatabase` / `destroyTestDatabase` helpers exist. If not, check existing test files for the pattern used to set up test databases (search for `vitest` + `database` in test files). Adapt the test setup to match the project's existing test patterns.

**Step 3: Implement the query**

Add to `src/database/queries/sessions.ts` after the `updateSession` function:

```typescript
/**
 * Returns issue numbers from all active sessions that have a non-null issue_number.
 * Used by the dashboard in-progress flow to identify which issues are being worked on.
 */
export async function getInProgressIssueNumbers(db: AppDatabase): Promise<number[]> {
  const rows = await db
    .selectFrom('sessions')
    .select('issue_number')
    .where('status', '=', 'active')
    .where('issue_number', 'is not', null)
    .execute();

  return rows.map((row) => row.issue_number as number);
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs && pnpm vitest run src/database/queries/__tests__/sessions.test.ts`

Expected: PASS

**Step 5: Commit**

```
git add src/database/queries/sessions.ts src/database/queries/__tests__/sessions.test.ts
git commit -m "feat(db): add getInProgressIssueNumbers query"
```

---

### Task 4: Create in-progress backend flow

**Files:**
- Create: `src/dashboard/flows/in-progress.ts`

**Step 1: Create the in-progress flow**

Create `src/dashboard/flows/in-progress.ts`:

```typescript
// Dashboard Flow: In-progress issues + authored PRs streaming.
//
// Pipeline:
//   1. Query local DB for active sessions with issue_number
//   2. Fetch those issues from GitHub API, enrich with summary/difficulty
//   3. Fetch open PRs authored by authenticated user
//   4. Stream each as InProgressItem to requesting client
//   5. Send completion signal
//   6. Return set of in-progress issue numbers for exclusion

import { getOctokit, getAuthenticatedUser } from '../../github/client.js';
import { summarizeIssue } from '../../github/summarize.js';
import { getDatabase } from '../../database/db.js';
import { getActiveSessionId } from '../../mcp/session.js';
import { getInProgressIssueNumbers } from '../../database/queries/sessions.js';
import { getAllDreyfus } from '../../database/queries/dreyfus.js';
import { sendToClient } from '../../websocket/server.js';
import type {
  InProgressItemPayload,
  ScoredIssueLabel,
  ScoredIssueAuthor,
  DashboardInProgressItemMessage,
  DashboardInProgressCompleteMessage,
} from '../../types/websocket.js';

/** Shape returned by octokit.rest.issues.get (subset we use). */
interface OctokitIssueDetail {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  updated_at: string;
  created_at: string;
  comments: number;
  user: { login: string; avatar_url: string } | null;
  labels: Array<{ name?: string; color?: string } | string>;
}

/** Shape returned by octokit.rest.pulls.list (subset we use). */
interface OctokitPR {
  number: number;
  title: string;
  html_url: string;
  updated_at: string;
  created_at: string;
  draft: boolean;
  user: { login: string; avatar_url: string } | null;
  labels: Array<{ name?: string; color?: string } | string>;
}

/**
 * Fetches in-progress issues and authored PRs, streams them to client.
 * Returns the set of in-progress issue numbers for use in excluding
 * them from the main issues panel.
 */
export async function assembleAndStreamInProgress(
  owner: string,
  repo: string,
  connectionId: string,
): Promise<Set<number>> {
  const db = getDatabase();
  const inProgressNumbers = new Set<number>();

  // Step 1: Get in-progress issue numbers from local DB
  if (db !== null) {
    const numbers = await getInProgressIssueNumbers(db);
    for (const n of numbers) {
      inProgressNumbers.add(n);
    }
  }

  const octokit = getOctokit();
  if (octokit === null) {
    sendToClient(connectionId, {
      type: 'dashboard:in_progress_complete',
      data: {},
    } as DashboardInProgressCompleteMessage);
    return inProgressNumbers;
  }

  // Step 2: Fetch and stream in-progress issues
  if (inProgressNumbers.size > 0) {
    const sessionId = getActiveSessionId();
    let dreyfusContext = 'No skill assessments available';
    if (db !== null) {
      const assessments = await getAllDreyfus(db);
      if (assessments.length > 0) {
        dreyfusContext = assessments
          .map((a) => `${a.skill_area}: ${a.stage} (confidence: ${String(a.confidence)})`)
          .join(', ');
      }
    }

    for (const issueNumber of inProgressNumbers) {
      try {
        const { data: issue } = await octokit.rest.issues.get({
          owner,
          repo,
          issue_number: issueNumber,
        });

        const octokitIssue = issue as unknown as OctokitIssueDetail;
        const labels = normalizeLabels(octokitIssue.labels);

        const { summary, difficulty } = await summarizeIssue(
          {
            number: octokitIssue.number,
            title: octokitIssue.title,
            body: octokitIssue.body,
            updated_at: octokitIssue.updated_at,
            labels,
          },
          dreyfusContext,
          sessionId,
        );

        const item: InProgressItemPayload = {
          type: 'issue',
          number: octokitIssue.number,
          title: octokitIssue.title,
          labels: labels.map((l): ScoredIssueLabel => ({ name: l.name, color: l.color })),
          author: toAuthor(octokitIssue.user),
          updatedAt: octokitIssue.updated_at,
          createdAt: octokitIssue.created_at,
          htmlUrl: octokitIssue.html_url,
          difficulty,
          summary,
        };

        sendToClient(connectionId, {
          type: 'dashboard:in_progress_item',
          data: { item },
        } as DashboardInProgressItemMessage);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[dashboard:in-progress] Failed to fetch issue #${String(issueNumber)}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  // Step 3: Fetch open PRs authored by the authenticated user
  try {
    const user = await getAuthenticatedUser();
    if (user !== null) {
      const { data: prs } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'open',
        per_page: 50,
        sort: 'updated',
        direction: 'desc',
      });

      // Filter to PRs authored by the authenticated user
      const authoredPRs = (prs as unknown as OctokitPR[]).filter(
        (pr) => pr.user?.login === user.login,
      );

      for (const pr of authoredPRs) {
        const labels = normalizeLabels(pr.labels);
        const item: InProgressItemPayload = {
          type: 'pr',
          number: pr.number,
          title: pr.title,
          labels: labels.map((l): ScoredIssueLabel => ({ name: l.name, color: l.color })),
          author: toAuthor(pr.user),
          updatedAt: pr.updated_at,
          createdAt: pr.created_at,
          htmlUrl: pr.html_url,
          prStatus: pr.draft ? 'draft' : 'open',
        };

        sendToClient(connectionId, {
          type: 'dashboard:in_progress_item',
          data: { item },
        } as DashboardInProgressItemMessage);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[dashboard:in-progress] Failed to fetch PRs:',
      err instanceof Error ? err.message : err,
    );
  }

  // Step 4: Signal completion
  sendToClient(connectionId, {
    type: 'dashboard:in_progress_complete',
    data: {},
  } as DashboardInProgressCompleteMessage);

  return inProgressNumbers;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeLabels(
  labels: Array<{ name?: string; color?: string } | string>,
): Array<{ name: string; color: string }> {
  return labels
    .map((label) => {
      if (typeof label === 'string') {
        return { name: label, color: '666666' };
      }
      return { name: label.name ?? '', color: label.color ?? '666666' };
    })
    .filter((l) => l.name !== '');
}

function toAuthor(user: { login: string; avatar_url: string } | null): ScoredIssueAuthor {
  if (user === null) {
    return { login: '', avatarUrl: '' };
  }
  return { login: user.login, avatarUrl: user.avatar_url };
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs && pnpm typecheck`

Expected: PASS (no type errors)

**Step 3: Commit**

```
git add src/dashboard/flows/in-progress.ts
git commit -m "feat(dashboard): add in-progress streaming flow"
```

---

### Task 5: Modify issues flow to accept exclusion set

**Files:**
- Modify: `src/dashboard/flows/issues.ts`

**Step 1: Update `assembleAndStreamIssues` signature and filter**

Change the function signature (line ~57) to accept an exclusion set:

```typescript
export async function assembleAndStreamIssues(
  owner: string,
  repo: string,
  connectionId: string,
  excludeIssueNumbers?: Set<number>,
): Promise<void> {
```

After filtering out PRs (line ~83), add an additional filter:

```typescript
  const issues = (rawIssues as OctokitIssue[])
    .filter((issue) => issue.pull_request === undefined)
    .filter((issue) => !excludeIssueNumbers?.has(issue.number));
```

**Step 2: Verify it compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs && pnpm typecheck`

Expected: PASS

**Step 3: Commit**

```
git add src/dashboard/flows/issues.ts
git commit -m "feat(dashboard): filter excluded issues from issues flow"
```

---

### Task 6: Update dashboard handler to orchestrate in-progress + issues

**Files:**
- Modify: `src/dashboard/handler.ts`

**Step 1: Import the new flow and update orchestration**

Add import (line ~10):

```typescript
import { assembleAndStreamInProgress } from './flows/in-progress.js';
```

Update `DashboardResult` to include `in_progress`:

```typescript
export interface DashboardResult {
  flowsCompleted: {
    state: boolean;
    in_progress: boolean;
    issues: boolean;
    challenges: boolean;
    learning_materials: boolean;
  };
}
```

In `handleDashboardRequest`, add `in_progress: false` to `flowStatus`.

Replace the issues flow in the concurrent block. The in-progress flow must run first to get the exclusion set, then issues runs with that set. Change the flow block (lines ~76-111) to:

```typescript
  // Flow 2: In-progress items + issues (sequential dependency)
  // In-progress runs first to get exclusion set, then issues uses it
  const inProgressAndIssues = (async () => {
    let excludeNumbers = new Set<number>();
    try {
      excludeNumbers = await assembleAndStreamInProgress(owner, repo, connectionId);
      flowStatus.in_progress = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'In-progress flow failed';
      // eslint-disable-next-line no-console
      console.error('[dashboard] Flow 2a (in-progress) failed:', message);
    }

    try {
      await assembleAndStreamIssues(owner, repo, connectionId, excludeNumbers);
      flowStatus.issues = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Issues flow failed';
      // eslint-disable-next-line no-console
      console.error('[dashboard] Flow 2b (issues) failed:', message);
    }
  })();

  const flowPromises = [
    inProgressAndIssues,

    // Flow 3: Active challenges
    assembleChallenges()
      .then((data) => {
        broadcast({ type: 'dashboard:challenges', data });
        flowStatus.challenges = true;
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[dashboard] Flow 3 (challenges) failed:', err);
      }),

    // Flow 4: Learning materials
    assembleLearningMaterials()
      .then((data) => {
        if (data !== null) {
          broadcast({ type: 'dashboard:materials', data });
        }
        flowStatus.learning_materials = true;
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[dashboard] Flow 4 (learning) failed:', err);
      }),
  ];
```

Also update `handleDashboardRefreshIssues` to run in-progress first:

```typescript
export async function handleDashboardRefreshIssues(
  connectionId: string,
  owner: string,
  repo: string,
): Promise<void> {
  try {
    const excludeNumbers = await assembleAndStreamInProgress(owner, repo, connectionId);
    await assembleAndStreamIssues(owner, repo, connectionId, excludeNumbers);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Issues refresh failed';
    // eslint-disable-next-line no-console
    console.error('[dashboard] Issues refresh failed:', message);
  }
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs && pnpm typecheck`

Expected: PASS

**Step 3: Commit**

```
git add src/dashboard/handler.ts
git commit -m "feat(dashboard): orchestrate in-progress flow before issues"
```

---

### Task 7: Create shared `SortButton` component

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/SortButton.tsx`

**Step 1: Create the component**

```typescript
/**
 * SortButton -- Cycles through sort options on click.
 *
 * Displays the current sort label with a directional arrow indicator.
 * Shared between InProgress and GitHubIssues panels.
 */

export interface SortOption<T extends string = string> {
  key: T;
  label: string;
  direction: 'asc' | 'desc';
}

interface SortButtonProps<T extends string = string> {
  options: SortOption<T>[];
  current: T;
  onChange: (key: T) => void;
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  padding: '4px 8px',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, color 0.15s ease',
  whiteSpace: 'nowrap',
};

function ArrowIcon({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
      style={{ transform: direction === 'asc' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M6 8L2 4h8L6 8z" />
    </svg>
  );
}

export function SortButton<T extends string = string>({
  options,
  current,
  onChange,
}: SortButtonProps<T>) {
  const currentIndex = options.findIndex((o) => o.key === current);
  const currentOption = options[currentIndex] ?? options[0];

  const handleClick = () => {
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(options[nextIndex].key);
  };

  return (
    <button
      type="button"
      style={buttonStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      aria-label={`Sort by ${currentOption.label}`}
      title={`Sort by ${currentOption.label}`}
    >
      {currentOption.label}
      <ArrowIcon direction={currentOption.direction} />
    </button>
  );
}
```

**Step 2: Commit**

```
git add electron-ui/renderer/src/components/Dashboard/SortButton.tsx
git commit -m "feat(ui): add shared SortButton component"
```

---

### Task 8: Create `InProgress.tsx` component (replaces InProgressTasks)

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/InProgress.tsx`
- Delete: `electron-ui/renderer/src/components/Dashboard/InProgressTasks.tsx`

**Step 1: Create the component**

```typescript
/**
 * InProgress -- Dashboard section showing in-progress issues and authored PRs.
 *
 * Manages its own WebSocket subscriptions:
 *   - `dashboard:in_progress_item` -- individual items streamed one at a time
 *   - `dashboard:in_progress_complete` -- signal that all items have been sent
 *
 * Features:
 *   - Progressive rendering: items accumulate into state as they arrive
 *   - Filter dropdown: show all / issues only / PRs only
 *   - Sort button: updated desc/asc, title desc/asc
 *   - Different row background tints for issues vs PRs
 *   - Skeleton placeholders while waiting for first item
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { InProgressItem, IssueDifficulty } from '@shared/types/entities';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import { useWebSocket } from '../../hooks/useWebSocket';
import { SortButton, type SortOption } from './SortButton';
import { DifficultyIcon } from './DifficultyIcon';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterMode = 'all' | 'issues' | 'prs';
type SortKey = 'updated_desc' | 'updated_asc' | 'title_desc' | 'title_asc';

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { key: 'updated_desc', label: 'Updated (newest)', direction: 'desc' },
  { key: 'updated_asc', label: 'Updated (oldest)', direction: 'asc' },
  { key: 'title_desc', label: 'Title (Z-A)', direction: 'desc' },
  { key: 'title_asc', label: 'Title (A-Z)', direction: 'asc' },
];

// ---------------------------------------------------------------------------
// Difficulty labels
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS: Record<IssueDifficulty, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
  extreme: 'Extreme',
};

// ---------------------------------------------------------------------------
// Label contrast helper
// ---------------------------------------------------------------------------

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a18' : '#faf9f5';
}

// ---------------------------------------------------------------------------
// Sort comparator
// ---------------------------------------------------------------------------

function sortItems(items: InProgressItem[], sortKey: SortKey): InProgressItem[] {
  const sorted = [...items];
  switch (sortKey) {
    case 'updated_desc':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'updated_asc':
      return sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    case 'title_desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case 'title_asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-sm)',
};

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  padding: '4px 8px',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

const listContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflowY: 'auto',
};

const issueRowStyle = (index: number): React.CSSProperties => ({
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  overflow: 'hidden',
  padding: 'var(--space-xs) var(--space-md)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 'var(--space-md)',
  background: index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
});

const prRowStyle = (index: number): React.CSSProperties => ({
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  overflow: 'hidden',
  padding: 'var(--space-xs) var(--space-md)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 'var(--space-md)',
  background: index % 2 === 0 ? 'rgba(217, 119, 87, 0.04)' : 'rgba(217, 119, 87, 0.08)',
});

const numberStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  lineHeight: 1.4,
  margin: 0,
  flex: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const prBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: 'rgba(217, 119, 87, 0.15)',
  color: 'var(--accent-warm)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const labelPillStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: color.startsWith('#') ? color : `#${color}`,
  color: getContrastColor(color),
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
});

const overflowPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-muted)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const timeStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  whiteSpace: 'nowrap',
};

const skeletonStyle: React.CSSProperties = {
  borderRadius: '4px',
  height: '32px',
  background: 'var(--bg-elevated)',
  animation: 'breathe 2s ease-in-out infinite',
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  textAlign: 'center',
  padding: 'var(--space-md)',
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LabelPills({ labels, maxVisible }: { labels: InProgressItem['labels']; maxVisible: number }) {
  const visible = labels.slice(0, maxVisible);
  const overflowCount = labels.length - maxVisible;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
      {visible.map((label) => (
        <span key={label.name} style={labelPillStyle(label.color)}>
          {label.name}
        </span>
      ))}
      {overflowCount > 0 && <span style={overflowPillStyle}>+{overflowCount}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const cardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InProgress() {
  const { on } = useWebSocket();

  const [items, setItems] = useState<InProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated_desc');

  // Subscribe to streaming in-progress messages
  useEffect(() => {
    setItems([]);
    setLoading(true);

    const unsubs = [
      on('dashboard:in_progress_item', (msg: WebSocketMessage) => {
        const m = msg as { payload: { item: InProgressItem } };
        setItems((prev) => {
          // Avoid duplicates by number + type
          if (prev.some((i) => i.number === m.payload.item.number && i.type === m.payload.item.type)) {
            return prev;
          }
          return [...prev, m.payload.item];
        });
        setLoading(false);
      }),
      on('dashboard:in_progress_complete', () => {
        setLoading(false);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [on]);

  // Filter and sort
  const displayItems = useMemo(() => {
    let filtered = items;
    if (filter === 'issues') {
      filtered = items.filter((i) => i.type === 'issue');
    } else if (filter === 'prs') {
      filtered = items.filter((i) => i.type === 'pr');
    }
    return sortItems(filtered, sortKey);
  }, [items, filter, sortKey]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value as FilterMode);
  }, []);

  const handleItemClick = useCallback((item: InProgressItem) => {
    window.open(item.htmlUrl, '_blank');
  }, []);

  const getRowStyle = (item: InProgressItem, index: number) => {
    return item.type === 'pr' ? prRowStyle(index) : issueRowStyle(index);
  };

  const getHoverBg = (item: InProgressItem, index: number) => {
    if (item.type === 'pr') {
      return index % 2 === 0 ? 'rgba(217, 119, 87, 0.04)' : 'rgba(217, 119, 87, 0.08)';
    }
    return index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)';
  };

  return (
    <section style={containerStyle} aria-label="In-progress items">
      {/* Header */}
      <div style={headerRowStyle}>
        <pre className="figlet-header" style={{ fontSize: '18px', margin: 0 }}>
          IN PROGRESS
        </pre>
        <div style={controlsStyle}>
          <select
            style={selectStyle}
            value={filter}
            onChange={handleFilterChange}
            aria-label="Filter items"
          >
            <option value="all">Show All</option>
            <option value="issues">Show Issues</option>
            <option value="prs">Show PRs</option>
          </select>
          <SortButton options={SORT_OPTIONS} current={sortKey} onChange={setSortKey} />
        </div>
      </div>

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div style={listContainerStyle} role="status" aria-label="Loading in-progress items">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ ...skeletonStyle, animationDelay: `${i * 150}ms`, marginBottom: '4px' }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <p style={emptyStyle}>No issues in progress. Select an issue below to get started.</p>
      )}

      {/* Items list */}
      {displayItems.length > 0 && (
        <div style={listContainerStyle}>
          <AnimatePresence mode="popLayout">
            {displayItems.map((item, index) => (
              <motion.div
                key={`${item.type}-${item.number}`}
                layoutId={`inprogress-${item.type}-${item.number}`}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={getRowStyle(item, index)}
                onClick={() => handleItemClick(item)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = getHoverBg(item, index);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                aria-label={`${item.type === 'pr' ? 'PR' : 'Issue'} #${item.number}: ${item.title}`}
              >
                <span style={numberStyle}>#{item.number}</span>
                <p style={titleStyle}>{item.title}</p>

                {/* Type-specific badge */}
                {item.type === 'issue' && item.difficulty && (
                  <span style={badgeStyle}>
                    <DifficultyIcon level={item.difficulty} size={16} />
                    {DIFFICULTY_LABELS[item.difficulty]}
                  </span>
                )}
                {item.type === 'pr' && (
                  <span style={prBadgeStyle}>
                    {item.prStatus === 'draft' ? 'Draft' : 'PR'}
                  </span>
                )}

                {item.labels.length > 0 && <LabelPills labels={item.labels} maxVisible={3} />}
                <span style={timeStyle}>{formatRelativeTime(item.updatedAt)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
```

**Step 2: Delete `InProgressTasks.tsx`**

```bash
rm electron-ui/renderer/src/components/Dashboard/InProgressTasks.tsx
```

**Step 3: Verify it compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs/electron-ui && npm run typecheck`

Expected: May fail due to Dashboard.tsx still importing InProgressTasks. That's fixed in Task 10.

**Step 4: Commit**

```
git add electron-ui/renderer/src/components/Dashboard/InProgress.tsx
git rm electron-ui/renderer/src/components/Dashboard/InProgressTasks.tsx
git commit -m "feat(ui): add InProgress component, remove InProgressTasks"
```

---

### Task 9: Add sort button to GitHubIssues panel

**Files:**
- Modify: `electron-ui/renderer/src/components/Dashboard/GitHubIssues.tsx`

**Step 1: Add sort state, import SortButton, apply sorting**

Add imports at the top:

```typescript
import { SortButton, type SortOption } from './SortButton';
```

Add sort options constant and sort function after the existing styles:

```typescript
type SortKey = 'updated_desc' | 'updated_asc' | 'title_desc' | 'title_asc';

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { key: 'updated_desc', label: 'Updated (newest)', direction: 'desc' },
  { key: 'updated_asc', label: 'Updated (oldest)', direction: 'asc' },
  { key: 'title_desc', label: 'Title (Z-A)', direction: 'desc' },
  { key: 'title_asc', label: 'Title (A-Z)', direction: 'asc' },
];

function sortIssues(issues: ScoredIssue[], sortKey: SortKey): ScoredIssue[] {
  const sorted = [...issues];
  switch (sortKey) {
    case 'updated_desc':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'updated_asc':
      return sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    case 'title_desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case 'title_asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}
```

Add `useMemo` to existing imports from 'react'. Add sort state inside the component:

```typescript
const [sortKey, setSortKey] = useState<SortKey>('updated_desc');
```

Add sorted issues derivation:

```typescript
const sortedIssues = useMemo(() => sortIssues(issues, sortKey), [issues, sortKey]);
```

Replace `issues` with `sortedIssues` in the render (the `.map()` in the AnimatePresence block).

In the header row, add the SortButton next to the layout toggle. Change the header controls area to wrap both:

```typescript
<div style={headerRowStyle}>
  <pre className="figlet-header" style={{ fontSize: '18px', margin: 0 }}>
    ISSUES
  </pre>
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
    <SortButton options={SORT_OPTIONS} current={sortKey} onChange={setSortKey} />
    <IssueLayoutToggle current={layout} onChange={setLayout} />
  </div>
</div>
```

**Step 2: Verify it compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs/electron-ui && npm run typecheck`

Expected: May fail due to Dashboard.tsx still importing InProgressTasks. Fixed in Task 10.

**Step 3: Commit**

```
git add electron-ui/renderer/src/components/Dashboard/GitHubIssues.tsx
git commit -m "feat(ui): add sort button to issues panel"
```

---

### Task 10: Update Dashboard.tsx to use InProgress

**Files:**
- Modify: `electron-ui/renderer/src/views/Dashboard.tsx`

**Step 1: Replace InProgressTasks with InProgress**

Replace the `InProgressTasks` import with:

```typescript
import { InProgress } from '../components/Dashboard/InProgress';
```

Remove these from the component:
- `DashboardInProgressMessage` from the import of websocket-messages types
- `inProgressTasks` state (`useState` on line ~79-81)
- The `dashboard:in_progress` subscription in the `useEffect` (lines ~100-103)
- `handleResumeTask` callback (lines ~132-137)
- `hasInProgressTasks` variable (line ~144)

Remove the `emptyInProgressStyle` and `emptyInProgressTextStyle` style objects (lines ~51-69).

Replace the Row 2 in-progress section (the conditional `hasInProgressTasks` block, lines ~168-180) with:

```typescript
<InProgress />
```

So Row 2 becomes:

```typescript
{/* Row 2: In-Progress (62%) + Practice Challenges (38%) */}
<div style={{ ...gridRowStyle, gridTemplateColumns: '62fr 38fr' }}>
  <InProgress />
  <PracticeChallenges challenges={challenges} onChallengeClick={handlePlaceholderNav} />
</div>
```

**Step 2: Verify it compiles**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs/electron-ui && npm run typecheck`

Expected: PASS

**Step 3: Commit**

```
git add electron-ui/renderer/src/views/Dashboard.tsx
git commit -m "feat(ui): use InProgress component in Dashboard"
```

---

### Task 11: Run full typecheck and lint on both projects

**Files:** None (verification only)

**Step 1: Backend typecheck + lint**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs && pnpm typecheck && pnpm lint`

Expected: PASS. Fix any errors.

**Step 2: Frontend typecheck + lint**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs/electron-ui && npm run typecheck && npm run lint`

Expected: PASS. Fix any errors.

**Step 3: Run existing tests**

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs && pnpm test`

Run: `cd /Users/aaronbassett/Projects/paige/.worktrees/dashboard-open-issues-prs/electron-ui && npm test`

Expected: All existing tests pass. Fix any breakages caused by our changes.

**Step 4: Commit any fixes**

```
git add -A
git commit -m "fix: resolve typecheck and lint issues from in-progress panel"
```
