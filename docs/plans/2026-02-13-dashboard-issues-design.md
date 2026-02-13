# Dashboard Issues & Landing Page Design

## App Flow

```
Landing (repo picker) --> Dashboard (issues + coaching) --> IDE (coding + coaching)
```

- App opens to Landing page (change `AppShell` default from `'ide'` to `'landing'`)
- Add `'landing'` to the `AppView` type
- Landing passes selected repo to AppShell, which sends `session:start` to server
- Server clones repo if needed, responds with `session:started`
- Client transitions to Dashboard, immediately sends `dashboard:request`
- Back button from Dashboard returns to Landing

**State in AppShell:**
- `currentRepo: { owner: string, repo: string } | null` set when user picks a repo

---

## Landing Page

### Layout

- Top: large figlet-style ASCII art "Paige" as a hardcoded `<pre>` block (no runtime figlet library)
- Subtitle: "Pick a project to work on"
- Below: GitHub-style paginated repository list

### Repository List Toolbar

- **Search input**: `"Find a repository..."` filters client-side on name + description
- **Language dropdown**: populated dynamically from languages in fetched repos. Each option shows VS Code language icon (`vscode-icons-js`) + language name. "All" at top.
- **Sort dropdown**: Recently used (default), Last updated, Name, Issue count

### Repository Row

- **Background**: Nivo SwarmPlot (canvas variant) showing last 30 days of repo activity. Low opacity so text remains readable. Denser clusters indicate busier periods. Animates in (fade + draw-in) when data arrives.
- **Row 1**: Repo name (bold, link-styled)
- **Row 2**: Description (single line, truncated with ellipsis)
- **Row 3**: Language (colored dot + name), license, stars, forks, open issues, PRs, relative timestamp

### Data Flow (Two-Phase Streaming)

1. Client sends `repos:list` on mount
2. Server fetches repos via octokit, filters (public, not archived, has open issues), sends `repos:list` response
3. Client renders rows immediately with empty SwarmPlot backgrounds
4. Client determines which repos are visible on the current page, sends `repos:activity` with that batch
5. Server fetches activity per repo via `GET /repos/{owner}/{repo}/activity` (last 30 days), sends individual `repo:activity` messages as each completes
6. Client animates SwarmPlot into each row as data arrives
7. On page change, client sends new `repos:activity` for newly visible repos. Previously fetched data stays cached client-side.

### Pagination

- 20 repos per page, client-side
- All filtering, sorting, and pagination handled client-side (full list already in memory)
- Simple prev/next at bottom

### Ordering

- Up to 5 most recently opened repos first (requires server tracking)
- Remaining sorted by `updated_at` descending
- User can override with Sort dropdown

### Caching (Keyv In-Memory)

- Repo list: 5 minute TTL
- Activity data per repo: 60 minute TTL

---

## Session Start

When the user clicks a repo on the Landing page:

1. Client sends `session:start` with `{ owner, repo }`
2. Server checks if `~/.paige/repos/{owner}/{repo}/` exists
3. If not, runs `git clone --depth=1` into that path
4. Server responds with `session:started`
5. Client transitions to Dashboard

---

## Dashboard Issues: Server Side

### Step 1: Fetch Issues (octokit)

- `GET /repos/{owner}/{repo}/issues?state=open&per_page=100`
- Filter out pull requests (GitHub issues endpoint includes PRs)
- Fetch authenticated user via `GET /user` for scoring context

### Step 2: Score Each Issue

```
Base score: 0

Current user is author:        +5
Current user in assignees:     +20
Comment count * 0.25

Labels:
  good first issue:  +15
  bug:               +2
  help wanted:       +2
  enhancement:       +2
  security:          -3
  documentation:     -10
  question:          -10
  duplicate:         -25
  invalid:           -25
  wontfix:           -50

Recency (days since updated_at):
  <= 5 days:   +3
  <= 15 days:  +6
  > 15 days:   -(days * 0.1)

Body length:
  < 50 chars:   -25
  < 200 chars:  -15
  < 400 chars:  -5
```

### Step 3: Top 15 Summarization (Claude Haiku)

- Sort by score descending, take top 15
- For each issue, check Keyv cache (key: `issue:{number}:{updated_at}`)
- Cache hit: use cached summary + difficulty
- Cache miss: call Claude Haiku with structured output:
  - `summary`: string, 150-250 characters, summarizes entire issue context (not just description)
  - `difficulty`: enum (low, medium, high, very_high, extreme)
  - System prompt includes user's current Dreyfus skill assessments for personalized difficulty
- Cache result with 1 hour TTL

### Step 4: Stream to Client

- Send each issue via `dashboard:issue` as soon as its summary is ready
- Don't wait for all 15; client renders progressively
- Send `dashboard:issues_complete` when all issues are sent

---

## Dashboard Issues: Client Side

### Container Header

- Title: "Recommended Issues"
- Top-right: 3 icon buttons for layout switching (Full / Condensed / List). Active layout highlighted.

### Progressive Rendering

- Issues arrive one at a time via `dashboard:issue` messages
- Each new card animates in: Framer Motion fade in + slide up + scale (0.95 to 1.0)
- Staggered naturally by arrival time, not artificial delay
- Already-rendered cards don't re-animate
- Skeleton/placeholder shown while waiting for first issue

### Layout: Full (Default)

- Title (bold)
- Generated summary (150-250 chars)
- Difficulty: mountain SVG icon + text label
- Labels: max 3 colored pills, "+X more" overflow
- Last updated: relative time (Day.js)
- Author: avatar + username
- Assignees: stacked avatars
- Comment count: icon + number

### Layout: Condensed

- Title (bold)
- Difficulty: mountain icon + label
- Labels: max 1 pill, "+X more" overflow
- Last updated

### Layout: List

- Single row: Title, difficulty (text only), labels (max 3, "+X more"), last updated

### Layout Switching

- Framer Motion `layoutId` for smooth morphing between layouts

---

## Issue Modal

- Issue title (large, bold)
- Metadata bar: author, assignees, created date, last updated, comment count
- All labels (full list, no truncation)
- Difficulty: mountain icon + label
- Full issue body rendered as markdown (`react-markdown` + `remark-gfm`)
- Footer: **"View on GitHub"** button (opens in default browser) + **"Work on this"** button (primary)

### "Work on This" Flow

1. Client sends `session:select_issue` with `{ issueNumber }`
2. Server creates session record in SQLite, links to repo + issue, loads Dreyfus assessments
3. Server responds with `session:issue_selected`
4. Client transitions to IDE view with issue context in coaching panel

---

## Difficulty Mountain Icons

5 inline SVG React components via `<DifficultyIcon level="high" size={24} />`.

| Level | Visual |
|-------|--------|
| Low | Gentle hill, smooth single hump, flat base |
| Medium | Single peak, mild slopes |
| High | Taller peak with snow cap (lighter fill at top) |
| Very High | Multiple peaks, snow caps, steeper angles |
| Extreme | Sharp jagged peak range, heavy snow, craggy |

**Colors:**
- Mountain body: `#5C4033` (dark brown)
- Snow/highlight: `#D4C5B2` (warm cream)
- Base line: `#3D2B1F` (darkest brown)

**Per layout:**
- Full card: 24px icon + text label
- Condensed card: 20px icon + text label
- List row: text label only

---

## Relative Time Formatting

**Day.js** with `relativeTime` plugin.

- `dayjs(date).fromNow()` for dates <= 30 days old
- `dayjs(date).format('MMMM D, YYYY')` for dates > 30 days old

Single utility: `formatRelativeTime(date: string | Date): string` in renderer `utils/`.

Used by: repo rows (Landing), issue cards (Dashboard), issue modal metadata.

---

## New Dependencies

### Backend (`package.json`)

- `octokit` -- GitHub API client, replaces all `gh` CLI usage
- `keyv` -- in-memory cache with TTL

### Electron UI (`electron-ui/package.json`)

- `@nivo/swarmplot` + `@nivo/core` -- SwarmPlot canvas for activity backgrounds
- `react-markdown` + `remark-gfm` -- GitHub-flavored markdown rendering
- `dayjs` -- relative time formatting

---

## New WebSocket Message Types

### Client to Server

| Type | Payload | Purpose |
|------|---------|---------|
| `repos:list` | `{}` | Request repo list for landing page |
| `repos:activity` | `{ repos: string[] }` | Request activity for visible repos (e.g. `["owner/repo1", "owner/repo2"]`) |
| `session:start` | `{ owner, repo }` | User picked a repo, clone if needed |
| `session:select_issue` | `{ issueNumber }` | User clicked "Work on this" |

### Server to Client

| Type | Payload | Purpose |
|------|---------|---------|
| `repos:list` | `{ repos: Repo[] }` | Full repo list |
| `repo:activity` | `{ repo: string, activities: Activity[] }` | Activity for one repo (streamed) |
| `session:started` | `{ owner, repo }` | Repo ready, go to dashboard |
| `session:issue_selected` | `{ sessionId, issueNumber }` | Session initialized, go to IDE |
| `dashboard:issue` | `{ issue: ScoredIssue }` | Single issue with summary + difficulty (streamed) |
| `dashboard:issues_complete` | `{}` | All issues sent |

---

## Removed Code

- All `execSync('gh ...')` calls in `src/dashboard/flows/issues.ts`
- `isGitHubCLIAvailable()` in connection handler
- GitHub CLI dependency entirely

---

## Config

`.env`:
```
GITHUB_TOKEN=ghp_...
```
