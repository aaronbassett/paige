import { useMemo } from 'react';
import { STATS_BY_ID } from '../catalog';
import type { StatId, HeroDirection } from '../types';

export function useHeroSelection(
  activeStats: readonly StatId[],
  seed: string // changes on period change / filter change to trigger re-randomization
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
      const opposite = shuffled
        .slice(1)
        .find((id) => STATS_BY_ID.get(id)!.hero!.direction === oppositeDir);
      picked.add(opposite ?? shuffled[1]);
    }

    return picked;
  }, [activeStats, seed]);
}
