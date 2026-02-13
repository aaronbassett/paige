import {
  Activity,
  Clock,
  DollarSign,
  Zap,
  MessageCircle,
  Eye,
  FileText,
  Code,
  PlusCircle,
  Calculator,
  Flame,
  BookOpen,
  Target,
  Calendar,
  Layers,
  GitPullRequest,
  Brain,
  Shield,
} from 'lucide-react';
import type { StatDefinition, StatId, StatsPeriod } from './types';

export const STATS_CATALOG: readonly StatDefinition[] = [
  // --- Hero-capable stats ---
  {
    id: 'sessions',
    label: 'Sessions',
    cardType: 'big_number',
    icon: Activity,
    hero: { direction: 'wide', heroType: 'sparkline' },
  },
  {
    id: 'total_time',
    label: 'Total Time Spent',
    cardType: 'duration',
    icon: Clock,
    hero: { direction: 'wide', heroType: 'donut' },
  },
  {
    id: 'total_cost',
    label: 'Total Cost',
    cardType: 'currency',
    icon: DollarSign,
    hero: { direction: 'wide', heroType: 'bar_chart' },
  },
  {
    id: 'api_calls',
    label: 'API Calls',
    cardType: 'big_number',
    icon: Zap,
    hero: { direction: 'wide', heroType: 'sparkline' },
  },
  {
    id: 'actions',
    label: 'Actions',
    cardType: 'big_number',
    icon: Activity,
    hero: { direction: 'tall', heroType: 'bar_chart' },
  },
  {
    id: 'coaching_messages',
    label: 'Coaching Messages',
    cardType: 'big_number',
    icon: MessageCircle,
    hero: { direction: 'wide', heroType: 'sparkline' },
  },
  {
    id: 'hint_level_breakdown',
    label: 'Hint Level Breakdown',
    cardType: 'hint_level',
    icon: Layers,
    hero: { direction: 'tall', heroType: 'donut' },
  },
  {
    id: 'issues_worked_on',
    label: 'Issues Worked On',
    cardType: 'big_number',
    icon: GitPullRequest,
    hero: { direction: 'tall', heroType: 'issues_pills' },
  },
  {
    id: 'dreyfus_progression',
    label: 'Dreyfus Progression',
    cardType: 'dreyfus',
    icon: Brain,
    hero: { direction: 'tall', heroType: 'dreyfus_timeline' },
  },
  {
    id: 'self_sufficiency',
    label: 'Self-Sufficiency',
    cardType: 'percentage',
    icon: Shield,
    hero: { direction: 'wide', heroType: 'sparkline' },
  },
  // --- Normal-only stats ---
  {
    id: 'questions_asked',
    label: 'Questions Asked',
    cardType: 'big_number',
    icon: MessageCircle,
  },
  {
    id: 'reviews_requested',
    label: 'Reviews Requested',
    cardType: 'big_number',
    icon: Eye,
  },
  {
    id: 'files_touched',
    label: 'Files Touched',
    cardType: 'big_number',
    icon: FileText,
  },
  {
    id: 'lines_changed',
    label: 'Lines Changed',
    cardType: 'big_number',
    icon: Code,
  },
  {
    id: 'issues_started',
    label: 'Issues Started',
    cardType: 'big_number',
    icon: PlusCircle,
  },
  {
    id: 'avg_session_duration',
    label: 'Avg Session Duration',
    cardType: 'duration',
    icon: Clock,
  },
  {
    id: 'cost_per_session',
    label: 'Cost Per Session',
    cardType: 'currency',
    icon: Calculator,
  },
  { id: 'streak', label: 'Streak', cardType: 'streak', icon: Flame },
  {
    id: 'materials_viewed',
    label: 'Materials Viewed',
    cardType: 'big_number',
    icon: BookOpen,
  },
  {
    id: 'most_active_language',
    label: 'Most Active Language',
    cardType: 'language',
    icon: Code,
  },
  {
    id: 'token_efficiency',
    label: 'Token Efficiency',
    cardType: 'percentage',
    icon: Zap,
  },
  {
    id: 'kata_completion',
    label: 'Kata Completion',
    cardType: 'kata',
    icon: Target,
  },
  {
    id: 'oldest_issue_closed',
    label: 'Oldest Issue Closed',
    cardType: 'age',
    icon: Calendar,
  },
  {
    id: 'youngest_issue_closed',
    label: 'Youngest Issue Closed',
    cardType: 'age',
    icon: Clock,
  },
  {
    id: 'knowledge_gaps_closed',
    label: 'Gaps Closed',
    cardType: 'big_number',
    icon: Target,
  },
] as const;

export const STATS_BY_ID: ReadonlyMap<StatId, StatDefinition> = new Map(
  STATS_CATALOG.map((s) => [s.id, s])
);

export const DEFAULT_ACTIVE_STATS: readonly StatId[] = [
  'sessions',
  'total_time',
  'total_cost',
  'actions',
  'api_calls',
  'coaching_messages',
  'streak',
  'self_sufficiency',
];

export const MAX_ACTIVE_STATS = 8;

export const PERIODS: readonly { key: StatsPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all_time', label: 'All Time' },
];
