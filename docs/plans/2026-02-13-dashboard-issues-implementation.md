# Implementation Plan: Dashboard Issues & Landing Page

## Context

Paige is a hackathon project (one-week, solo dev) for a junior developer coaching tool. The app currently opens to the IDE view and has a basic dashboard with skeleton GitHub issues fetched via `gh` CLI. We need to:

1. Add a Landing page (repo picker) as the new default view
2. Replace `gh` CLI with octokit.js for GitHub API access
3. Implement issue scoring, Claude-powered summarization with caching, and streaming delivery
4. Redesign issue cards with 3 layout modes, animated entrance, and issue modal

Design doc: `docs/plans/2026-02-13-dashboard-issues-design.md`

---

## Step 1: Install Dependencies & Config

**Install packages:**
- Root: `pnpm add octokit keyv`
- Electron UI: `cd electron-ui && pnpm add @nivo/swarmplot @nivo/core react-markdown remark-gfm dayjs`

**Modify `src/config/env.ts`:**
- Add `githubToken: string | undefined` to `EnvConfig` interface
- Read `process.env['GITHUB_TOKEN']` in `loadEnv()` (optional, like `anthropicApiKey`)

**Modify `.env.example`:**
- Add `GITHUB_TOKEN=ghp_...`

**Verify:** `pnpm install && pnpm typecheck`

---

## Step 2: Add WebSocket Message Types

### Backend (`src/types/websocket.ts`)

Add new data interfaces (following existing `readonly` pattern):

**Client -> Server (4 new):**
- `ReposListRequestData` -- empty `{}`
- `ReposActivityRequestData` -- `{ repos: readonly string[] }`
- `SessionStartRepoData` -- `{ owner: string; repo: string }`
- `SessionSelectIssueWsData` -- `{ issueNumber: number }`

**Server -> Client (6 new):**
- `ReposListResponseData` -- `{ repos: readonly RepoInfo[] }` where `RepoInfo` has: `fullName`, `name`, `owner`, `description`, `language`, `stars`, `forks`, `openIssues`, `openPRs`, `license`, `updatedAt`, `pushedAt`
- `RepoActivityResponseData` -- `{ repo: string; activities: readonly RepoActivityEntry[] }` where entry has: `timestamp`, `activityType`
- `SessionRepoStartedData` -- `{ owner: string; repo: string }`
- `SessionIssueSelectedResponseData` -- `{ sessionId: number; issueNumber: number }`
- `DashboardSingleIssueData` -- `{ issue: ScoredIssuePayload }` where payload has: `number`, `title`, `body`, `summary`, `difficulty` (enum: low/medium/high/very_high/extreme), `labels` (with name+color), `author` (login+avatarUrl), `assignees`, `commentCount`, `updatedAt`, `createdAt`, `htmlUrl`, `score`
- `DashboardIssuesCompleteData` -- empty `{}`

Add message interfaces and append to `ClientToServerMessage` / `ServerToClientMessage` unions.

**Add difficulty type:**
```typescript
export type IssueDifficulty = 'low' | 'medium' | 'high' | 'very_high' | 'extreme';
```

### Backend validation (`src/websocket/schemas.ts`)

Add Zod schemas for the 4 new client->server messages, register in `messageDataSchemas`.

### Frontend entities (`electron-ui/shared/types/entities.ts`)

- Add `'landing'` to `AppView` union: `'dashboard' | 'ide' | 'placeholder' | 'landing'`
- Add `RepoInfo`, `RepoActivityEntry`, `ScoredIssue` interfaces

### Frontend messages (`electron-ui/shared/types/websocket-messages.ts`)

- Add 4 new types to `ClientMessageType`: `'repos:list'`, `'repos:activity'`, `'session:start_repo'`, `'session:select_issue'`
- Add 6 new types to `ServerMessageType`: `'repos:list_response'`, `'repo:activity'`, `'session:repo_started'`, `'session:issue_selected'`, `'dashboard:issue'`, `'dashboard:issues_complete'`
- Add corresponding message interfaces extending `BaseMessage`
- Add to `ServerMessage` and `ClientMessage` unions

**Verify:** `pnpm typecheck` (root) + `cd electron-ui && pnpm run typecheck`

---

## Step 3: GitHub Service Module (Backend)

Create `src/github/` directory with 3 files:

### `src/github/client.ts`
- Singleton `Octokit` instance from `GITHUB_TOKEN`
- `getOctokit(): Octokit | null` -- returns null if no token (graceful degradation)
- `getAuthenticatedUser()` -- cached call to `octokit.rest.users.getAuthenticated()`

### `src/github/cache.ts`
- Three Keyv instances (all in-memory Map store):
  - `repoCache` -- TTL 5 minutes
  - `activityCache` -- TTL 60 minutes
  - `summaryCache` -- TTL 1 hour, key format: `issue:{number}:{updated_at}`

### `src/github/repos.ts`
- `fetchUserRepos(): Promise<RepoInfo[]>` -- check `repoCache`, call `octokit.paginate(octokit.rest.repos.listForAuthenticatedUser)`, filter (public, not archived, has open issues), map to `RepoInfo[]`, cache result
- `fetchRepoActivity(fullName: string): Promise<RepoActivityEntry[]>` -- check `activityCache`, call `GET /repos/{owner}/{repo}/activity` for last 30 days, cache result

**Verify:** `pnpm typecheck`. Manual test with `pnpm tsx` script if needed.

---

## Step 4: Issue Scoring & Streaming Pipeline (Backend)

### Create `src/github/scoring.ts`
Pure function implementing the heuristic:
```
+5 author | +20 assignee | +(comments * 0.25)
Labels: +15 good-first-issue | +2 bug/help-wanted/enhancement | -3 security | -10 docs/question | -25 duplicate/invalid | -50 wontfix
Recency: <=5d +3 | <=15d +6 | >15d -(days * 0.1)
Body: <50ch -25 | <200ch -15 | <400ch -5
```
Export `scoreIssue(issue, currentUserLogin)` and `sortAndTakeTop(issues, n)`.

### Create `src/github/summarize.ts`
- `summarizeIssue(issue, dreyfusContext, sessionId)`:
  1. Check `summaryCache` with key `issue:{number}:{updated_at}`
  2. Cache miss -> `callApi()` with Haiku, new `issueSummarySchema`
  3. System prompt includes Dreyfus context for personalized difficulty
  4. Cache and return `{ summary, difficulty }`

### Add schema (`src/api-client/schemas.ts`)
```typescript
export const issueSummarySchema = z.object({
  summary: z.string(),
  difficulty: z.enum(['low', 'medium', 'high', 'very_high', 'extreme']),
});
```

### Add to domain types (`src/types/domain.ts`)
- Add `'issue_summary'` to `ApiCallType` union

### Rewrite `src/dashboard/flows/issues.ts`
New `assembleAndStreamIssues(owner, repo, connectionId)`:
1. `fetchRepoIssues()` via octokit (filter out PRs)
2. `getAuthenticatedUser()` for scoring
3. Score all issues with `scoreIssue()`
4. Take top 15
5. Load Dreyfus context from DB
6. For each issue, call `summarizeIssue()` then `sendToClient(connectionId, { type: 'dashboard:issue', data: { issue } })`
7. After all complete, send `dashboard:issues_complete`

Uses `sendToClient()` (not `broadcast()`) since issues are per-connection.

### Update `src/dashboard/handler.ts`
- Flow 2 now calls `assembleAndStreamIssues(owner, repo, connectionId)` instead of `assembleIssues(sessionId)`
- Pass `connectionId` through from the WebSocket handler
- Keep existing Flows 1, 3, 4 as-is

**Verify:** Start server, send `dashboard:request` via wscat, observe individual `dashboard:issue` messages.

---

## Step 5: Backend WebSocket Handlers

### Create `src/websocket/handlers/repos.ts`
- `handleReposList(ws, data, connectionId)` -> calls `fetchUserRepos()`, sends `repos:list_response` to client
- `handleReposActivity(ws, data, connectionId)` -> for each repo in `data.repos`, calls `fetchRepoActivity()`, sends individual `repo:activity` messages as each resolves

### Create `src/websocket/handlers/session-start.ts`
- `handleSessionStartRepo(ws, data, connectionId)` -> validates owner/repo, checks `~/.paige/repos/{owner}/{repo}/` exists, runs `git clone --depth=1` if not, sends `session:repo_started`, kicks off issue streaming pipeline as a head-start
- `handleSessionSelectIssue(ws, data, connectionId)` -> creates session record in SQLite, sends `session:issue_selected`, transitions to IDE

### Update `src/websocket/router.ts`
Add 4 entries to handlers Map:
```
['repos:list', handleReposList]
['repos:activity', handleReposActivity]
['session:start_repo', handleSessionStartRepo]
['session:select_issue', handleSessionSelectIssue]
```

### Update `src/websocket/handlers/connection.ts`
- Remove `isGitHubCLIAvailable()` and its `execSync('gh auth status')` call
- Change `gh_cli_available` capability to `github_api_available: !!process.env['GITHUB_TOKEN']`

**Verify:** wscat test: send `repos:list`, confirm repos. Send `session:start_repo`, confirm clone + response.

---

## Step 6: Landing Page View (Frontend)

### Create `electron-ui/renderer/src/utils/formatRelativeTime.ts`
- dayjs + relativeTime plugin
- `formatRelativeTime(date)` -> `fromNow()` for <=30 days, `format('MMMM D, YYYY')` for older

### Create `electron-ui/renderer/src/views/Landing.tsx`
- Hardcoded ASCII art "PAIGE" in `<pre>` block (figlet `slant` or `standard` font)
- Subtitle: "Pick a project to work on"
- Toolbar: search input + Language dropdown (with vscode-icons-js language icons) + Sort dropdown (Recently used, Last updated, Name, Issue count)
- Client-side filtering, sorting, pagination (20 per page)
- Sends `repos:list` on mount via `useWebSocket().send()`
- Listens for `repos:list_response`, populates state
- Click repo row -> calls `onSelectRepo({ owner, repo })`

### Create `electron-ui/renderer/src/components/Landing/RepoRow.tsx`
- Row: name (bold), description (truncated), language dot + name, license, stars, forks, issues, PRs, relative time
- Absolute-positioned SwarmPlot background (initially empty, filled when activity data arrives)
- Hover effect: `var(--bg-elevated)`

### Create `electron-ui/renderer/src/components/Landing/LandingToolbar.tsx`
- Search input + Language dropdown + Sort dropdown
- Dropdowns use floating-ui for positioning (already a dependency)

### Create `electron-ui/renderer/src/components/Landing/ActivityPlot.tsx`
- Nivo SwarmPlot canvas wrapper
- Takes `activities: RepoActivityEntry[] | null`
- Low opacity background, fade-in animation when data arrives

### Update `electron-ui/renderer/src/components/AppShell.tsx`
- Import Landing view
- Change default: `useState<AppView>('landing')`
- Add `currentRepo` state: `useState<{ owner: string; repo: string } | null>(null)`
- Add `'landing'` case to `renderView()`
- Wire `handleSelectRepo`: sets `currentRepo`, sends `session:start_repo`, listens for `session:repo_started`, transitions to `'dashboard'`
- Update back button: from dashboard -> landing, from IDE -> dashboard
- Update header: hide back button when on landing

### Send activity requests on pagination
- Landing tracks which repos are visible on current page
- Sends `repos:activity` with visible repo fullNames
- Listens for `repo:activity` messages, updates per-repo state
- Caches client-side so page changes don't re-fetch

**Verify:** App opens to Landing. Repos load. Search, filter, sort work. Click repo -> transitions to Dashboard.

---

## Step 7: Redesigned Issue Cards (Frontend)

### Create `electron-ui/renderer/src/components/Dashboard/DifficultyIcon.tsx`
- 5 inline SVG mountain icons: low (hill) -> extreme (jagged peaks)
- Colors: body `#5C4033`, snow `#D4C5B2`, base `#3D2B1F`
- `<DifficultyIcon level="high" size={24} />`

### Create `electron-ui/renderer/src/components/Dashboard/IssueCard.tsx`
- Three layout modes: `'full' | 'condensed' | 'list'`
- Framer Motion `layoutId` per issue number for smooth layout transitions
- **Full**: title, summary, difficulty mountain+text, labels (max 3 + overflow), updated time, author avatar+name, assignees (stacked), comment count
- **Condensed**: title, difficulty icon+text, 1 label + overflow, updated time
- **List**: single row -- title, difficulty text, labels (max 3 + overflow), updated time

### Create `electron-ui/renderer/src/components/Dashboard/IssueLayoutToggle.tsx`
- 3 SVG icon buttons matching mockup (grid, condensed grid, list)
- Active state highlighted

### Create `electron-ui/renderer/src/components/Dashboard/IssueModal.tsx`
- Framer Motion overlay + modal
- Title, metadata bar, all labels, difficulty icon, body via `react-markdown` + `remark-gfm`
- "View on GitHub" button (opens `htmlUrl` in browser)
- "Work on this" button -> sends `session:select_issue`, transitions to IDE

### Rewrite `electron-ui/renderer/src/components/Dashboard/GitHubIssues.tsx`
- Manages own WebSocket subscriptions: `dashboard:issue` (individual) and `dashboard:issues_complete`
- Progressive rendering: accumulates issues into state array
- Each new card: Framer Motion entrance (fade + slide-up + scale 0.95->1.0)
- Layout state with toggle
- Skeleton placeholder while waiting for first issue
- Click opens IssueModal

### Update `electron-ui/renderer/src/views/Dashboard.tsx`
- Remove old `dashboard:issues` subscription (now handled inside GitHubIssues)
- Pass `currentRepo` for context

**Verify:** Navigate to Dashboard. Issues stream in one by one. Toggle layouts. Click issue -> modal. "Work on this" -> IDE.

---

## Step 8: End-to-End Wiring

### AppShell navigation state machine
- Landing: pick repo -> `session:start_repo` -> wait for `session:repo_started` -> Dashboard
- Dashboard: click issue -> modal -> "Work on this" -> `session:select_issue` -> wait for `session:issue_selected` -> IDE
- IDE back -> Dashboard back -> Landing

### Session start handler (`src/websocket/handlers/session-start.ts`)
- After confirming repo cloned, also kick off `assembleAndStreamIssues()` so issues start loading before user even sees Dashboard (head start)

### Dashboard handler update
- `handleDashboardRequest` now receives `owner`, `repo`, `connectionId` params
- Pass through to issue streaming pipeline

**Verify:** Full walkthrough: Landing -> pick repo -> Dashboard (issues stream in) -> click issue -> modal -> "Work on this" -> IDE. Back navigation works at each step.

---

## Step 9: Cleanup

- Remove all `execSync('gh ...')` from `src/dashboard/flows/issues.ts`
- Remove `isGitHubCLIAvailable()` from `src/websocket/handlers/connection.ts`
- Update `ConnectionInitData` capability: `github_api_available` replaces `gh_cli_available`
- Update frontend `ConnectionInitMessage` to match
- Verify: `grep -r "execSync.*gh " src/` returns nothing

**Verify:** `pnpm typecheck && pnpm lint`

---

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/config/env.ts` | Modify | Add GITHUB_TOKEN |
| `src/types/websocket.ts` | Modify | 10 new message types |
| `src/types/domain.ts` | Modify | Add issue_summary ApiCallType |
| `src/websocket/schemas.ts` | Modify | 4 new validation schemas |
| `src/websocket/router.ts` | Modify | Register 4 new handlers |
| `src/websocket/handlers/connection.ts` | Modify | Remove gh CLI check |
| `src/github/client.ts` | Create | Octokit singleton |
| `src/github/cache.ts` | Create | Keyv cache instances |
| `src/github/repos.ts` | Create | Repo + activity fetching |
| `src/github/scoring.ts` | Create | Issue scoring heuristic |
| `src/github/summarize.ts` | Create | Claude summarization + cache |
| `src/dashboard/flows/issues.ts` | Rewrite | Streaming pipeline |
| `src/dashboard/handler.ts` | Modify | Pass connectionId to Flow 2 |
| `src/api-client/schemas.ts` | Modify | Add issueSummarySchema |
| `src/websocket/handlers/repos.ts` | Create | Repo list + activity handlers |
| `src/websocket/handlers/session-start.ts` | Create | Session start + issue select |
| `electron-ui/shared/types/entities.ts` | Modify | Add landing to AppView, new interfaces |
| `electron-ui/shared/types/websocket-messages.ts` | Modify | 10 new message types |
| `electron-ui/renderer/src/components/AppShell.tsx` | Modify | Landing default, repo state, navigation |
| `electron-ui/renderer/src/views/Landing.tsx` | Create | Landing page view |
| `electron-ui/renderer/src/components/Landing/RepoRow.tsx` | Create | Repo row with activity background |
| `electron-ui/renderer/src/components/Landing/LandingToolbar.tsx` | Create | Search + filters |
| `electron-ui/renderer/src/components/Landing/ActivityPlot.tsx` | Create | Nivo SwarmPlot wrapper |
| `electron-ui/renderer/src/utils/formatRelativeTime.ts` | Create | dayjs relative time util |
| `electron-ui/renderer/src/components/Dashboard/DifficultyIcon.tsx` | Create | 5 mountain SVGs |
| `electron-ui/renderer/src/components/Dashboard/IssueCard.tsx` | Create | 3-layout issue card |
| `electron-ui/renderer/src/components/Dashboard/IssueLayoutToggle.tsx` | Create | Layout switch icons |
| `electron-ui/renderer/src/components/Dashboard/IssueModal.tsx` | Create | Issue detail modal |
| `electron-ui/renderer/src/components/Dashboard/GitHubIssues.tsx` | Rewrite | Progressive streaming |
| `electron-ui/renderer/src/views/Dashboard.tsx` | Modify | Remove old issues sub |

---

## Verification

1. **Type safety:** `pnpm typecheck` (root) + `cd electron-ui && pnpm run typecheck`
2. **Lint:** `pnpm lint` (root) + `cd electron-ui && pnpm run lint`
3. **Manual E2E test:** App opens -> Landing -> pick repo -> Dashboard (issues stream in) -> click issue -> modal -> "View on GitHub" opens browser -> "Work on this" -> IDE -> back navigation works
4. **Cache test:** Repeat dashboard load -- second time should be faster (cache hits for summaries)
5. **No gh CLI:** `grep -rn "execSync.*gh " src/` returns nothing

---

## Implementation Order (Demo-Critical Path)

1. **Step 1** -- deps + config (5 min)
2. **Step 2** -- types both tiers (20 min)
3. **Step 3** -- github service module (30 min)
4. **Step 4** -- scoring + streaming pipeline (45 min)
5. **Step 5** -- backend handlers (30 min)
6. **Step 6** -- Landing page (60 min)
7. **Step 7** -- Issue cards + modal (60 min)
8. **Step 8** -- E2E wiring (30 min)
9. **Step 9** -- cleanup (10 min)

**If short on time:** SwarmPlot activity backgrounds (in Step 6) can be deferred -- the repo list works without them.
