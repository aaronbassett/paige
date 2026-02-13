import { useState, useCallback } from 'react';
import { DEFAULT_ACTIVE_STATS, MAX_ACTIVE_STATS } from '../catalog';
import type { StatId } from '../types';

const STORAGE_KEY = 'paige-stats-filter';

function loadFromStorage(): StatId[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as StatId[];
  } catch {
    /* ignore */
  }
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
