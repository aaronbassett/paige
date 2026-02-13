import type { LucideIcon } from 'lucide-react';

export type StatId =
  | 'sessions'
  | 'total_time'
  | 'total_cost'
  | 'api_calls'
  | 'actions'
  | 'coaching_messages'
  | 'hint_level_breakdown'
  | 'issues_worked_on'
  | 'dreyfus_progression'
  | 'self_sufficiency'
  | 'questions_asked'
  | 'reviews_requested'
  | 'files_touched'
  | 'lines_changed'
  | 'issues_started'
  | 'avg_session_duration'
  | 'cost_per_session'
  | 'streak'
  | 'materials_viewed'
  | 'most_active_language'
  | 'token_efficiency'
  | 'kata_completion'
  | 'oldest_issue_closed'
  | 'youngest_issue_closed'
  | 'knowledge_gaps_closed';

export type StatsPeriod = 'today' | 'last_week' | 'last_month' | 'all_time';

export type HeroDirection = 'wide' | 'tall';

export type CardType =
  | 'big_number'
  | 'duration'
  | 'currency'
  | 'percentage'
  | 'streak'
  | 'hint_level'
  | 'language'
  | 'kata'
  | 'age'
  | 'dreyfus'
  | 'issues_worked';

export type HeroType = 'sparkline' | 'bar_chart' | 'donut' | 'issues_pills' | 'dreyfus_timeline';

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
  readonly breakdown?: ReadonlyArray<{
    label: string;
    value: number;
    color?: string;
  }>;
  readonly pills?: ReadonlyArray<{
    label: string;
    color: string;
    count: number;
  }>;
  readonly progression?: ReadonlyArray<{ skill: string; level: string }>;
}

export type StatsData = Partial<Record<StatId, StatPayload>>;

export interface DashboardStatsPayload {
  readonly period: StatsPeriod;
  readonly stats: StatsData;
}
