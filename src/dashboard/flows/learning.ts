// Dashboard Flow 4: Learning materials
// Returns materials in the shape the frontend expects: LearningMaterial[]
// Seeds demo data when no knowledge gaps or materials exist.

import type { LearningMaterial } from '../../types/domain.js';
import { getDatabase } from '../../database/db.js';
import { createLearningMaterial } from '../../database/queries/learning-materials.js';
import { getOrCreateDemoSessionId } from './demo-seed.js';

/** Wire format matching the frontend LearningMaterial entity (camelCase). */
interface MaterialWire {
  id: number;
  type: 'youtube' | 'article';
  url: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  question: string;
  viewCount: number;
  status: 'pending' | 'completed' | 'dismissed';
  createdAt: string;
}

export interface LearningMaterialsPayload {
  materials: MaterialWire[];
}

// ── Demo seed data ──────────────────────────────────────────────────────────

const DEMO_MATERIALS: Array<{
  type: 'youtube' | 'article';
  title: string;
  url: string;
  description: string;
  question: string;
}> = [
  {
    type: 'article',
    title: 'Claude API Documentation',
    url: 'https://docs.anthropic.com/en/api/getting-started',
    description: 'Official getting started guide for the Claude API',
    question: 'What authentication header does the Claude API require?',
  },
  {
    type: 'article',
    title: 'Claude Code Overview',
    url: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    description: 'Overview of Claude Code — the AI-powered coding assistant',
    question: 'What is the primary interface for interacting with Claude Code?',
  },
  {
    type: 'article',
    title: 'Building Effective Agents',
    url: 'https://www.anthropic.com/engineering/building-effective-agents',
    description: 'Anthropic engineering guide on designing effective AI agents',
    question: 'What are the key patterns for building reliable AI agents?',
  },
  {
    type: 'youtube',
    title: 'Claude for Developers',
    url: 'https://www.youtube.com/watch?v=T9aRN5JkmL8',
    description: 'Developer walkthrough of Claude API capabilities and best practices',
    question: 'What tool use pattern does Claude support for structured outputs?',
  },
  {
    type: 'youtube',
    title: "Anthropic's Prompt Engineering Guide",
    url: 'https://www.youtube.com/watch?v=T9aRN5JkmL8',
    description: 'Video guide covering prompt engineering techniques for Claude',
    question: 'What is the recommended approach for giving Claude complex instructions?',
  },
];

// ── Conversion ──────────────────────────────────────────────────────────────

/** Converts a database LearningMaterial row to the camelCase wire format. */
function toWireMaterial(row: LearningMaterial): MaterialWire {
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    question: row.question,
    viewCount: row.view_count,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ── Main assembly ───────────────────────────────────────────────────────────

/**
 * Assembles learning materials for the dashboard.
 *
 * When real knowledge gaps exist, queries the learning_materials table.
 * When no gaps exist, seeds demo materials so the dashboard is populated.
 * Returns null only if seeding somehow fails to produce any materials.
 */
export async function assembleLearningMaterials(): Promise<LearningMaterialsPayload | null> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialized. Cannot load learning materials.');
  }

  // Check for unaddressed knowledge gaps across all sessions
  const gaps = await db
    .selectFrom('knowledge_gaps')
    .selectAll()
    .where('addressed', '=', 0)
    .execute();

  if (gaps.length > 0) {
    // Real gaps exist — return any learning_materials rows
    const rows = await db
      .selectFrom('learning_materials')
      .selectAll()
      .where('status', '=', 'pending')
      .orderBy('created_at', 'desc')
      .execute();

    if (rows.length > 0) {
      const materials = shuffle((rows as LearningMaterial[]).map(toWireMaterial));
      return { materials };
    }
    // Gaps exist but no materials yet — fall through to seed
  }

  // No gaps or no materials — seed demo data
  const sessionId = await getOrCreateDemoSessionId(db);

  // Idempotent: check if this session already has learning materials
  const existing = await db
    .selectFrom('learning_materials')
    .selectAll()
    .where('session_id', '=', sessionId)
    .execute();

  if (existing.length > 0) {
    const materials = shuffle((existing as LearningMaterial[]).map(toWireMaterial));
    return { materials };
  }

  // Insert demo materials
  const inserted: LearningMaterial[] = [];
  for (const demo of DEMO_MATERIALS) {
    const material = await createLearningMaterial(db, {
      session_id: sessionId,
      phase_id: null,
      type: demo.type,
      url: demo.url,
      title: demo.title,
      description: demo.description,
      thumbnail_url: null,
      question: demo.question,
    });
    inserted.push(material);
  }

  const materials = shuffle(inserted.map(toWireMaterial));
  return { materials };
}
