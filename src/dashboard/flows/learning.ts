// Dashboard Flow 4: Learning materials for unaddressed knowledge gaps

import type { DashboardLearningMaterialsData, LearningResource } from '../../types/websocket.js';
import { getDatabase } from '../../database/db.js';

// ── Static Curated Learning Resources ──────────────────────────────────────
// MVP approach: a static mapping of knowledge gap topics to curated resources.
// In a future iteration this could be replaced by a real search or LLM lookup.

const LEARNING_RESOURCES: Record<string, LearningResource[]> = {
  typescript: [
    {
      title: 'TypeScript Handbook',
      url: 'https://www.typescriptlang.org/docs/handbook/',
      description: 'Official TypeScript documentation and tutorials',
    },
    {
      title: 'TypeScript Deep Dive',
      url: 'https://basarat.gitbook.io/typescript/',
      description: 'Comprehensive free book on TypeScript',
    },
  ],
  testing: [
    {
      title: 'Vitest Documentation',
      url: 'https://vitest.dev/guide/',
      description: 'Official Vitest testing framework guide',
    },
    {
      title: 'Testing JavaScript',
      url: 'https://testingjavascript.com/',
      description: 'Comprehensive testing course by Kent C. Dodds',
    },
  ],
  react: [
    {
      title: 'React Documentation',
      url: 'https://react.dev/',
      description: 'Official React documentation with tutorials',
    },
    {
      title: 'React Patterns',
      url: 'https://reactpatterns.com/',
      description: 'Common React patterns and best practices',
    },
  ],
  git: [
    {
      title: 'Pro Git Book',
      url: 'https://git-scm.com/book/en/v2',
      description: 'Comprehensive free Git book',
    },
  ],
  css: [
    {
      title: 'MDN CSS Guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/CSS',
      description: 'Mozilla Developer Network CSS reference',
    },
  ],
  'error handling': [
    {
      title: 'Error Handling in TypeScript',
      url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html',
      description: 'TypeScript narrowing and error handling patterns',
    },
  ],
  async: [
    {
      title: 'JavaScript.info Async',
      url: 'https://javascript.info/async',
      description: 'Modern JavaScript async/await tutorial',
    },
  ],
  database: [
    {
      title: 'SQLite Documentation',
      url: 'https://www.sqlite.org/docs.html',
      description: 'Official SQLite documentation',
    },
    {
      title: 'Kysely Documentation',
      url: 'https://kysely.dev/',
      description: 'Type-safe TypeScript SQL query builder',
    },
  ],
  javascript: [
    {
      title: 'JavaScript.info',
      url: 'https://javascript.info/',
      description: 'The Modern JavaScript Tutorial',
    },
  ],
  node: [
    {
      title: 'Node.js Documentation',
      url: 'https://nodejs.org/docs/latest/api/',
      description: 'Official Node.js API reference',
    },
  ],
};

/** Fallback resources when no topic-specific match is found. */
const DEFAULT_RESOURCES: LearningResource[] = [
  {
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/',
    description: 'Comprehensive web development reference',
  },
  {
    title: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/',
    description: 'Free coding curriculum and challenges',
  },
];

/**
 * Finds curated learning resources for a knowledge gap topic.
 *
 * Performs a case-insensitive bidirectional substring match:
 * the topic contains the key, or the key contains the topic.
 * Falls back to default resources when no match is found.
 */
function findResources(topic: string): LearningResource[] {
  const lowerTopic = topic.toLowerCase();
  for (const [key, resources] of Object.entries(LEARNING_RESOURCES)) {
    if (lowerTopic.includes(key) || key.includes(lowerTopic)) {
      return resources;
    }
  }
  return DEFAULT_RESOURCES;
}

/**
 * Finds unaddressed knowledge gaps and returns curated learning resources.
 *
 * Queries ALL unaddressed knowledge gaps across all sessions (not scoped to one session).
 * For each gap, looks up curated resources from the static mapping.
 * Returns `null` when no unaddressed gaps exist (Flow 4 is skipped).
 */
export async function assembleLearningMaterials(): Promise<DashboardLearningMaterialsData | null> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialized. Cannot load learning materials.');
  }

  // Find all unaddressed knowledge gaps across all sessions
  const gaps = await db
    .selectFrom('knowledge_gaps')
    .selectAll()
    .where('addressed', '=', 0)
    .execute();

  if (gaps.length === 0) {
    return null;
  }

  const materials = gaps.map((gap) => ({
    gap: String(gap.topic),
    resources: findResources(String(gap.topic)),
  }));

  return { materials };
}
