// Dashboard Flow 3: Practice challenges
// Returns challenges in the shape the frontend expects: { id, title, difficulty, estimatedMinutes }
// Seeds demo data when no katas exist in the database.

import { getDatabase } from '../../database/db.js';
import { createGap } from '../../database/queries/gaps.js';
import { createKata } from '../../database/queries/katas.js';
import { getOrCreateDemoSessionId } from './demo-seed.js';

/** Wire format matching the frontend PracticeChallenges component. */
interface ChallengeWire {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
}

export interface ChallengesPayload {
  challenges: ChallengeWire[];
}

// ── Demo seed data ──────────────────────────────────────────────────────────

const DEMO_CHALLENGES: Array<{
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  scaffolding: string;
  constraints: string[];
}> = [
  {
    title: 'Array Deduplication',
    description:
      'Write a TypeScript function `deduplicate<T>(items: T[]): T[]` that removes duplicate values from an array.',
    difficulty: 'easy',
    estimatedMinutes: 10,
    scaffolding: 'export function deduplicate<T>(items: T[]): T[] {\n  // your code here\n}',
    constraints: [
      'Preserve original order of first occurrence',
      'Handle objects by reference equality',
      'Do not use Set',
    ],
  },
  {
    title: 'Type-Safe Event Emitter',
    description:
      'Implement a type-safe event emitter class in TypeScript with `on`, `off`, and `emit` methods.',
    difficulty: 'medium',
    estimatedMinutes: 20,
    scaffolding: [
      'interface EventMap {',
      '  [event: string]: unknown;',
      '}',
      '',
      'export class TypedEmitter<T extends EventMap> {',
      '  on<K extends keyof T>(event: K, listener: (payload: T[K]) => void): void {',
      '    // your code here',
      '  }',
      '',
      '  off<K extends keyof T>(event: K, listener: (payload: T[K]) => void): void {',
      '    // your code here',
      '  }',
      '',
      '  emit<K extends keyof T>(event: K, payload: T[K]): void {',
      '    // your code here',
      '  }',
      '}',
    ].join('\n'),
    constraints: [
      'Generic type parameter for event map',
      'Must support multiple listeners per event',
      'emit must enforce correct payload types',
    ],
  },
];

// ── Main assembly ───────────────────────────────────────────────────────────

/**
 * Assembles challenge data for the dashboard.
 *
 * Returns all existing katas mapped to the frontend wire format.
 * When no katas exist, seeds demo challenges so the dashboard is populated.
 */
export async function assembleChallenges(): Promise<ChallengesPayload> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialized. Cannot load dashboard challenges.');
  }

  // Check if ANY kata_specs rows exist
  const rows = await db
    .selectFrom('kata_specs')
    .innerJoin('knowledge_gaps', 'knowledge_gaps.id', 'kata_specs.gap_id')
    .select(['kata_specs.id', 'kata_specs.title', 'kata_specs.description'])
    .execute();

  if (rows.length > 0) {
    // Map existing katas — infer difficulty from description length as a rough heuristic
    const challenges: ChallengeWire[] = rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      difficulty: inferDifficulty(String(row.description)),
      estimatedMinutes: inferTime(String(row.description)),
    }));
    return { challenges };
  }

  // No katas at all — seed demo data
  const sessionId = await getOrCreateDemoSessionId(db);
  const now = new Date().toISOString();

  const gap = await createGap(db, {
    session_id: sessionId,
    topic: 'TypeScript fundamentals',
    severity: 'medium',
    evidence: 'Demo seed',
    related_concepts: JSON.stringify(['generics', 'type narrowing', 'utility types']),
    identified_at: now,
  });

  const challenges: ChallengeWire[] = [];

  for (const demo of DEMO_CHALLENGES) {
    const kata = await createKata(db, {
      gap_id: gap.id,
      title: demo.title,
      description: demo.description,
      scaffolding_code: demo.scaffolding,
      instructor_notes: `Difficulty: ${demo.difficulty}, Est: ${demo.estimatedMinutes}min`,
      constraints: JSON.stringify(demo.constraints),
      created_at: now,
    });

    challenges.push({
      id: String(kata.id),
      title: demo.title,
      difficulty: demo.difficulty,
      estimatedMinutes: demo.estimatedMinutes,
    });
  }

  return { challenges };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function inferDifficulty(description: string): 'easy' | 'medium' | 'hard' {
  if (description.length > 200) return 'hard';
  if (description.length > 100) return 'medium';
  return 'easy';
}

function inferTime(description: string): number {
  if (description.length > 200) return 30;
  if (description.length > 100) return 20;
  return 10;
}
