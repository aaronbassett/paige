import { motion } from 'framer-motion';
import { STATS_BY_ID } from './catalog';
import type { StatId, StatPayload, HeroDirection, CardType, HeroType } from './types';
import {
  BigNumberCard,
  DurationCard,
  CurrencyCard,
  PercentageCard,
  StreakCard,
  HintLevelCard,
  LanguageCard,
  KataCard,
  AgeCard,
  DreyfusCard,
  IssuesWorkedCard,
} from './cards';
import { SparklineHero, BarChartHero, DonutHero, IssuesHero, DreyfusHero } from './heroes';

const CARD_TYPE_MAP: Record<CardType, typeof BigNumberCard> = {
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
};

const HERO_TYPE_MAP: Record<HeroType, typeof SparklineHero> = {
  sparkline: SparklineHero,
  bar_chart: BarChartHero,
  donut: DonutHero,
  issues_pills: IssuesHero,
  dreyfus_timeline: DreyfusHero,
};

function getGridSpan(isHero: boolean, direction?: HeroDirection): React.CSSProperties {
  if (!isHero) return {};
  return direction === 'wide' ? { gridColumn: 'span 2' } : { gridRow: 'span 2' };
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
  const Component =
    isHero && stat.hero ? HERO_TYPE_MAP[stat.hero.heroType] : CARD_TYPE_MAP[stat.cardType];

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
