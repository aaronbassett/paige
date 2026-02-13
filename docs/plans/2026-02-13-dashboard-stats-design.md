# Dashboard Stats Bento Grid Redesign

**Date**: 2026-02-13
**Status**: Approved
**Branch**: dashboard-stats

## Overview

Redesign the dashboard stats section from a flat 3-column grid of plain number cards into a visually rich bento grid with mixed card types, hero variants, mini-charts, iconography, and animated layout transitions. Add date range dropdown and filter popover controls.

## Architecture

### Grid Layout

- **4-column × 2-row CSS Grid** — fixed at `repeat(4, 1fr)` columns, `repeat(2, 1fr)` rows
- 8 cell slots maximum
- Gap: `var(--space-sm)` (8px)
- `grid-auto-flow: dense` for optimal packing around hero cards

### Card Sizes

| Size | Grid Span | Use |
|------|-----------|-----|
| Normal (1×1) | `span 1` col, `span 1` row | Default for all stats |
| Hero Wide (2×1) | `span 2` cols, `span 1` row | Stats with sparklines, bar charts |
| Hero Tall (1×2) | `span 1` col, `span 2` rows | Stats with donuts, vertical lists |

### Hero Selection Algorithm

Triggered on: mount, period change, filter change.

1. From active stats, filter to those with a hero variant (max 10)
2. Randomly select 1 or 2 stats to be heroes
3. If 2 selected, prefer one wide + one tall for visual variety
4. Assign hero grid spans; all others get 1×1
5. When heroes reduce available slots below active stat count, later stats in the list are bumped

## Stats Catalog (25 stats)

### Stats with Hero Variants (10)

| # | Stat ID | Label | Normal (1×1) | Hero Variant | Hero Dir |
|---|---------|-------|-------------|--------------|----------|
| 1 | `sessions` | Sessions | Big number + change % | Big number + sparkline (count/day) | Wide |
| 2 | `total_time` | Total Time Spent | Duration (Xh Ym) + change % | Duration + hint-level donut ring | Wide |
| 3 | `total_cost` | Total Cost | Currency ($X.XX) + change % | Currency + daily cost bar chart | Wide |
| 4 | `api_calls` | API Calls | Big number + change % | Big number + sparkline (calls/day) | Wide |
| 5 | `actions` | Actions | Big number + change % | Big number + action-type horizontal bars | Tall |
| 6 | `coaching_messages` | Coaching Messages | Big number + change % | Big number + messages/day sparkline | Wide |
| 7 | `hint_level_breakdown` | Hint Level Breakdown | Stacked mini-bars (L1/L2/L3 %) | Full donut with labels + percentages | Tall |
| 8 | `issues_worked_on` | Issues Worked On | Big number + change % | Number + issue label pill tags | Tall |
| 9 | `dreyfus_progression` | Dreyfus Progression | Current level badge + arrow | Vertical timeline through levels | Tall |
| 10 | `self_sufficiency` | Self-Sufficiency Score | Percentage + trend arrow | Percentage + trend sparkline | Wide |

### Stats without Hero Variants (15)

| # | Stat ID | Label | Card Content |
|---|---------|-------|-------------|
| 11 | `questions_asked` | Questions Asked | Big number + change % + MessageCircle icon |
| 12 | `reviews_requested` | Reviews Requested | Big number + change % + Eye icon |
| 13 | `files_touched` | Files Touched | Big number + change % + FileText icon |
| 14 | `lines_changed` | Lines Changed | Big number + change % + Code icon |
| 15 | `issues_started` | Issues Started | Big number + change % + PlusCircle icon |
| 16 | `avg_session_duration` | Avg Session Duration | Duration + change % + Clock icon |
| 17 | `cost_per_session` | Cost Per Session | Currency + change % + Calculator icon |
| 18 | `streak` | Streak | "X days" + Flame icon (terracotta glow when > 0) |
| 19 | `materials_viewed` | Learning Materials Viewed | Big number + change % + BookOpen icon |
| 20 | `most_active_language` | Most Active Language | Language name + lines count subtitle + Code icon |
| 21 | `token_efficiency` | Token Efficiency | Ratio + trend arrow + Zap icon |
| 22 | `kata_completion` | Kata Completion | X/Y + mini progress bar + Target icon |
| 23 | `oldest_issue_closed` | Oldest Issue Closed | Age string + Calendar icon |
| 24 | `youngest_issue_closed` | Youngest Issue Closed | Age string + Clock icon |
| 25 | `knowledge_gaps_closed` | Knowledge Gaps Closed | Big number + change % + Target icon |

### Default Active Stats (8)

`sessions`, `total_time`, `total_cost`, `actions`, `api_calls`, `coaching_messages`, `streak`, `self_sufficiency`

## Controls

### Layout

```
┌─────────────────────────────────────────────────┐
│ STATS                    [Last Month ▾] [⫸] │
├─────────────────────────────────────────────────┤
│                    bento grid                    │
└─────────────────────────────────────────────────┘
```

Controls sit top-right, inline with STATS header. Flex row, `justify-content: space-between`.

### Date Range Dropdown

- Trigger: button with current value + `<ChevronDown />` icon
- Options: "Today", "Last Week", "Last Month" (default), "All Time"
- Positioned with `@floating-ui/react`, `placement: 'bottom-end'`, `flip` + `shift` middleware
- Styling: `var(--bg-elevated)` background, `var(--border-subtle)` border, active option gets `var(--accent-primary)` text + left border accent
- Selecting an option closes dropdown and fires `onPeriodChange`
- Close on click-outside or ESC

### Filter Popover

- Trigger: `<ListFilter />` icon button
- Popover positioned `bottom-end` via `@floating-ui/react`
- Two-column grid of stat names, ~280px wide
- Active stats: `var(--text-primary)` + filled terracotta circle indicator
- Inactive stats: `var(--text-secondary)` + empty circle indicator
- Disabled (limit hit): `var(--text-muted)`, no circle, `cursor: not-allowed` — only on inactive stats when 8 active already selected
- Reset button: `<RotateCcw />` in popover header, resets to default 8
- Close on click-outside or ESC (`useDismiss`)
- Active stat selection persisted in `localStorage`

## Card Visual Design

### Shared Card Anatomy

```
┌──────────────────────────┐
│ Icon    Label      Change │  ← header row
│                          │
│      Primary Value        │  ← large typography
│                          │
│    Visualization area     │  ← sparkline/donut/bar/empty
└──────────────────────────┘
```

- Background: `var(--bg-elevated)`, `border-radius: 8px`
- Padding: `var(--space-md)` (16px)
- Icon: Lucide, `var(--text-muted)`, 16px, top-left
- Label: `var(--font-small-size)`, `var(--text-secondary)`
- Change: top-right, green/red arrow + percentage
- Primary value: `var(--font-h1-size)` (32px) normal, `var(--font-display-size)` (48px) hero. Weight 700.
- Value animation: Framer Motion `useMotionValue` + `useTransform`, counts up/down over 600ms

### Special Card Treatments

- **Streak**: Flame icon pulses with `var(--hint-glow)` box-shadow when streak > 0
- **Hint Level colors**: L1 = `var(--status-success)`, L2 = `var(--status-warning)`, L3 = `var(--status-error)`
- **Kata Completion**: Mini progress bar with `var(--accent-primary)` fill
- **Hero sparklines**: Nivo `<ResponsiveLine />`, line color `var(--accent-primary)`, area fill 10% opacity gradient
- **Hero donuts**: Nivo `<ResponsivePie />` with inner radius for donut ring
- **Hero bars**: Nivo `<ResponsiveBar />`, bar color `var(--accent-primary)`
- **Normal charts**: Non-interactive (no tooltips)
- **Hero charts**: Tooltips on hover

### Nivo Theme

```typescript
const nivoTheme = {
  textColor: 'var(--text-secondary)',
  grid: { line: { stroke: 'var(--border-subtle)' } },
  tooltip: {
    container: {
      background: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--font-small-size)',
    },
  },
};
```

## Animations

### Layout Transitions

- `LayoutGroup` wraps the bento grid
- Every card has `layout` prop for automatic position/size animation
- `AnimatePresence` for enter/exit:
  - **Enter**: fade in + scale 0.95 → 1, `spring-standard` preset
  - **Exit**: fade out + scale 1 → 0.95, 150ms
  - **Reflow**: `spring-expressive` preset (bouncy, lively)
- **Stagger**: 30ms delay between cards on initial load

### Value Transitions

- Numbers count up/down using Framer Motion spring interpolation
- Duration: 600ms

## Data Requirements

### Already Available (no backend changes)

| Stat | Source | Query Pattern |
|------|--------|--------------|
| Sessions | `sessions` | `COUNT(*) WHERE started_at >= ?` |
| Actions | `action_log` | `COUNT(*) WHERE created_at >= ?` |
| API Calls | `api_call_log` | `COUNT(*) WHERE created_at >= ?` |
| Total Cost | `api_call_log.cost_estimate` | `SUM(cost_estimate) WHERE created_at >= ?` |
| Avg Session Duration | `sessions` | `AVG(ended_at - started_at)` |
| Cost Per Session | Derived | `total_cost / session_count` |
| Token Efficiency | `api_call_log` | `SUM(output_tokens) / SUM(input_tokens)` |
| Actions breakdown | `action_log.action_type` | `GROUP BY action_type` |
| Kata Completion | `katas` | `COUNT(*) WHERE status = 'completed'` vs total |
| Dreyfus Progression | `dreyfus_assessments` | Latest assessment per skill |
| Knowledge Gaps Closed | `knowledge_gaps` | `COUNT(*) WHERE status = 'resolved'` |

### New Database Objects

**New table: `hint_level_spans`**

```sql
CREATE TABLE hint_level_spans (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  level INTEGER NOT NULL,  -- 1, 2, 3
  started_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE INDEX idx_hint_level_spans_session ON hint_level_spans(session_id);
```

Powers: Total Time Spent, Hint Level Breakdown, Self-Sufficiency Score.

**New table: `issue_labels`**

```sql
CREATE TABLE issue_labels (
  id INTEGER PRIMARY KEY,
  issue_number INTEGER NOT NULL,
  label_name TEXT NOT NULL,
  label_color TEXT
);
CREATE INDEX idx_issue_labels_issue ON issue_labels(issue_number);
```

Powers: Issues Worked On (hero pill tags).

**New column on `sessions`**: `total_duration_ms INTEGER`

**New action types** in `action_log`: `coaching_message`, `question_asked`, `review_requested`, `file_edit` (with `data` JSON: `{ path, lines_added, lines_removed }`), `material_viewed`

### WebSocket Protocol Changes

**Updated `dashboard:stats` message**:

```typescript
type StatId = 'sessions' | 'total_time' | 'total_cost' | 'api_calls' | 'actions'
  | 'coaching_messages' | 'hint_level_breakdown' | 'issues_worked_on'
  | 'dreyfus_progression' | 'self_sufficiency' | 'questions_asked'
  | 'reviews_requested' | 'files_touched' | 'lines_changed'
  | 'issues_started' | 'avg_session_duration' | 'cost_per_session'
  | 'streak' | 'materials_viewed' | 'most_active_language'
  | 'token_efficiency' | 'kata_completion' | 'oldest_issue_closed'
  | 'youngest_issue_closed' | 'knowledge_gaps_closed';

type StatsPeriod = 'today' | 'last_week' | 'last_month' | 'all_time';

interface StatPayload {
  value: number | string;
  change: number;                // % change vs previous equivalent period
  unit: 'count' | 'duration' | 'currency' | 'percentage' | 'text';
  sparkline?: Array<{ x: string; y: number }>;
  breakdown?: Array<{ label: string; value: number; color?: string }>;
  pills?: Array<{ label: string; color: string; count: number }>;
  progression?: Array<{ skill: string; level: string }>;
}

interface DashboardStatsMessage {
  type: 'dashboard:stats';
  payload: {
    period: StatsPeriod;
    stats: Record<StatId, StatPayload>;
  };
}
```

Backend computes all 25 stats on every request. Frontend renders only the active ones (instant toggle, no round-trip).

**Updated `dashboard:stats_period` message**:

```typescript
interface DashboardStatsPeriodMessage {
  type: 'dashboard:stats_period';
  payload: { period: StatsPeriod };
}
```

Period values change from `'today' | 'this_week' | 'this_month'` to `'today' | 'last_week' | 'last_month' | 'all_time'`.

## New Dependencies

**electron-ui/package.json**:
- `lucide-react` — icons
- `@nivo/line` — sparklines
- `@nivo/pie` — donut charts
- `@nivo/bar` — bar charts
- `@nivo/core` — shared Nivo theme

Already available: `framer-motion`, `@floating-ui/react`.

## Component Structure

```
components/Dashboard/
├── StatsBento.tsx              ← Main container (grid, hero logic, AnimatePresence)
├── StatsControls.tsx           ← Date range dropdown + filter popover
├── StatCard.tsx                ← Card wrapper (shared anatomy, layout prop)
├── cards/
│   ├── BigNumberCard.tsx       ← Sessions, Actions, API Calls, etc.
│   ├── DurationCard.tsx        ← Total Time, Avg Duration
│   ├── CurrencyCard.tsx        ← Cost, Cost/Session
│   ├── PercentageCard.tsx      ← Self-Sufficiency, Token Efficiency
│   ├── StreakCard.tsx           ← Streak with flame glow
│   ├── HintLevelCard.tsx       ← Stacked bars (normal) / donut (hero)
│   ├── LanguageCard.tsx        ← Most Active Language
│   ├── KataCard.tsx            ← X/Y + progress bar
│   ├── AgeCard.tsx             ← Oldest/Youngest issue
│   ├── DreyfusCard.tsx         ← Level badge (normal) / timeline (hero)
│   └── IssuesWorkedCard.tsx    ← Number (normal) / pill tags (hero)
├── heroes/
│   ├── SparklineHero.tsx       ← Sessions, API Calls, Coaching, Self-Suff
│   ├── BarChartHero.tsx        ← Cost, Actions
│   ├── DonutHero.tsx           ← Time Spent, Hint Levels
│   ├── IssuesHero.tsx          ← Issues pill tags
│   └── DreyfusHero.tsx         ← Progression timeline
├── shared/
│   ├── ChangeIndicator.tsx     ← Up/down arrow + percentage
│   ├── AnimatedNumber.tsx      ← Counting number animation
│   └── nivoTheme.ts            ← Shared Nivo theme config
└── hooks/
    ├── useStatsFilter.ts       ← Active stats state + localStorage persistence
    └── useHeroSelection.ts     ← Random hero picking logic
```
