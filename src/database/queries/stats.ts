// Dummy stats generator for all 25 dashboard stat types.
// Returns plausible random data scaled by time period.
// Will be replaced with real database queries once data flows are complete.

import type { StatsPeriod, StatsData } from '../../types/websocket.js';

/** Random integer in [min, max] inclusive. */
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random float in [min, max] rounded to `decimals` places. */
function randFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/** Random change percentage between -25% and +40%. */
function randChange(): number {
  return randFloat(-25, 40, 1);
}

/** Scale factor based on time period (today=1, last_week=7, last_month=30, all_time=90). */
function periodMultiplier(period: StatsPeriod): number {
  switch (period) {
    case 'today':
      return 1;
    case 'last_week':
      return 7;
    case 'last_month':
      return 30;
    case 'all_time':
      return 90;
  }
}

/** Generate sparkline data points appropriate for the given period. */
function generateSparkline(
  period: StatsPeriod,
  baseValue: number,
): Array<{ x: string; y: number }> {
  const count =
    period === 'today' ? 7 : period === 'last_week' ? 7 : period === 'last_month' ? 30 : 12;
  const points: Array<{ x: string; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const variation = baseValue * (0.5 + Math.random());
    points.push({ x: `${i}`, y: Math.round(variation) });
  }
  return points;
}

/**
 * Generate plausible random data for all 25 dashboard stats.
 *
 * Data scales based on the selected period: today produces small numbers,
 * all_time produces larger ones. Includes sparklines, breakdowns, pills,
 * and progression arrays where appropriate for each stat type.
 */
export function generateDummyStats(period: StatsPeriod): StatsData {
  const m = periodMultiplier(period);

  return {
    // ── Big number stats with sparklines ──────────────────────────────────
    sessions: {
      value: rand(1, 5) * m,
      change: randChange(),
      unit: 'count',
      sparkline: generateSparkline(period, rand(2, 8)),
    },
    api_calls: {
      value: rand(20, 100) * m,
      change: randChange(),
      unit: 'count',
      sparkline: generateSparkline(period, rand(30, 80)),
    },
    actions: {
      value: rand(10, 60) * m,
      change: randChange(),
      unit: 'count',
      breakdown: [
        { label: 'File Edits', value: rand(5, 30) * m },
        { label: 'Terminal', value: rand(3, 20) * m },
        { label: 'Navigation', value: rand(2, 15) * m },
        { label: 'Reviews', value: rand(1, 10) * m },
      ],
    },
    coaching_messages: {
      value: rand(5, 30) * m,
      change: randChange(),
      unit: 'count',
      sparkline: generateSparkline(period, rand(5, 20)),
    },

    // ── Duration stats ────────────────────────────────────────────────────
    total_time: {
      value: rand(30, 180) * m * 60000, // milliseconds
      change: randChange(),
      unit: 'duration',
      breakdown: [
        { label: 'Coding', value: rand(20, 120) * m * 60000 },
        { label: 'Reading', value: rand(5, 30) * m * 60000 },
        { label: 'Terminal', value: rand(5, 30) * m * 60000 },
      ],
    },
    avg_session_duration: {
      value: rand(20, 90) * 60000, // does not scale with period
      change: randChange(),
      unit: 'duration',
    },

    // ── Currency stats ────────────────────────────────────────────────────
    total_cost: {
      value: randFloat(0.5, 5.0, 2) * m,
      change: randChange(),
      unit: 'currency',
      breakdown: [
        { label: 'Coaching', value: randFloat(0.3, 3.0, 2) * m },
        { label: 'Explain', value: randFloat(0.1, 1.0, 2) * m },
        { label: 'Review', value: randFloat(0.1, 1.0, 2) * m },
      ],
    },
    cost_per_session: {
      value: randFloat(0.5, 3.0, 2),
      change: randChange(),
      unit: 'currency',
    },

    // ── Percentage stats ──────────────────────────────────────────────────
    self_sufficiency: {
      value: randFloat(40, 95, 1),
      change: randChange(),
      unit: 'percentage',
      sparkline: generateSparkline(period, randFloat(50, 85, 0)),
    },
    token_efficiency: {
      value: randFloat(60, 95, 1),
      change: randChange(),
      unit: 'percentage',
    },

    // ── Hint level breakdown ──────────────────────────────────────────────
    hint_level_breakdown: {
      value: rand(10, 50) * m, // total hints
      change: randChange(),
      unit: 'count',
      breakdown: [
        { label: 'Level 1', value: rand(40, 60), color: '#7cb87c' },
        { label: 'Level 2', value: rand(20, 35), color: '#d4a843' },
        { label: 'Level 3', value: rand(5, 20), color: '#e05252' },
      ],
    },

    // ── Issues ────────────────────────────────────────────────────────────
    issues_worked_on: {
      value: rand(1, 5) * Math.ceil(m / 7),
      change: randChange(),
      unit: 'count',
      pills: [
        { label: 'bug', color: '#e05252', count: rand(1, 3) },
        { label: 'feature', color: '#7cb87c', count: rand(0, 2) },
        { label: 'docs', color: '#5b8dd9', count: rand(0, 2) },
        { label: 'refactor', color: '#d4a843', count: rand(0, 1) },
      ].filter((p) => p.count > 0),
    },
    issues_started: {
      value: rand(1, 3) * Math.ceil(m / 7),
      change: randChange(),
      unit: 'count',
    },

    // ── Dreyfus progression ───────────────────────────────────────────────
    dreyfus_progression: {
      value: ['Novice', 'Advanced Beginner', 'Competent', 'Proficient'][rand(0, 3)] as string,
      change: 0,
      unit: 'text',
      progression: [
        { skill: 'JavaScript', level: 'Competent' },
        { skill: 'TypeScript', level: 'Advanced Beginner' },
        { skill: 'React', level: 'Novice' },
        { skill: 'Testing', level: 'Novice' },
        { skill: 'Git', level: 'Advanced Beginner' },
      ],
    },

    // ── Simple counts ─────────────────────────────────────────────────────
    questions_asked: {
      value: rand(2, 15) * m,
      change: randChange(),
      unit: 'count',
    },
    reviews_requested: {
      value: rand(1, 5) * m,
      change: randChange(),
      unit: 'count',
    },
    files_touched: {
      value: rand(3, 20) * m,
      change: randChange(),
      unit: 'count',
    },
    lines_changed: {
      value: rand(50, 500) * m,
      change: randChange(),
      unit: 'count',
    },
    materials_viewed: {
      value: rand(1, 10) * Math.ceil(m / 7),
      change: randChange(),
      unit: 'count',
    },
    knowledge_gaps_closed: {
      value: rand(0, 5) * Math.ceil(m / 7),
      change: randChange(),
      unit: 'count',
    },

    // ── Special cards ─────────────────────────────────────────────────────
    streak: {
      value: rand(0, 14),
      change: 0,
      unit: 'count',
    },
    most_active_language: {
      value: ['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go'][rand(0, 4)] as string,
      change: 0,
      unit: 'text',
      breakdown: [{ label: 'lines', value: rand(100, 2000) }],
    },
    kata_completion: {
      value: rand(1, 8),
      change: randChange(),
      unit: 'count',
      breakdown: [{ label: 'total', value: rand(5, 15) }],
    },
    oldest_issue_closed: {
      value: `${rand(5, 90)} days`,
      change: 0,
      unit: 'text',
    },
    youngest_issue_closed: {
      value: `${rand(1, 7)} days`,
      change: 0,
      unit: 'text',
    },
  };
}
