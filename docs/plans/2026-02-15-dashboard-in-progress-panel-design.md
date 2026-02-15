# Dashboard In-Progress Panel Design

**Date**: 2026-02-15
**Branch**: dashboard-open-issues-prs

## Summary

Replace the existing `InProgressTasks` panel (which shows generic tasks with progress bars) with a new `InProgress` panel that shows GitHub issues the user has begun working on (tracked in local DB) and open PRs the user has authored (fetched from GitHub API). Issues shown in the in-progress panel are excluded from the issues panel.

## Requirements

- In-progress panel shows issues + PRs in a unified list view
- Issues are marked in-progress when a coaching session starts for that issue (already tracked in `sessions` table)
- PRs are fetched from GitHub API (open PRs authored by authenticated user)
- Slightly different row background colors for issues vs PRs
- Filter dropdown (top-right): "Show All" (default), "Show Issues", "Show PRs"
- Sort button (next to dropdown): cycles through Updated newest/oldest, Title A-Z/Z-A
- Same sort button added to the issues panel
- Issues in the in-progress panel are excluded from the issues panel

## Data Model

### New Shared Types (`entities.ts`)

```typescript
export type PRStatus = 'open' | 'draft';

export interface DashboardPR {
  number: number;
  title: string;
  status: PRStatus;
  labels: ScoredIssueLabel[];
  author: ScoredIssueAuthor;
  updatedAt: string;
  createdAt: string;
  htmlUrl: string;
  linkedIssueNumber?: number;
}

export type InProgressItemType = 'issue' | 'pr';

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

### No DB Changes

The existing `sessions` table already has `issue_number` (nullable integer) and `status` ('active'/'completed'). An issue is "in progress" when there's a session row with that `issue_number` and `status = 'active'`.

## WebSocket Protocol

### New Messages

- `dashboard:in_progress_item` (server->client): Streams a single `InProgressItem`
- `dashboard:in_progress_complete` (server->client): Signals all in-progress items sent

### Removed Messages

- `dashboard:in_progress`: Removed entirely (replaced by the new streaming messages)

### Message Interfaces

```typescript
export interface DashboardInProgressItemMessage extends BaseMessage {
  type: 'dashboard:in_progress_item';
  payload: { item: InProgressItem };
}

export interface DashboardInProgressCompleteMessage extends BaseMessage {
  type: 'dashboard:in_progress_complete';
  payload: Record<string, never>;
}
```

No new client-to-server messages needed. The in-progress flow is triggered by the existing `dashboard:stats_period` / `dashboard:request` messages.

## Backend

### New: `src/dashboard/flows/in-progress.ts`

Pipeline:
1. Query local DB for active sessions with non-null `issue_number` -> set of in-progress issue numbers
2. Fetch those specific issues from GitHub API and enrich with scoring/summary (reuse `summarizeIssue`)
3. Fetch open PRs authored by authenticated user (`octokit.rest.pulls.list`)
4. Map both to `InProgressItem` and stream via `dashboard:in_progress_item`
5. Send `dashboard:in_progress_complete`
6. Return the set of in-progress issue numbers to caller

### New: DB Query (`src/database/queries/sessions.ts`)

```typescript
export async function getInProgressIssueNumbers(db: AppDatabase): Promise<number[]>
// SELECT issue_number FROM sessions WHERE status = 'active' AND issue_number IS NOT NULL
```

### Modified: `src/dashboard/flows/issues.ts`

- `assembleAndStreamIssues` receives a `Set<number>` of in-progress issue numbers
- Filters them out before scoring/streaming

### Modified: `src/dashboard/handler.ts`

- Run in-progress flow first, get back set of in-progress issue numbers
- Pass that set to issues flow

## Frontend

### New: `InProgress.tsx` (replaces `InProgressTasks.tsx`)

- Own WebSocket subscriptions: `dashboard:in_progress_item`, `dashboard:in_progress_complete`
- List view (always list mode, matching issues panel list style)
- Row backgrounds:
  - Issues: `transparent` / `rgba(255, 255, 255, 0.02)` alternating
  - PRs: `rgba(217, 119, 87, 0.04)` / `rgba(217, 119, 87, 0.08)` alternating (terracotta wash)
- Row content: `#number`, title (1-line truncated), difficulty badge (issues) or PR status badge (PRs), labels (max 3), relative time
- Internal skeleton loading + empty state
- Header controls: filter dropdown + sort button

### New: Shared `SortButton` Component

- Accepts sort options array, current sort key, `onSortChange` callback
- Renders button with current sort label + directional arrow
- Cycles through options on click
- Used by both `InProgress.tsx` and `GitHubIssues.tsx`

### Modified: `GitHubIssues.tsx`

- Add `SortButton` next to existing `IssueLayoutToggle` in header
- Same 4 sort options (updated desc/asc, title desc/asc)
- Client-side sort on issues array before rendering

### Modified: `Dashboard.tsx`

- Remove `inProgressTasks` state and `dashboard:in_progress` subscription
- Remove empty-state conditional for in-progress section
- Render `<InProgress />` unconditionally (it handles its own empty state)

## File Summary

| File | Action |
|------|--------|
| `electron-ui/shared/types/entities.ts` | Add `DashboardPR`, `InProgressItem`, `InProgressItemType`, `PRStatus` |
| `electron-ui/shared/types/websocket-messages.ts` | Add new message types, remove old `dashboard:in_progress` |
| `src/dashboard/flows/in-progress.ts` | New — in-progress streaming flow |
| `src/dashboard/flows/issues.ts` | Modified — accept exclusion set |
| `src/dashboard/handler.ts` | Modified — run in-progress first, pass exclusion set |
| `src/database/queries/sessions.ts` | Add `getInProgressIssueNumbers` |
| `src/types/websocket.ts` | Add backend WS message types |
| `electron-ui/renderer/src/components/Dashboard/InProgress.tsx` | New — replaces InProgressTasks.tsx |
| `electron-ui/renderer/src/components/Dashboard/InProgressTasks.tsx` | Deleted |
| `electron-ui/renderer/src/components/Dashboard/SortButton.tsx` | New — shared sort button |
| `electron-ui/renderer/src/components/Dashboard/GitHubIssues.tsx` | Modified — add sort button |
| `electron-ui/renderer/src/views/Dashboard.tsx` | Modified — simplify in-progress rendering |
