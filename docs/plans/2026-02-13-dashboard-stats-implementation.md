# Dashboard Stats Bento Grid — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat 3-column stats grid with a visually rich bento grid featuring mixed card types, hero variants with Nivo charts, animated layout transitions, date range dropdown, and filter popover.

**Architecture:** Frontend-first approach — build the visual grid with mock data, then wire up the backend. The frontend gets new card components organized by type (normal/hero), a bento grid container with Framer Motion layout animations, and controls (date dropdown + filter popover). The backend gets new database tables, expanded query functions for 25 stats, and an updated WebSocket protocol.

**Tech Stack:** React 19, TypeScript, Framer Motion, @nivo/line + @nivo/pie + @nivo/bar, @floating-ui/react, lucide-react, Kysely (SQLite), Vitest

**Design Doc:** `docs/plans/2026-02-13-dashboard-stats-design.md`

---

## Task 1: Install Frontend Dependencies

**Files:**
- Modify: `electron-ui/package.json`

**Step 1: Install packages**

Run from `electron-ui/`:
```bash
npm install lucide-react @nivo/core @nivo/line @nivo/pie @nivo/bar
```

**Step 2: Verify install**

Run: `cd electron-ui && npm ls lucide-react @nivo/core @nivo/line @nivo/pie @nivo/bar`
Expected: All 5 packages listed with versions, no errors.

**Step 3: Commit**

```bash
git add electron-ui/package.json electron-ui/package-lock.json
git commit -m "feat(electron-ui): add lucide-react and nivo chart dependencies"
```

---

## Task 2: Define Shared Types & Constants (Stats Catalog)

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/stats/types.ts`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/catalog.ts`

**Step 1: Write the types file**

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/types.ts
import type { LucideIcon } from 'lucide-react';

export type StatId =
  | 'sessions' | 'total_time' | 'total_cost' | 'api_calls' | 'actions'
  | 'coaching_messages' | 'hint_level_breakdown' | 'issues_worked_on'
  | 'dreyfus_progression' | 'self_sufficiency' | 'questions_asked'
  | 'reviews_requested' | 'files_touched' | 'lines_changed'
  | 'issues_started' | 'avg_session_duration' | 'cost_per_session'
  | 'streak' | 'materials_viewed' | 'most_active_language'
  | 'token_efficiency' | 'kata_completion' | 'oldest_issue_closed'
  | 'youngest_issue_closed' | 'knowledge_gaps_closed';

export type StatsPeriod = 'today' | 'last_week' | 'last_month' | 'all_time';

export type HeroDirection = 'wide' | 'tall';

export type CardType =
  | 'big_number' | 'duration' | 'currency' | 'percentage'
  | 'streak' | 'hint_level' | 'language' | 'kata'
  | 'age' | 'dreyfus' | 'issues_worked';

export type HeroType =
  | 'sparkline' | 'bar_chart' | 'donut' | 'issues_pills' | 'dreyfus_timeline';

export interface StatDefinition {
  readonly id: StatId;
  readonly label: string;
  readonly cardType: CardType;
  readonly icon: LucideIcon;
  readonly hero?: {
    readonly direction: HeroDirection;
    readonly heroType: HeroType;
  };
}

export interface StatPayload {
  readonly value: number | string;
  readonly change: number;
  readonly unit: 'count' | 'duration' | 'currency' | 'percentage' | 'text';
  readonly sparkline?: ReadonlyArray<{ x: string; y: number }>;
  readonly breakdown?: ReadonlyArray<{ label: string; value: number; color?: string }>;
  readonly pills?: ReadonlyArray<{ label: string; color: string; count: number }>;
  readonly progression?: ReadonlyArray<{ skill: string; level: string }>;
}

export type StatsData = Partial<Record<StatId, StatPayload>>;

export interface DashboardStatsPayload {
  readonly period: StatsPeriod;
  readonly stats: StatsData;
}
```

**Step 2: Write the catalog file**

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/catalog.ts
import {
  Activity, Clock, DollarSign, Zap, MessageCircle,
  Eye, FileText, Code, PlusCircle, Calculator,
  Flame, BookOpen, Target, Calendar, BarChart3,
  Layers, GitPullRequest, Brain, Shield, TrendingUp,
} from 'lucide-react';
import type { StatDefinition, StatId } from './types';

export const STATS_CATALOG: readonly StatDefinition[] = [
  // --- Hero-capable stats ---
  { id: 'sessions', label: 'Sessions', cardType: 'big_number', icon: Activity, hero: { direction: 'wide', heroType: 'sparkline' } },
  { id: 'total_time', label: 'Total Time Spent', cardType: 'duration', icon: Clock, hero: { direction: 'wide', heroType: 'donut' } },
  { id: 'total_cost', label: 'Total Cost', cardType: 'currency', icon: DollarSign, hero: { direction: 'wide', heroType: 'bar_chart' } },
  { id: 'api_calls', label: 'API Calls', cardType: 'big_number', icon: Zap, hero: { direction: 'wide', heroType: 'sparkline' } },
  { id: 'actions', label: 'Actions', cardType: 'big_number', icon: Activity, hero: { direction: 'tall', heroType: 'bar_chart' } },
  { id: 'coaching_messages', label: 'Coaching Messages', cardType: 'big_number', icon: MessageCircle, hero: { direction: 'wide', heroType: 'sparkline' } },
  { id: 'hint_level_breakdown', label: 'Hint Level Breakdown', cardType: 'hint_level', icon: Layers, hero: { direction: 'tall', heroType: 'donut' } },
  { id: 'issues_worked_on', label: 'Issues Worked On', cardType: 'big_number', icon: GitPullRequest, hero: { direction: 'tall', heroType: 'issues_pills' } },
  { id: 'dreyfus_progression', label: 'Dreyfus Progression', cardType: 'dreyfus', icon: Brain, hero: { direction: 'tall', heroType: 'dreyfus_timeline' } },
  { id: 'self_sufficiency', label: 'Self-Sufficiency', cardType: 'percentage', icon: Shield, hero: { direction: 'wide', heroType: 'sparkline' } },
  // --- Normal-only stats ---
  { id: 'questions_asked', label: 'Questions Asked', cardType: 'big_number', icon: MessageCircle },
  { id: 'reviews_requested', label: 'Reviews Requested', cardType: 'big_number', icon: Eye },
  { id: 'files_touched', label: 'Files Touched', cardType: 'big_number', icon: FileText },
  { id: 'lines_changed', label: 'Lines Changed', cardType: 'big_number', icon: Code },
  { id: 'issues_started', label: 'Issues Started', cardType: 'big_number', icon: PlusCircle },
  { id: 'avg_session_duration', label: 'Avg Session Duration', cardType: 'duration', icon: Clock },
  { id: 'cost_per_session', label: 'Cost Per Session', cardType: 'currency', icon: Calculator },
  { id: 'streak', label: 'Streak', cardType: 'streak', icon: Flame },
  { id: 'materials_viewed', label: 'Materials Viewed', cardType: 'big_number', icon: BookOpen },
  { id: 'most_active_language', label: 'Most Active Language', cardType: 'language', icon: Code },
  { id: 'token_efficiency', label: 'Token Efficiency', cardType: 'percentage', icon: Zap },
  { id: 'kata_completion', label: 'Kata Completion', cardType: 'kata', icon: Target },
  { id: 'oldest_issue_closed', label: 'Oldest Issue Closed', cardType: 'age', icon: Calendar },
  { id: 'youngest_issue_closed', label: 'Youngest Issue Closed', cardType: 'age', icon: Clock },
  { id: 'knowledge_gaps_closed', label: 'Gaps Closed', cardType: 'big_number', icon: Target },
] as const;

export const STATS_BY_ID: ReadonlyMap<StatId, StatDefinition> = new Map(
  STATS_CATALOG.map((s) => [s.id, s]),
);

export const DEFAULT_ACTIVE_STATS: readonly StatId[] = [
  'sessions', 'total_time', 'total_cost', 'actions',
  'api_calls', 'coaching_messages', 'streak', 'self_sufficiency',
];

export const MAX_ACTIVE_STATS = 8;

export const PERIODS: readonly { key: StatsPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all_time', label: 'All Time' },
];

// Import StatsPeriod for the PERIODS type
import type { StatsPeriod } from './types';
```

**Step 3: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: No errors from the new files.

**Step 4: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/stats/
git commit -m "feat(stats): add stat types, catalog, and default configuration"
```

---

## Task 3: Shared UI Primitives (ChangeIndicator, AnimatedNumber, Nivo Theme)

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/stats/shared/ChangeIndicator.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/shared/AnimatedNumber.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/shared/nivoTheme.ts`

**Step 1: Write ChangeIndicator**

Extract from existing `StatsBento.tsx:147-169` into standalone component. Same logic but as a named export.

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/shared/ChangeIndicator.tsx
const upStyle: React.CSSProperties = { fontSize: 'var(--font-small-size)', color: 'var(--status-success)' };
const downStyle: React.CSSProperties = { fontSize: 'var(--font-small-size)', color: 'var(--status-error)' };
const flatStyle: React.CSSProperties = { fontSize: 'var(--font-small-size)', color: 'var(--text-muted)' };

export function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span style={flatStyle}>&mdash;</span>;
  const isPositive = change > 0;
  const arrow = isPositive ? '\u2191' : '\u2193';
  return (
    <span style={isPositive ? upStyle : downStyle}>
      {arrow} {Math.abs(change).toFixed(1)}%
    </span>
  );
}
```

**Step 2: Write AnimatedNumber**

Uses Framer Motion `useSpring` + `useTransform` to count up/down over 600ms.

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/shared/AnimatedNumber.tsx
import { useEffect, useRef } from 'react';
import { useSpring, useTransform, motion, type SpringOptions } from 'framer-motion';

const spring: SpringOptions = { stiffness: 100, damping: 30, duration: 0.6 };

export function AnimatedNumber({
  value,
  format = (n: number) => n.toLocaleString(),
  style,
}: {
  value: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}) {
  const motionValue = useSpring(0, spring);
  const display = useTransform(motionValue, (v) => format(Math.round(v)));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return unsubscribe;
  }, [display]);

  return <span ref={ref} style={style}>{format(value)}</span>;
}
```

**Step 3: Write nivoTheme**

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/shared/nivoTheme.ts
import type { Theme } from '@nivo/core';

export const nivoTheme: Theme = {
  text: { fill: '#a8a69e' },               // --text-secondary
  grid: { line: { stroke: '#30302e' } },    // --border-subtle
  tooltip: {
    container: {
      background: '#252523',                // --bg-surface
      color: '#faf9f5',                     // --text-primary
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
      borderRadius: '6px',
      padding: '8px 12px',
    },
  },
  axis: {
    ticks: { text: { fill: '#6b6960' } },  // --text-muted
  },
};

export const CHART_COLORS = {
  primary: '#d97757',       // --accent-primary
  primaryArea: 'rgba(217, 119, 87, 0.1)',
  hintL1: '#7cb87c',       // --status-success
  hintL2: '#d4a843',       // --status-warning
  hintL3: '#e05252',       // --status-error
} as const;
```

**Step 4: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/stats/shared/
git commit -m "feat(stats): add ChangeIndicator, AnimatedNumber, and Nivo theme"
```

---

## Task 4: Custom Hooks (useStatsFilter, useHeroSelection)

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/stats/hooks/useStatsFilter.ts`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/hooks/useHeroSelection.ts`

**Step 1: Write useStatsFilter**

Manages which stats are active. Persists to `localStorage`. Enforces max 8.

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/hooks/useStatsFilter.ts
import { useState, useCallback } from 'react';
import { DEFAULT_ACTIVE_STATS, MAX_ACTIVE_STATS } from '../catalog';
import type { StatId } from '../types';

const STORAGE_KEY = 'paige-stats-filter';

function loadFromStorage(): StatId[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as StatId[];
  } catch { /* ignore */ }
  return [...DEFAULT_ACTIVE_STATS];
}

function saveToStorage(ids: StatId[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function useStatsFilter() {
  const [activeStats, setActiveStats] = useState<StatId[]>(loadFromStorage);

  const toggle = useCallback((id: StatId) => {
    setActiveStats((prev) => {
      const isActive = prev.includes(id);
      let next: StatId[];
      if (isActive) {
        next = prev.filter((s) => s !== id);
      } else if (prev.length < MAX_ACTIVE_STATS) {
        next = [...prev, id];
      } else {
        return prev; // at limit, do nothing
      }
      saveToStorage(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const defaults = [...DEFAULT_ACTIVE_STATS];
    setActiveStats(defaults);
    saveToStorage(defaults);
  }, []);

  const isAtLimit = activeStats.length >= MAX_ACTIVE_STATS;

  return { activeStats, toggle, reset, isAtLimit } as const;
}
```

**Step 2: Write useHeroSelection**

Randomly picks 1-2 hero-capable stats from active list. Re-randomizes when dependencies change.

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/hooks/useHeroSelection.ts
import { useMemo } from 'react';
import { STATS_BY_ID } from '../catalog';
import type { StatId, HeroDirection } from '../types';

export function useHeroSelection(
  activeStats: readonly StatId[],
  seed: string, // changes on period change / filter change to trigger re-randomization
): ReadonlySet<StatId> {
  return useMemo(() => {
    const heroCandidates = activeStats.filter((id) => STATS_BY_ID.get(id)?.hero);
    if (heroCandidates.length === 0) return new Set<StatId>();

    // Simple seeded shuffle using the seed string
    const hash = Array.from(seed).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const shuffled = [...heroCandidates].sort((a, b) => {
      const ha = ((hash + a.charCodeAt(0)) * 2654435761) >>> 0;
      const hb = ((hash + b.charCodeAt(0)) * 2654435761) >>> 0;
      return ha - hb;
    });

    // Pick 1 or 2 heroes (prefer 2 if enough candidates, prefer wide+tall mix)
    const heroCount = heroCandidates.length >= 3 ? 2 : 1;
    const picked = new Set<StatId>();
    picked.add(shuffled[0]);

    if (heroCount === 2) {
      const firstDir = STATS_BY_ID.get(shuffled[0])!.hero!.direction;
      const oppositeDir: HeroDirection = firstDir === 'wide' ? 'tall' : 'wide';
      const opposite = shuffled.slice(1).find(
        (id) => STATS_BY_ID.get(id)!.hero!.direction === oppositeDir,
      );
      picked.add(opposite ?? shuffled[1]);
    }

    return picked;
  }, [activeStats, seed]);
}
```

**Step 3: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/stats/hooks/
git commit -m "feat(stats): add useStatsFilter and useHeroSelection hooks"
```

---

## Task 5: Normal Card Components

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/BigNumberCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/DurationCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/CurrencyCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/PercentageCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/StreakCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/HintLevelCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/LanguageCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/KataCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/AgeCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/DreyfusCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/IssuesWorkedCard.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/cards/index.ts`

**Context:** Each card receives `{ stat: StatDefinition; data: StatPayload; isHero: boolean }`. Normal cards render the 1×1 view. Hero rendering is handled separately in Task 6.

**Step 1: Write BigNumberCard** — the most common card type. Used by: Sessions, Actions, API Calls, Coaching Messages, Questions Asked, Reviews Requested, Files Touched, Lines Changed, Issues Started, Knowledge Gaps Closed.

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/cards/BigNumberCard.tsx
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import type { StatDefinition, StatPayload } from '../types';

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const iconLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)', color: 'var(--text-secondary)',
  lineHeight: 'var(--font-small-line-height)',
};
const valueStyle: React.CSSProperties = {
  fontSize: 'var(--font-h1-size)', color: 'var(--text-primary)',
  fontWeight: 700, margin: 'var(--space-sm) 0 0', lineHeight: 1.2,
};

export function BigNumberCard({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  return (
    <>
      <div style={headerStyle}>
        <div style={iconLabelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          <span style={labelStyle}>{stat.label}</span>
        </div>
        <ChangeIndicator change={data.change} />
      </div>
      <AnimatedNumber value={typeof data.value === 'number' ? data.value : 0} style={valueStyle} />
    </>
  );
}
```

**Step 2: Write DurationCard** — for Total Time Spent, Avg Session Duration.

Same layout as BigNumberCard but formats value as `Xh Ym`. The `data.value` is duration in milliseconds (number).

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/cards/DurationCard.tsx
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import type { StatDefinition, StatPayload } from '../types';

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// Styles same structure as BigNumberCard
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const iconLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)', color: 'var(--text-secondary)',
  lineHeight: 'var(--font-small-line-height)',
};
const valueStyle: React.CSSProperties = {
  fontSize: 'var(--font-h1-size)', color: 'var(--text-primary)',
  fontWeight: 700, margin: 'var(--space-sm) 0 0', lineHeight: 1.2,
};

export function DurationCard({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const ms = typeof data.value === 'number' ? data.value : 0;
  return (
    <>
      <div style={headerStyle}>
        <div style={iconLabelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          <span style={labelStyle}>{stat.label}</span>
        </div>
        <ChangeIndicator change={data.change} />
      </div>
      <AnimatedNumber value={ms} format={formatDuration} style={valueStyle} />
    </>
  );
}
```

**Step 3: Write CurrencyCard, PercentageCard, StreakCard, HintLevelCard, LanguageCard, KataCard, AgeCard, DreyfusCard, IssuesWorkedCard**

Each follows the same pattern as BigNumberCard with variations:

- **CurrencyCard**: Formats as `$X.XX` using `(n) => '$' + n.toFixed(2)`
- **PercentageCard**: Formats as `XX.X%` using `(n) => n.toFixed(1) + '%'`
- **StreakCard**: Shows `X days` text. Flame icon uses `color: 'var(--accent-primary)'` when value > 0, with `boxShadow: '0 0 12px var(--hint-glow)'` CSS animation on the icon wrapper
- **HintLevelCard**: Shows 3 horizontal stacked bars from `data.breakdown` (L1/L2/L3). Colors: `var(--status-success)`, `var(--status-warning)`, `var(--status-error)`
- **LanguageCard**: Shows `data.value` as string (language name) in large text, subtitle from `data.breakdown?.[0]?.value` as line count
- **KataCard**: Shows `X/Y` from value, mini progress bar div with width% and `var(--accent-primary)` background
- **AgeCard**: Shows relative time string from `data.value` (already a string like "12 days")
- **DreyfusCard**: Shows level name from `data.value` (string) with a small colored pill badge
- **IssuesWorkedCard**: Same as BigNumberCard (normal variant is just a number)

**Step 4: Write barrel index**

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/cards/index.ts
export { BigNumberCard } from './BigNumberCard';
export { DurationCard } from './DurationCard';
export { CurrencyCard } from './CurrencyCard';
export { PercentageCard } from './PercentageCard';
export { StreakCard } from './StreakCard';
export { HintLevelCard } from './HintLevelCard';
export { LanguageCard } from './LanguageCard';
export { KataCard } from './KataCard';
export { AgeCard } from './AgeCard';
export { DreyfusCard } from './DreyfusCard';
export { IssuesWorkedCard } from './IssuesWorkedCard';
```

**Step 5: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: No errors.

**Step 6: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/stats/cards/
git commit -m "feat(stats): add 11 normal card components for all stat types"
```

---

## Task 6: Hero Card Components

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/stats/heroes/SparklineHero.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/heroes/BarChartHero.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/heroes/DonutHero.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/heroes/IssuesHero.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/heroes/DreyfusHero.tsx`
- Create: `electron-ui/renderer/src/components/Dashboard/stats/heroes/index.ts`

**Context:** Hero components receive the same props as normal cards but render a richer visualization. Wide heroes (2×1) show value on the left, chart on the right. Tall heroes (1×2) show value at the top, chart below.

**Step 1: Write SparklineHero** — used by Sessions, API Calls, Coaching Messages, Self-Sufficiency.

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/heroes/SparklineHero.tsx
import { ResponsiveLine } from '@nivo/line';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import { nivoTheme, CHART_COLORS } from '../shared/nivoTheme';
import type { StatDefinition, StatPayload } from '../types';

const containerStyle: React.CSSProperties = {
  display: 'flex', gap: 'var(--space-md)', height: '100%',
};
const leftStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '35%',
};
const rightStyle: React.CSSProperties = { flex: 1, minHeight: 60 };
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)', color: 'var(--text-secondary)',
  display: 'flex', alignItems: 'center', gap: '6px',
};
const valueStyle: React.CSSProperties = {
  fontSize: 'var(--font-display-size)', color: 'var(--text-primary)',
  fontWeight: 700, lineHeight: 1.2,
};

export function SparklineHero({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const points = data.sparkline ?? [];
  const lineData = [{
    id: stat.id,
    data: points.map((p) => ({ x: p.x, y: p.y })),
  }];

  return (
    <div style={containerStyle}>
      <div style={leftStyle}>
        <span style={labelStyle}><Icon size={16} color="var(--text-muted)" />{stat.label}</span>
        <AnimatedNumber
          value={typeof data.value === 'number' ? data.value : 0}
          format={data.unit === 'percentage' ? (n) => `${n.toFixed(1)}%` : undefined}
          style={valueStyle}
        />
        <ChangeIndicator change={data.change} />
      </div>
      <div style={rightStyle}>
        {points.length > 1 && (
          <ResponsiveLine
            data={lineData}
            theme={nivoTheme}
            colors={[CHART_COLORS.primary]}
            enableArea
            areaOpacity={0.1}
            enableGridX={false}
            enableGridY={false}
            enablePoints={false}
            axisLeft={null}
            axisBottom={null}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            curve="monotoneX"
            isInteractive
            enableCrosshair={false}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Write BarChartHero** — used by Total Cost (wide), Actions (tall).

For wide: value left, bars right (vertical).
For tall: value top, bars bottom (horizontal).

Uses `data.breakdown` for bar segments. Direction determined from `stat.hero.direction`.

```typescript
// Uses <ResponsiveBar /> from @nivo/bar
// layout: stat.hero?.direction === 'tall' ? 'horizontal' : 'vertical'
// data: data.breakdown mapped to { id: label, value: value }
// colors: CHART_COLORS.primary
// Same container pattern — flex column for tall, flex row for wide
```

**Step 3: Write DonutHero** — used by Total Time Spent (wide), Hint Level Breakdown (tall).

```typescript
// Uses <ResponsivePie /> from @nivo/pie
// innerRadius: 0.6 for donut ring
// data: data.breakdown mapped to { id: label, value: value, color: color }
// For hint levels: colors [CHART_COLORS.hintL1, hintL2, hintL3]
// Center label shows total hours for Time Spent
```

**Step 4: Write IssuesHero** — used by Issues Worked On (tall).

```typescript
// Shows big number at top
// Below: data.pills rendered as flex-wrap pill badges
// Each pill: background from pill.color with 20% opacity, text in full color
// Small count badge to the right of each label
```

**Step 5: Write DreyfusHero** — used by Dreyfus Progression (tall).

```typescript
// Shows current level at top
// Below: vertical timeline of levels from data.progression
// Each node: circle (green if passed, terracotta if current, muted if future)
// Connecting line between nodes
// Level name to the right of each node
```

**Step 6: Write barrel index**

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/heroes/index.ts
export { SparklineHero } from './SparklineHero';
export { BarChartHero } from './BarChartHero';
export { DonutHero } from './DonutHero';
export { IssuesHero } from './IssuesHero';
export { DreyfusHero } from './DreyfusHero';
```

**Step 7: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: No errors.

**Step 8: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/stats/heroes/
git commit -m "feat(stats): add 5 hero card components with Nivo charts"
```

---

## Task 7: StatCard Wrapper (Framer Motion layout + card type dispatch)

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/stats/StatCard.tsx`

**Context:** This is the wrapper that applies the shared card anatomy (background, padding, border-radius), Framer Motion `layout` prop, and dispatches to the correct card component based on `cardType` and `isHero`.

**Step 1: Write StatCard**

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/StatCard.tsx
import { motion } from 'framer-motion';
import { STATS_BY_ID } from './catalog';
import type { StatId, StatPayload, HeroDirection } from './types';
// Import all card components
import { BigNumberCard, DurationCard, CurrencyCard, PercentageCard,
  StreakCard, HintLevelCard, LanguageCard, KataCard, AgeCard,
  DreyfusCard, IssuesWorkedCard } from './cards';
// Import hero components
import { SparklineHero, BarChartHero, DonutHero, IssuesHero, DreyfusHero } from './heroes';

const CARD_TYPE_MAP = {
  big_number: BigNumberCard,
  duration: DurationCard,
  currency: CurrencyCard,
  percentage: PercentageCard,
  streak: StreakCard,
  hint_level: HintLevelCard,
  language: LanguageCard,
  kata: KataCard,
  age: AgeCard,
  dreyfus: DreyfusCard,
  issues_worked: IssuesWorkedCard,
} as const;

const HERO_TYPE_MAP = {
  sparkline: SparklineHero,
  bar_chart: BarChartHero,
  donut: DonutHero,
  issues_pills: IssuesHero,
  dreyfus_timeline: DreyfusHero,
} as const;

function getGridSpan(isHero: boolean, direction?: HeroDirection): React.CSSProperties {
  if (!isHero) return {};
  return direction === 'wide'
    ? { gridColumn: 'span 2' }
    : { gridRow: 'span 2' };
}

const baseCardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  borderRadius: '8px',
  padding: 'var(--space-md)',
  overflow: 'hidden',
};

interface StatCardProps {
  statId: StatId;
  data: StatPayload;
  isHero: boolean;
  index: number; // for stagger
}

export function StatCard({ statId, data, isHero, index }: StatCardProps) {
  const stat = STATS_BY_ID.get(statId);
  if (!stat) return null;

  const span = getGridSpan(isHero, stat.hero?.direction);
  const Component = isHero && stat.hero
    ? HERO_TYPE_MAP[stat.hero.heroType]
    : CARD_TYPE_MAP[stat.cardType];

  return (
    <motion.div
      layout
      layoutId={`stat-${statId}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        layout: { type: 'spring', stiffness: 260, damping: 20 },
        opacity: { duration: 0.15, delay: index * 0.03 },
        scale: { duration: 0.15, delay: index * 0.03 },
      }}
      style={{ ...baseCardStyle, ...span }}
    >
      <Component stat={stat} data={data} />
    </motion.div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`

**Step 3: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/stats/StatCard.tsx
git commit -m "feat(stats): add StatCard wrapper with Framer Motion layout and card dispatch"
```

---

## Task 8: StatsControls (Date Range Dropdown + Filter Popover)

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/stats/StatsControls.tsx`

**Context:** Uses `@floating-ui/react` for both the dropdown and popover, `lucide-react` for icons. Pattern matches existing `CommentBalloon.tsx` usage of floating-ui.

**Step 1: Write StatsControls**

This file contains three sub-components:

1. **DateRangeDropdown** — button with `<ChevronDown />`, floating dropdown with 4 period options
2. **FilterPopover** — `<ListFilter />` button, floating popover with 2-col grid of stats, `<RotateCcw />` reset
3. **StatsControls** — wrapper that renders both inline

```typescript
// electron-ui/renderer/src/components/Dashboard/stats/StatsControls.tsx
import { useState, useRef } from 'react';
import {
  useFloating, useClick, useDismiss, useInteractions,
  offset, flip, shift, autoUpdate,
} from '@floating-ui/react';
import { ChevronDown, ListFilter, RotateCcw } from 'lucide-react';
import { PERIODS, STATS_CATALOG, MAX_ACTIVE_STATS } from './catalog';
import type { StatId, StatsPeriod } from './types';

// --- DateRangeDropdown ---
function DateRangeDropdown({
  period, onPeriodChange,
}: { period: StatsPeriod; onPeriodChange: (p: StatsPeriod) => void }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: setOpen,
    placement: 'bottom-end',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const currentLabel = PERIODS.find((p) => p.key === period)?.label ?? 'Last Month';

  return (
    <>
      <button ref={refs.setReference} {...getReferenceProps()} style={/* trigger styles */}>
        {currentLabel} <ChevronDown size={14} />
      </button>
      {open && (
        <div ref={refs.setFloating} style={{ ...floatingStyles, /* dropdown styles */ }} {...getFloatingProps()}>
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => { onPeriodChange(key); setOpen(false); }}
              style={/* option style, active highlight */}>
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// --- FilterPopover ---
function FilterPopover({
  activeStats, onToggle, onReset, isAtLimit,
}: {
  activeStats: readonly StatId[];
  onToggle: (id: StatId) => void;
  onReset: () => void;
  isAtLimit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: setOpen,
    placement: 'bottom-end',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const activeSet = new Set(activeStats);

  return (
    <>
      <button ref={refs.setReference} {...getReferenceProps()} style={/* icon button styles */}>
        <ListFilter size={16} />
      </button>
      {open && (
        <div ref={refs.setFloating} style={{ ...floatingStyles, /* popover styles ~280px wide */ }} {...getFloatingProps()}>
          <div style={/* header row */}>
            <span>Filter Stats</span>
            <button onClick={onReset} style={/* reset icon styles */}>
              <RotateCcw size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {STATS_CATALOG.map(({ id, label }) => {
              const isActive = activeSet.has(id);
              const isDisabled = !isActive && isAtLimit;
              return (
                <button key={id} onClick={() => !isDisabled && onToggle(id)}
                  disabled={isDisabled}
                  style={/* row style: active/inactive/disabled colors */}>
                  <span style={/* circle indicator */} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// --- Combined controls ---
export function StatsControls({
  period, onPeriodChange,
  activeStats, onToggle, onReset, isAtLimit,
}: {
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
  activeStats: readonly StatId[];
  onToggle: (id: StatId) => void;
  onReset: () => void;
  isAtLimit: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <DateRangeDropdown period={period} onPeriodChange={onPeriodChange} />
      <FilterPopover activeStats={activeStats} onToggle={onToggle} onReset={onReset} isAtLimit={isAtLimit} />
    </div>
  );
}
```

**Step 2: Fill in all inline styles** — use design tokens from `design-tokens.css`. Trigger buttons: `background: 'none'`, `border: '1px solid var(--border-subtle)'`, `borderRadius: '6px'`, `color: 'var(--text-secondary)'`, hover: `color: 'var(--accent-primary)'`. Dropdown/popover: `background: 'var(--bg-elevated)'`, `border: '1px solid var(--border-subtle)'`, `borderRadius: '6px'`, `padding: 'var(--space-sm)'`, `zIndex: 100`.

**Step 3: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`

**Step 4: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/stats/StatsControls.tsx
git commit -m "feat(stats): add StatsControls with date range dropdown and filter popover"
```

---

## Task 9: Rewrite StatsBento (Bento Grid Container)

**Files:**
- Modify: `electron-ui/renderer/src/components/Dashboard/StatsBento.tsx`

**Context:** Complete rewrite of the existing StatsBento. The new version uses the bento grid, renders StatCard components with LayoutGroup/AnimatePresence, and integrates StatsControls. Refer to existing file at `electron-ui/renderer/src/components/Dashboard/StatsBento.tsx:1-250`.

**Step 1: Rewrite StatsBento**

```typescript
// electron-ui/renderer/src/components/Dashboard/StatsBento.tsx
import { useMemo } from 'react';
import { LayoutGroup, AnimatePresence } from 'framer-motion';
import { useStatsFilter } from './stats/hooks/useStatsFilter';
import { useHeroSelection } from './stats/hooks/useHeroSelection';
import { StatsControls } from './stats/StatsControls';
import { StatCard } from './stats/StatCard';
import { STATS_BY_ID } from './stats/catalog';
import type { StatsPeriod, DashboardStatsPayload, StatId } from './stats/types';

interface StatsBentoProps {
  stats: DashboardStatsPayload | null;
  onPeriodChange: (period: StatsPeriod) => void;
}

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-md)',
};

const headerStyle: React.CSSProperties = { fontSize: '18px', margin: 0 };

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridTemplateRows: 'repeat(2, 1fr)',
  gap: 'var(--space-sm)',
};

const emptyStateStyle: React.CSSProperties = {
  gridColumn: '1 / -1', gridRow: '1 / -1',
  textAlign: 'center', padding: 'var(--space-xl) var(--space-md)',
  color: 'var(--text-muted)', fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
};

export function StatsBento({ stats, onPeriodChange }: StatsBentoProps) {
  const { activeStats, toggle, reset, isAtLimit } = useStatsFilter();
  const period: StatsPeriod = stats?.period ?? 'last_month';

  // Seed for hero randomization — changes on period + filter changes
  const heroSeed = useMemo(() => `${period}-${activeStats.join(',')}`, [period, activeStats]);
  const heroSet = useHeroSelection(activeStats, heroSeed);

  // Compute which stats fit in the 4x2 grid (8 cells)
  const visibleStats = useMemo(() => {
    let cellsUsed = 0;
    const visible: Array<{ id: StatId; isHero: boolean }> = [];
    for (const id of activeStats) {
      const isHero = heroSet.has(id);
      const stat = STATS_BY_ID.get(id);
      const cells = isHero && stat?.hero
        ? (stat.hero.direction === 'wide' ? 2 : 2) // both hero types take 2 cells
        : 1;
      if (cellsUsed + cells > 8) break;
      visible.push({ id, isHero });
      cellsUsed += cells;
    }
    return visible;
  }, [activeStats, heroSet]);

  const isLoading = stats === null;
  const allZero = stats !== null && Object.values(stats.stats).every((s) => s.value === 0);

  return (
    <section style={containerStyle} aria-label="Coding statistics">
      <div style={headerRowStyle}>
        <pre className="figlet-header" style={headerStyle}>STATS</pre>
        <StatsControls
          period={period}
          onPeriodChange={onPeriodChange}
          activeStats={activeStats}
          onToggle={toggle}
          onReset={reset}
          isAtLimit={isAtLimit}
        />
      </div>

      <LayoutGroup>
        <div style={gridStyle}>
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              // Skeleton placeholder cards
              Array.from({ length: 8 }, (_, i) => (
                <div key={`skeleton-${i}`} style={{
                  background: 'var(--bg-elevated)', borderRadius: '8px',
                  padding: 'var(--space-md)', animation: 'breathe 2s ease-in-out infinite',
                }} />
              ))
            ) : allZero ? (
              <p key="empty" style={emptyStateStyle}>Start coding to see your stats!</p>
            ) : (
              visibleStats.map(({ id, isHero }, index) => {
                const data = stats.stats[id];
                if (!data) return null;
                return (
                  <StatCard
                    key={id}
                    statId={id}
                    data={data}
                    isHero={isHero}
                    index={index}
                  />
                );
              })
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </section>
  );
}
```

**Step 2: Update Dashboard view** — Modify `electron-ui/renderer/src/views/Dashboard.tsx` to pass the new `DashboardStatsPayload` type and updated period values.

The key changes:
- Import `StatsPeriod` from `'../components/Dashboard/stats/types'` instead of local type
- Update `handlePeriodChange` to send the new period values (`'last_week'` instead of `'this_week'`, etc.)
- Update the `stats` state type to `DashboardStatsPayload | null`

**Step 3: Verify the app renders**

Run: `cd electron-ui && npm run dev`
Expected: Stats section renders with bento grid layout. Cards show with mock/real data.

**Step 4: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/StatsBento.tsx electron-ui/renderer/src/views/Dashboard.tsx
git commit -m "feat(stats): rewrite StatsBento with bento grid, hero cards, and controls"
```

---

## Task 10: Backend — Database Migration for New Tables

**Files:**
- Create: `src/database/migrations/002-stats-expansion.ts`
- Modify: `src/database/migrations/index.ts` (add migration to registry)

**Context:** Follow pattern from `src/database/migrations/001-initial.ts`. Uses Kysely migration API.

**Step 1: Write migration**

```typescript
// src/database/migrations/002-stats-expansion.ts
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`PRAGMA foreign_keys = ON`.execute(db);

  // hint_level_spans — tracks time at each hint level per session
  await db.schema
    .createTable('hint_level_spans')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'text', (col) => col.notNull().references('sessions.id'))
    .addColumn('level', 'integer', (col) => col.notNull())
    .addColumn('started_at', 'text', (col) => col.notNull())
    .addColumn('ended_at', 'text')
    .execute();

  await db.schema
    .createIndex('idx_hint_level_spans_session')
    .ifNotExists()
    .on('hint_level_spans')
    .column('session_id')
    .execute();

  // issue_labels — caches GitHub issue labels
  await db.schema
    .createTable('issue_labels')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('issue_number', 'integer', (col) => col.notNull())
    .addColumn('label_name', 'text', (col) => col.notNull())
    .addColumn('label_color', 'text')
    .execute();

  await db.schema
    .createIndex('idx_issue_labels_issue')
    .ifNotExists()
    .on('issue_labels')
    .column('issue_number')
    .execute();

  // Add total_duration_ms to sessions
  await db.schema
    .alterTable('sessions')
    .addColumn('total_duration_ms', 'integer')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('issue_labels').ifExists().execute();
  await db.schema.dropTable('hint_level_spans').ifExists().execute();
  // Note: SQLite doesn't support DROP COLUMN, but Kysely handles it
}
```

**Step 2: Register migration** — Add import to migration index file.

**Step 3: Test migration runs**

Run: `rm ~/.paige/paige.db && pnpm dev`
Expected: Server starts, creates DB with new tables. Verify:
```bash
sqlite3 ~/.paige/paige.db ".tables"
```
Expected: `hint_level_spans` and `issue_labels` in list.

**Step 4: Commit**

```bash
git add src/database/migrations/
git commit -m "feat(db): add hint_level_spans, issue_labels tables and sessions.total_duration_ms"
```

---

## Task 11: Backend — Update WebSocket Types

**Files:**
- Modify: `src/types/websocket.ts`

**Step 1: Update StatsPeriod type**

Change from: `type StatsPeriod = '7d' | '30d' | 'all';`
To: `type StatsPeriod = 'today' | 'last_week' | 'last_month' | 'all_time';`

**Step 2: Add StatId type and StatPayload interface**

Add the full `StatId` union type and `StatPayload` interface as defined in the design doc. Update `DashboardStats` to use the new `Record<StatId, StatPayload>` shape.

**Step 3: Update the dashboard stats message type** to use the new payload shape.

**Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: Errors in dashboard handler and queries (expected — we'll fix those next).

**Step 5: Commit**

```bash
git add src/types/websocket.ts
git commit -m "feat(types): update WebSocket stats types with 25 stat IDs and rich payloads"
```

---

## Task 12: Backend — Expand Stats Queries

**Files:**
- Modify: `src/database/queries/actions.ts` (expand existing query functions)
- Create: `src/database/queries/stats.ts` (new comprehensive stats query module)

**Context:** Follow existing query patterns from `actions.ts`. Each function accepts `AppDatabase` as first param, uses Kysely fluent API, period filtering with SQL datetime arithmetic.

**Step 1: Create stats.ts** with query functions for all 25 stats. Key functions:

- `getSessionCountByPeriod(db, period)` — already exists, update period values
- `getSessionDurationByPeriod(db, period)` — SUM of total_duration_ms
- `getActionCountByPeriod(db, period)` — already exists
- `getActionBreakdownByPeriod(db, period)` — GROUP BY action_type
- `getApiCallCountByPeriod(db, period)` — already exists
- `getApiCostByPeriod(db, period)` — already exists
- `getTokensByPeriod(db, period)` — SUM input/output tokens
- `getHintLevelBreakdownByPeriod(db, period)` — from hint_level_spans
- `getStreakDays(db)` — count consecutive days with sessions
- `getSparklineData(db, period, table, dateCol)` — generic sparkline generator
- `getIssueLabelsByPeriod(db, period)` — from issue_labels JOIN sessions
- `getDreyfusProgressions(db)` — latest assessment per skill
- `getKataStats(db)` — completed vs total
- `getKnowledgeGapsStats(db, period)` — resolved count

Each function also computes `change` by comparing current period vs previous equivalent.

**Step 2: Update period mapping** — Map `'today' → '-1 days'`, `'last_week' → '-7 days'`, `'last_month' → '-30 days'`, `'all_time' → null`.

**Step 3: Write unit test**

File: `tests/unit/database/queries/stats.test.ts`

Test a few key functions with an in-memory SQLite database.

**Step 4: Run tests**

Run: `pnpm test:unit -- tests/unit/database/queries/stats.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/database/queries/stats.ts tests/unit/database/queries/stats.test.ts
git commit -m "feat(queries): add 25 stat query functions with period filtering and change calculation"
```

---

## Task 13: Backend — Update Dashboard Handler

**Files:**
- Modify: `src/dashboard/handler.ts`
- Modify: `src/dashboard/flows/state.ts`

**Step 1: Update state flow** to call the new query functions and assemble the full `Record<StatId, StatPayload>` object. Import from `queries/stats.ts`.

**Step 2: Update period mapping** in handler. Remove old `'7d'/'30d'/'all'` mapping. Accept new period values directly.

**Step 3: Update broadcast message** to use new payload shape.

**Step 4: Test manually**

Run: `pnpm dev`, open Electron UI, verify stats load.

**Step 5: Commit**

```bash
git add src/dashboard/handler.ts src/dashboard/flows/state.ts
git commit -m "feat(dashboard): update handler to compute and broadcast 25 stats with rich payloads"
```

---

## Task 14: Frontend — Update WebSocket Message Types

**Files:**
- Modify: `electron-ui/shared/types/websocket-messages.ts`

**Step 1: Update DashboardStatsMessage** to use the new payload shape matching the design doc types. Update `StatsPeriod` type. Import or re-define `StatPayload` to match backend.

**Step 2: Update DashboardStatsPeriodMessage** with new period values.

**Step 3: Verify typecheck**

Run: `cd electron-ui && npm run typecheck`

**Step 4: Commit**

```bash
git add electron-ui/shared/types/websocket-messages.ts
git commit -m "feat(types): update frontend WebSocket message types for expanded stats protocol"
```

---

## Task 15: Integration Testing & Polish

**Files:**
- Modify: Various (CSS tweaks, responsive adjustments)

**Step 1: End-to-end manual test**

Run backend (`pnpm dev`) and Electron UI (`cd electron-ui && npm run dev`). Verify:
- [ ] Stats load with bento grid layout
- [ ] Date range dropdown changes period
- [ ] Filter popover toggles stats on/off
- [ ] Max 8 limit enforced in popover
- [ ] Reset button restores defaults
- [ ] Hero cards randomly chosen
- [ ] Hero cards re-randomize on period/filter change
- [ ] Layout animates smoothly when adding/removing cards
- [ ] Sparkline, donut, and bar heroes render charts
- [ ] Change indicators show up/down arrows
- [ ] Streak flame glows when > 0
- [ ] localStorage persists filter selection across reload
- [ ] Skeleton cards show during loading

**Step 2: Fix any visual issues** — spacing, overflow, font sizing, chart sizing.

**Step 3: Run lint and typecheck**

```bash
cd electron-ui && npm run lint && npm run typecheck
pnpm lint && pnpm typecheck
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(stats): polish bento grid layout, animations, and chart rendering"
```
