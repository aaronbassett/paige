// Dashboard Flow 3: Active kata challenges
// Queries all katas with non-empty user_attempts and maps to DashboardChallenge format

import type { DashboardChallengesData } from '../../types/websocket.js';
import type { KataAttempt } from '../../types/domain.js';
import { getDatabase } from '../../database/db.js';

/**
 * Loads all in-progress katas with attempt count and max level.
 *
 * Joins kata_specs with knowledge_gaps to get the gap topic for each kata.
 * Filters to katas that have at least one user attempt (non-empty JSON array).
 * Maps each result to DashboardChallenge format with attempt count and highest
 * level achieved across all attempts.
 */
export async function assembleChallenges(): Promise<DashboardChallengesData> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialised');
  }

  // Get all katas with their gap's topic via a join
  const rows = await db
    .selectFrom('kata_specs')
    .innerJoin('knowledge_gaps', 'knowledge_gaps.id', 'kata_specs.gap_id')
    .select([
      'kata_specs.id',
      'kata_specs.title',
      'kata_specs.description',
      'kata_specs.user_attempts',
      'knowledge_gaps.topic',
    ])
    .execute();

  const challenges = rows
    .map((row) => {
      const attemptsRaw: unknown = JSON.parse(String(row.user_attempts));
      const attempts = attemptsRaw as KataAttempt[];
      if (attempts.length === 0) return null;
      const maxLevel = Math.max(0, ...attempts.map((a) => a.level));
      return {
        id: Number(row.id),
        title: String(row.title),
        description: String(row.description),
        attempts: attempts.length,
        maxLevel,
        gap: String(row.topic),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return { challenges };
}
