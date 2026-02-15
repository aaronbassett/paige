# Learning Materials Dashboard PoC — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the learning materials panel on the Paige dashboard — AI generates relevant YouTube/article resources per coaching phase, developers verify comprehension via AI-checked questions.

**Architecture:** New `learning_materials` SQLite table + generation agent triggered at phase completion + three WebSocket handlers (view/complete/dismiss) + updated Electron dashboard panel with card list, completion modal, and toast feedback.

**Tech Stack:** Kysely (migrations/queries), Zod (structured output schemas), Anthropic SDK (generation + verification), Playwright (article thumbnails), Framer Motion (card animations), react-toastify (feedback toasts).

**Design doc:** `docs/plans/2026-02-15-learning-materials-design.md`

---

## Task 1: Backend Types — LearningMaterial Entity & Action Types

**Files:**
- Modify: `src/types/domain.ts`

**Step 1: Add LearningMaterial entity type**

Add after the existing entity types (after the `KataSpec` interface):

```typescript
export type LearningMaterialType = 'youtube' | 'article';
export type LearningMaterialStatus = 'pending' | 'completed' | 'dismissed';

export interface LearningMaterial {
  id: number;
  session_id: number;
  phase_id: number | null;
  type: LearningMaterialType;
  url: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  question: string;
  status: LearningMaterialStatus;
  view_count: number;
  created_at: string;
  completed_at: string | null;
}
```

**Step 2: Add to DatabaseTables interface**

In the `DatabaseTables` interface, add:

```typescript
learning_materials: LearningMaterial;
```

**Step 3: Add new action types**

Add to the `ActionType` union:

```typescript
| 'learning_material_generated'
| 'learning_material_viewed'
| 'learning_material_completed'
| 'learning_material_dismissed'
| 'learning_material_answer_checked'
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: Should pass (types are additive, no consumers yet)

**Step 5: Commit**

```bash
git add src/types/domain.ts
git commit -m "feat(types): add LearningMaterial entity and action types"
```

---

## Task 2: Backend — Database Migration

**Files:**
- Create: `src/database/migrations/004-learning-materials.ts`
- Modify: `src/database/db.ts`

**Step 1: Write the migration**

Create `src/database/migrations/004-learning-materials.ts`:

```typescript
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('learning_materials')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('phase_id', 'integer', (col) => col.references('phases.id'))
    .addColumn('type', 'text', (col) =>
      col.notNull().check(sql`type IN ('youtube', 'article')`),
    )
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('thumbnail_url', 'text')
    .addColumn('question', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) =>
      col.notNull().defaultTo('pending').check(sql`status IN ('pending', 'completed', 'dismissed')`),
    )
    .addColumn('view_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('completed_at', 'text')
    .execute();

  await db.schema
    .createIndex('idx_learning_materials_session_id')
    .ifNotExists()
    .on('learning_materials')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_learning_materials_status')
    .ifNotExists()
    .on('learning_materials')
    .column('status')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_learning_materials_status').ifExists().execute();
  await db.schema.dropIndex('idx_learning_materials_session_id').ifExists().execute();
  await db.schema.dropTable('learning_materials').ifExists().execute();
}
```

**Step 2: Register migration in db.ts**

In `src/database/db.ts`, add the import alongside existing migration imports:

```typescript
import * as migration004 from './migrations/004-learning-materials.js';
```

Add to the InlineMigrationProvider's `getMigrations()` return object:

```typescript
'004-learning-materials': migration004,
```

**Step 3: Verify migration runs**

Run: `pnpm dev` (start server, migration auto-runs)
Expected: No errors. Check with: `sqlite3 ~/.paige/paige.db ".schema learning_materials"`

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/database/migrations/004-learning-materials.ts src/database/db.ts
git commit -m "feat(db): add learning_materials table migration"
```

---

## Task 3: Backend — Query Functions

**Files:**
- Create: `src/database/queries/learning-materials.ts`

**Step 1: Write the failing test**

Create `src/database/queries/__tests__/learning-materials.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase, getDatabase } from '../../db.js';
import {
  createLearningMaterial,
  getLearningMaterialsBySession,
  getLearningMaterial,
  updateLearningMaterialStatus,
  incrementViewCount,
  type CreateLearningMaterialInput,
} from '../learning-materials.js';
import { createSession } from '../sessions.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('learning-materials queries', () => {
  let dbPath: string;
  let sessionId: number;

  beforeEach(async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paige-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    await createDatabase(dbPath);
    const session = await createSession(getDatabase()!, {
      project_dir: '/test',
      status: 'active',
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('creates and retrieves a learning material', async () => {
    const input: CreateLearningMaterialInput = {
      session_id: sessionId,
      phase_id: null,
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Test Video',
      description: 'A test video',
      thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      question: 'What is this video about?',
    };
    const material = await createLearningMaterial(getDatabase()!, input);
    expect(material.id).toBeGreaterThan(0);
    expect(material.status).toBe('pending');
    expect(material.view_count).toBe(0);

    const fetched = await getLearningMaterial(getDatabase()!, material.id);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe('Test Video');
  });

  it('lists pending materials for a session', async () => {
    const db = getDatabase()!;
    await createLearningMaterial(db, {
      session_id: sessionId, phase_id: null, type: 'article',
      url: 'https://example.com', title: 'Article', description: 'Desc',
      thumbnail_url: null, question: 'Q?',
    });
    await createLearningMaterial(db, {
      session_id: sessionId, phase_id: null, type: 'youtube',
      url: 'https://youtube.com/watch?v=abc', title: 'Video', description: 'Desc',
      thumbnail_url: null, question: 'Q?',
    });

    const materials = await getLearningMaterialsBySession(db, sessionId);
    expect(materials).toHaveLength(2);
  });

  it('updates status to completed', async () => {
    const db = getDatabase()!;
    const material = await createLearningMaterial(db, {
      session_id: sessionId, phase_id: null, type: 'youtube',
      url: 'https://youtube.com/watch?v=abc', title: 'Video', description: 'Desc',
      thumbnail_url: null, question: 'Q?',
    });

    const updated = await updateLearningMaterialStatus(db, material.id, 'completed');
    expect(updated!.status).toBe('completed');
    expect(updated!.completed_at).not.toBeNull();
  });

  it('increments view count', async () => {
    const db = getDatabase()!;
    const material = await createLearningMaterial(db, {
      session_id: sessionId, phase_id: null, type: 'youtube',
      url: 'https://youtube.com/watch?v=abc', title: 'Video', description: 'Desc',
      thumbnail_url: null, question: 'Q?',
    });

    const updated = await incrementViewCount(db, material.id);
    expect(updated!.view_count).toBe(1);

    const updated2 = await incrementViewCount(db, material.id);
    expect(updated2!.view_count).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/database/queries/__tests__/learning-materials.test.ts`
Expected: FAIL — module not found

**Step 3: Write the query module**

Create `src/database/queries/learning-materials.ts`:

```typescript
import type { Kysely } from 'kysely';
import type { DatabaseTables, LearningMaterial, LearningMaterialStatus } from '../../types/domain.js';

export interface CreateLearningMaterialInput {
  session_id: number;
  phase_id: number | null;
  type: 'youtube' | 'article';
  url: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  question: string;
}

export async function createLearningMaterial(
  db: Kysely<DatabaseTables>,
  input: CreateLearningMaterialInput,
): Promise<LearningMaterial> {
  const created_at = new Date().toISOString();

  const result = await db
    .insertInto('learning_materials')
    .values({
      ...input,
      status: 'pending',
      view_count: 0,
      created_at,
      completed_at: null,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);
  return db
    .selectFrom('learning_materials')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
}

export async function getLearningMaterial(
  db: Kysely<DatabaseTables>,
  id: number,
): Promise<LearningMaterial | undefined> {
  return db
    .selectFrom('learning_materials')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function getLearningMaterialsBySession(
  db: Kysely<DatabaseTables>,
  sessionId: number,
  statusFilter: LearningMaterialStatus = 'pending',
): Promise<LearningMaterial[]> {
  return db
    .selectFrom('learning_materials')
    .selectAll()
    .where('session_id', '=', sessionId)
    .where('status', '=', statusFilter)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function updateLearningMaterialStatus(
  db: Kysely<DatabaseTables>,
  id: number,
  status: LearningMaterialStatus,
): Promise<LearningMaterial | undefined> {
  const updates: Record<string, unknown> = { status };
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  await db
    .updateTable('learning_materials')
    .set(updates as never)
    .where('id', '=', id)
    .execute();

  return getLearningMaterial(db, id);
}

export async function incrementViewCount(
  db: Kysely<DatabaseTables>,
  id: number,
): Promise<LearningMaterial | undefined> {
  const material = await getLearningMaterial(db, id);
  if (!material) return undefined;

  await db
    .updateTable('learning_materials')
    .set({ view_count: material.view_count + 1 } as never)
    .where('id', '=', id)
    .execute();

  return getLearningMaterial(db, id);
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/database/queries/__tests__/learning-materials.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/database/queries/learning-materials.ts src/database/queries/__tests__/learning-materials.test.ts
git commit -m "feat(db): add learning_materials query functions with tests"
```

---

## Task 4: Backend — AI Generation Schema & Agent

**Files:**
- Modify: `src/api-client/schemas.ts`
- Create: `src/coaching/agents/materials.ts`

**Step 1: Add Zod schema for material generation**

In `src/api-client/schemas.ts`, add:

```typescript
export const learningMaterialGenerationSchema = z.object({
  materials: z.array(
    z.object({
      type: z.enum(['youtube', 'article']),
      url: z.string().url(),
      title: z.string(),
      description: z.string(),
      question: z.string(),
    }),
  ),
});

export type LearningMaterialGenerationResponse = z.infer<typeof learningMaterialGenerationSchema>;
```

**Step 2: Add answer verification schema**

In the same file, add:

```typescript
export const answerVerificationSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
});

export type AnswerVerificationResponse = z.infer<typeof answerVerificationSchema>;
```

**Step 3: Create the materials generation agent**

Create `src/coaching/agents/materials.ts`:

```typescript
import { callApi } from '../../api-client/claude.js';
import {
  learningMaterialGenerationSchema,
  type LearningMaterialGenerationResponse,
} from '../../api-client/schemas.js';

export interface MaterialsAgentInput {
  phaseTitle: string;
  phaseDescription: string;
  knowledgeGaps: Array<{ topic: string; description: string }>;
  issueTitle: string;
  sessionId: number;
}

const MATERIALS_SYSTEM_PROMPT = `You are a learning resource curator for junior developers. Given a coding task and identified knowledge gaps, recommend 2-3 high-quality learning resources.

Rules:
- Mix YouTube videos and articles (at least one of each when possible)
- Prefer well-known sources: MDN Web Docs, official documentation, Fireship, Traversy Media, ThePrimeagen, freeCodeCamp, web.dev, CSS-Tricks
- YouTube URLs must be real, well-known videos from established channels. Use the format https://www.youtube.com/watch?v=VIDEO_ID
- Article URLs must be from established documentation sites or blogs
- Each description should be 1-2 sentences explaining why this resource is relevant
- Each question should test whether the developer actually engaged with the material — not trivial recall, but understanding of a key concept covered in the resource
- Questions should be answerable in 2-3 sentences`;

export function runMaterialsAgent(
  input: MaterialsAgentInput,
): Promise<LearningMaterialGenerationResponse> {
  const userMessage = JSON.stringify({
    task: input.issueTitle,
    phase: { title: input.phaseTitle, description: input.phaseDescription },
    knowledge_gaps: input.knowledgeGaps,
  });

  return callApi<LearningMaterialGenerationResponse>({
    callType: 'materials_generation',
    model: 'sonnet',
    systemPrompt: MATERIALS_SYSTEM_PROMPT,
    userMessage,
    responseSchema: learningMaterialGenerationSchema,
    sessionId: input.sessionId,
    maxTokens: 2048,
  });
}
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/api-client/schemas.ts src/coaching/agents/materials.ts
git commit -m "feat(coaching): add materials generation agent and schemas"
```

---

## Task 5: Backend — Answer Verification Service

**Files:**
- Create: `src/coaching/agents/verify-answer.ts`

**Step 1: Create the verification agent**

Create `src/coaching/agents/verify-answer.ts`:

```typescript
import { callApi } from '../../api-client/claude.js';
import {
  answerVerificationSchema,
  type AnswerVerificationResponse,
} from '../../api-client/schemas.js';

export interface VerifyAnswerInput {
  materialTitle: string;
  materialUrl: string;
  materialType: 'youtube' | 'article';
  question: string;
  answer: string;
  sessionId: number;
}

const VERIFY_SYSTEM_PROMPT = `You are evaluating whether a junior developer understood a learning resource. Be encouraging but honest.

Rules:
- The answer doesn't need to be perfect — it should show genuine engagement with the material
- Accept answers that demonstrate understanding of the core concept, even with imperfect wording
- Err on the side of accepting — this is coaching, not an exam
- If incorrect, provide brief encouraging feedback suggesting what to focus on when revisiting the material
- feedback should be 1-2 sentences max`;

export function verifyAnswer(
  input: VerifyAnswerInput,
): Promise<AnswerVerificationResponse> {
  const userMessage = JSON.stringify({
    material: {
      title: input.materialTitle,
      url: input.materialUrl,
      type: input.materialType,
    },
    question: input.question,
    developer_answer: input.answer,
  });

  return callApi<AnswerVerificationResponse>({
    callType: 'answer_verification',
    model: 'haiku',
    systemPrompt: VERIFY_SYSTEM_PROMPT,
    userMessage,
    responseSchema: answerVerificationSchema,
    sessionId: input.sessionId,
    maxTokens: 512,
  });
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/coaching/agents/verify-answer.ts
git commit -m "feat(coaching): add answer verification agent"
```

---

## Task 6: Backend — Thumbnail Service

**Files:**
- Create: `src/coaching/thumbnails.ts`

**Step 1: Create the thumbnail service**

Create `src/coaching/thumbnails.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../config/env.js';

/**
 * Extract YouTube video ID from various URL formats.
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Get YouTube thumbnail URL using the predictable static URL pattern.
 */
export function getYouTubeThumbnailUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Capture a screenshot of a URL using Playwright and save as thumbnail.
 * Returns the local file path or null if capture fails.
 */
export async function captureArticleThumbnail(
  url: string,
  materialId: number,
): Promise<string | null> {
  const config = loadEnv();
  const thumbnailDir = path.join(config.dataDir, 'thumbnails');

  try {
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const outputPath = path.join(thumbnailDir, `${materialId}.png`);

    // Dynamic import to avoid hard dependency — Playwright is optional
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1280, height: 720 } });
    await browser.close();

    return outputPath;
  } catch (err) {
    console.error('[thumbnails] Failed to capture screenshot:', err);
    return null;
  }
}

/**
 * Get thumbnail URL for a learning material.
 * YouTube: static URL. Articles: Playwright capture (async, may return null).
 */
export async function getThumbnailUrl(
  type: 'youtube' | 'article',
  url: string,
  materialId: number,
): Promise<string | null> {
  if (type === 'youtube') {
    return getYouTubeThumbnailUrl(url);
  }
  return captureArticleThumbnail(url, materialId);
}
```

**Step 2: Write tests for YouTube ID extraction**

Create `src/coaching/__tests__/thumbnails.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../thumbnails.js';

describe('thumbnails', () => {
  describe('extractYouTubeVideoId', () => {
    it('extracts from standard watch URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from short URL', () => {
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts from embed URL', () => {
      expect(extractYouTubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for non-YouTube URL', () => {
      expect(extractYouTubeVideoId('https://example.com')).toBeNull();
    });
  });

  describe('getYouTubeThumbnailUrl', () => {
    it('returns mqdefault thumbnail URL', () => {
      const result = getYouTubeThumbnailUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    });

    it('returns null for invalid URL', () => {
      expect(getYouTubeThumbnailUrl('https://example.com')).toBeNull();
    });
  });
});
```

**Step 3: Run tests**

Run: `pnpm vitest run src/coaching/__tests__/thumbnails.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/coaching/thumbnails.ts src/coaching/__tests__/thumbnails.test.ts
git commit -m "feat(coaching): add thumbnail service with YouTube extraction and Playwright capture"
```

---

## Task 7: Backend — Material Generation Service

This orchestrates material generation at phase completion.

**Files:**
- Create: `src/coaching/generate-materials.ts`
- Modify: `src/websocket/handlers/dashboard.ts` (or wherever phase completion is handled)

**Step 1: Create the generation orchestrator**

Create `src/coaching/generate-materials.ts`:

```typescript
import { getDatabase } from '../database/db.js';
import { getActiveSessionId } from '../websocket/server.js';
import { createLearningMaterial } from '../database/queries/learning-materials.js';
import { getKnowledgeGapsBySession } from '../database/queries/gaps.js';
import { getSession } from '../database/queries/sessions.js';
import { runMaterialsAgent } from './agents/materials.js';
import { getThumbnailUrl } from './thumbnails.js';
import { logAction } from '../logger/action-log.js';
import { broadcast } from '../websocket/server.js';
import { getLearningMaterialsBySession } from '../database/queries/learning-materials.js';

export interface GenerateMaterialsInput {
  phaseTitle: string;
  phaseDescription: string;
  phaseId: number;
}

export async function generateLearningMaterials(
  input: GenerateMaterialsInput,
): Promise<void> {
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (!db || !sessionId) {
    console.error('[generate-materials] No active database or session');
    return;
  }

  try {
    const session = await getSession(db, sessionId);
    if (!session) return;

    // Get knowledge gaps for context
    const gaps = await getKnowledgeGapsBySession(db, sessionId);
    const knowledgeGaps = gaps.map((g) => ({
      topic: g.topic,
      description: g.description,
    }));

    // Generate materials via Claude
    const response = await runMaterialsAgent({
      phaseTitle: input.phaseTitle,
      phaseDescription: input.phaseDescription,
      knowledgeGaps,
      issueTitle: session.issue_title ?? 'Coding task',
      sessionId,
    });

    // Store each material and generate thumbnails
    for (const mat of response.materials) {
      const material = await createLearningMaterial(db, {
        session_id: sessionId,
        phase_id: input.phaseId,
        type: mat.type,
        url: mat.url,
        title: mat.title,
        description: mat.description,
        thumbnail_url: null, // Set after creation (need ID for article thumbnails)
        question: mat.question,
      });

      // Generate thumbnail (async, non-blocking for YouTube)
      const thumbnailUrl = await getThumbnailUrl(mat.type, mat.url, material.id);
      if (thumbnailUrl) {
        await db
          .updateTable('learning_materials')
          .set({ thumbnail_url: thumbnailUrl } as never)
          .where('id', '=', material.id)
          .execute();
      }

      await logAction(db, sessionId, 'learning_material_generated', {
        materialId: material.id,
        type: mat.type,
        url: mat.url,
      });
    }

    // Broadcast updated materials list to Electron
    const allMaterials = await getLearningMaterialsBySession(db, sessionId);
    broadcast('dashboard:materials', {
      materials: allMaterials.map((m) => ({
        id: m.id,
        type: m.type,
        url: m.url,
        title: m.title,
        description: m.description,
        thumbnailUrl: m.thumbnail_url,
        question: m.question,
        viewCount: m.view_count,
        status: m.status,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    console.error('[generate-materials] Failed to generate materials:', err);
  }
}
```

**Step 2: Hook into phase completion**

Find where phase status is set to `'complete'` in the codebase (check `src/websocket/handlers/` or `src/coaching/`). Add a call to `generateLearningMaterials` after the phase is marked complete. The exact location will depend on how phase transitions are handled — look for `updatePhaseStatus` or similar. Add:

```typescript
import { generateLearningMaterials } from '../coaching/generate-materials.js';

// After phase is marked complete:
if (newStatus === 'complete') {
  void generateLearningMaterials({
    phaseTitle: phase.title,
    phaseDescription: phase.description,
    phaseId: phase.id,
  }).catch((err) => {
    console.error('[phase-complete] Failed to generate learning materials:', err);
  });
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/coaching/generate-materials.ts
# Also add whichever handler file was modified for the hook
git commit -m "feat(coaching): add material generation orchestrator with phase completion hook"
```

---

## Task 8: Backend — WebSocket Handlers for Materials

**Files:**
- Create: `src/websocket/handlers/materials.ts`
- Modify: `src/websocket/router.ts`

**Step 1: Create the materials handlers**

Create `src/websocket/handlers/materials.ts`:

```typescript
import type WsWebSocket from 'ws';
import { getDatabase } from '../../database/db.js';
import { getActiveSessionId } from '../server.js';
import {
  getLearningMaterial,
  getLearningMaterialsBySession,
  updateLearningMaterialStatus,
  incrementViewCount,
} from '../../database/queries/learning-materials.js';
import { verifyAnswer } from '../../coaching/agents/verify-answer.js';
import { logAction } from '../../logger/action-log.js';

function send(ws: WsWebSocket, type: string, payload: unknown): void {
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }
}

function sendError(
  ws: WsWebSocket,
  code: 'INTERNAL_ERROR' | 'NOT_FOUND',
  message: string,
): void {
  send(ws, 'connection:error', { code, message });
}

export async function handleMaterialsView(
  ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { id } = data as { id: number };
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (!db || !sessionId) return sendError(ws, 'INTERNAL_ERROR', 'No active session');

  const material = await getLearningMaterial(db, id);
  if (!material) return sendError(ws, 'NOT_FOUND', `Material ${id} not found`);

  const updated = await incrementViewCount(db, id);
  if (!updated) return;

  await logAction(db, sessionId, 'learning_material_viewed', { materialId: id, url: material.url });

  send(ws, 'materials:updated', {
    id: updated.id,
    viewCount: updated.view_count,
    status: updated.status,
  });

  // Tell the renderer to open the URL in the user's default browser
  send(ws, 'materials:open_url', { url: material.url });
}

export async function handleMaterialsComplete(
  ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { id, answer } = data as { id: number; answer: string };
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (!db || !sessionId) return sendError(ws, 'INTERNAL_ERROR', 'No active session');

  const material = await getLearningMaterial(db, id);
  if (!material) return sendError(ws, 'NOT_FOUND', `Material ${id} not found`);

  try {
    const result = await verifyAnswer({
      materialTitle: material.title,
      materialUrl: material.url,
      materialType: material.type,
      question: material.question,
      answer,
      sessionId,
    });

    await logAction(db, sessionId, 'learning_material_answer_checked', {
      materialId: id,
      correct: result.correct,
    });

    if (result.correct) {
      const updated = await updateLearningMaterialStatus(db, id, 'completed');
      await logAction(db, sessionId, 'learning_material_completed', { materialId: id });

      send(ws, 'materials:complete_result', { id, correct: true });
      send(ws, 'materials:updated', {
        id,
        viewCount: updated!.view_count,
        status: 'completed',
      });
    } else {
      send(ws, 'materials:complete_result', {
        id,
        correct: false,
        message: result.feedback,
      });
    }
  } catch (err) {
    console.error('[ws-handler:materials] Verification failed:', err);
    sendError(ws, 'INTERNAL_ERROR', 'Answer verification failed');
  }
}

export async function handleMaterialsDismiss(
  ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { id } = data as { id: number };
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (!db || !sessionId) return sendError(ws, 'INTERNAL_ERROR', 'No active session');

  const updated = await updateLearningMaterialStatus(db, id, 'dismissed');
  if (!updated) return sendError(ws, 'NOT_FOUND', `Material ${id} not found`);

  await logAction(db, sessionId, 'learning_material_dismissed', { materialId: id });

  send(ws, 'materials:updated', {
    id: updated.id,
    viewCount: updated.view_count,
    status: 'dismissed',
  });
}

export async function handleMaterialsList(
  ws: WsWebSocket,
  _data: unknown,
  _connectionId: string,
): Promise<void> {
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (!db || !sessionId) return sendError(ws, 'INTERNAL_ERROR', 'No active session');

  const materials = await getLearningMaterialsBySession(db, sessionId);
  send(ws, 'dashboard:materials', {
    materials: materials.map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      title: m.title,
      description: m.description,
      thumbnailUrl: m.thumbnail_url,
      question: m.question,
      viewCount: m.view_count,
      status: m.status,
      createdAt: m.created_at,
    })),
  });
}
```

**Step 2: Register handlers in router**

In `src/websocket/router.ts`, import the handlers:

```typescript
import {
  handleMaterialsView,
  handleMaterialsComplete,
  handleMaterialsDismiss,
  handleMaterialsList,
} from './handlers/materials.js';
```

Add to the handlers Map:

```typescript
['materials:view', handleMaterialsView],
['materials:complete', handleMaterialsComplete],
['materials:dismiss', handleMaterialsDismiss],
['materials:list', handleMaterialsList],
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/websocket/handlers/materials.ts src/websocket/router.ts
git commit -m "feat(ws): add materials WebSocket handlers for view, complete, dismiss, and list"
```

---

## Task 9: Frontend — Update WebSocket Protocol Types

**Files:**
- Modify: `electron-ui/shared/types/websocket-messages.ts`
- Modify: `electron-ui/shared/types/entities.ts`

**Step 1: Update the LearningMaterial entity type**

In `electron-ui/shared/types/entities.ts`, add:

```typescript
export interface LearningMaterial {
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
```

**Step 2: Update DashboardMaterialsMessage payload**

In `electron-ui/shared/types/websocket-messages.ts`, update the existing `DashboardMaterialsMessage` interface (around line 324) to use the expanded payload:

```typescript
export interface DashboardMaterialsMessage extends BaseMessage {
  type: 'dashboard:materials';
  payload: {
    materials: LearningMaterial[];
  };
}
```

Import `LearningMaterial` from entities at the top of the file.

**Step 3: Add new message types**

Add these new message interfaces:

```typescript
export interface MaterialsViewMessage extends BaseMessage {
  type: 'materials:view';
  payload: { id: number };
}

export interface MaterialsCompleteMessage extends BaseMessage {
  type: 'materials:complete';
  payload: { id: number; answer: string };
}

export interface MaterialsDismissMessage extends BaseMessage {
  type: 'materials:dismiss';
  payload: { id: number };
}

export interface MaterialsCompleteResultMessage extends BaseMessage {
  type: 'materials:complete_result';
  payload: { id: number; correct: boolean; message?: string };
}

export interface MaterialsUpdatedMessage extends BaseMessage {
  type: 'materials:updated';
  payload: { id: number; viewCount: number; status: 'pending' | 'completed' | 'dismissed' };
}

export interface MaterialsOpenUrlMessage extends BaseMessage {
  type: 'materials:open_url';
  payload: { url: string };
}
```

Add the new types to the `MessageType` union and the `ServerMessage`/`ClientMessage` unions as appropriate. Add type guards for each.

**Step 4: Run typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: May have errors in Dashboard.tsx or LearningMaterials.tsx due to changed payload shape — that's expected, we'll fix in the next tasks.

**Step 5: Commit**

```bash
git add electron-ui/shared/types/websocket-messages.ts electron-ui/shared/types/entities.ts
git commit -m "feat(protocol): update learning materials WebSocket message types"
```

---

## Task 10: Frontend — MaterialCard Component

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/materials/MaterialCard.tsx`

**Step 1: Write the failing test**

Create `electron-ui/tests/unit/components/Dashboard/materials/MaterialCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MaterialCard } from '../../../../../renderer/src/components/Dashboard/materials/MaterialCard';
import type { LearningMaterial } from '@shared/types/entities';

function makeMaterial(overrides?: Partial<LearningMaterial>): LearningMaterial {
  return {
    id: 1,
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Learn React Hooks',
    description: 'A great intro to React hooks',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    question: 'What is useState?',
    viewCount: 3,
    status: 'pending',
    createdAt: '2026-02-15T00:00:00Z',
    ...overrides,
  };
}

describe('MaterialCard', () => {
  it('renders title and description', () => {
    render(
      <MaterialCard
        material={makeMaterial()}
        onView={vi.fn()}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Learn React Hooks')).toBeInTheDocument();
    expect(screen.getByText('A great intro to React hooks')).toBeInTheDocument();
  });

  it('shows view count', () => {
    render(
      <MaterialCard
        material={makeMaterial({ viewCount: 5 })}
        onView={vi.fn()}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/viewed 5/i)).toBeInTheDocument();
  });

  it('calls onView when view button is clicked', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    render(
      <MaterialCard
        material={makeMaterial()}
        onView={onView}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText('View material'));
    expect(onView).toHaveBeenCalledWith(1);
  });

  it('calls onComplete when complete button is clicked', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <MaterialCard
        material={makeMaterial()}
        onView={vi.fn()}
        onComplete={onComplete}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Complete material'));
    expect(onComplete).toHaveBeenCalledWith(1);
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <MaterialCard
        material={makeMaterial()}
        onView={vi.fn()}
        onComplete={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByLabelText('Dismiss material'));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('renders thumbnail image', () => {
    render(
      <MaterialCard
        material={makeMaterial()}
        onView={vi.fn()}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });

  it('renders type badge', () => {
    render(
      <MaterialCard
        material={makeMaterial({ type: 'article' })}
        onView={vi.fn()}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('DOC')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd electron-ui && npx vitest run tests/unit/components/Dashboard/materials/MaterialCard.test.tsx`
Expected: FAIL — module not found

**Step 3: Create the MaterialCard component**

Create `electron-ui/renderer/src/components/Dashboard/materials/MaterialCard.tsx`:

```tsx
import { motion } from 'framer-motion';
import type { LearningMaterial } from '@shared/types/entities';

interface MaterialCardProps {
  material: LearningMaterial;
  onView: (id: number) => void;
  onComplete: (id: number) => void;
  onDismiss: (id: number) => void;
}

const TYPE_BADGE: Record<LearningMaterial['type'], { label: string; color: string }> = {
  youtube: { label: 'VID', color: 'var(--accent-primary)' },
  article: { label: 'DOC', color: 'var(--status-info)' },
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm) var(--space-md)',
  background: 'var(--bg-elevated)',
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
  cursor: 'default',
};

const thumbnailStyle: React.CSSProperties = {
  width: 80,
  height: 45,
  borderRadius: '4px',
  objectFit: 'cover',
  background: 'var(--bg-surface)',
  flexShrink: 0,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const viewCountStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  flexShrink: 0,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  padding: '4px 6px',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const placeholderThumbStyle: React.CSSProperties = {
  ...thumbnailStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  color: 'var(--text-muted)',
};

export function MaterialCard({ material, onView, onComplete, onDismiss }: MaterialCardProps) {
  const badge = TYPE_BADGE[material.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      style={cardStyle}
    >
      {material.thumbnailUrl ? (
        <img
          src={material.thumbnailUrl}
          alt={material.title}
          style={thumbnailStyle}
        />
      ) : (
        <div style={placeholderThumbStyle}>
          {material.type === 'youtube' ? '\u25B6' : '\u2759'}
        </div>
      )}

      <div style={contentStyle}>
        <div style={titleRowStyle}>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: '3px',
              background: badge.color,
              color: '#fff',
              letterSpacing: '0.5px',
            }}
          >
            {badge.label}
          </span>
          <span style={titleStyle}>{material.title}</span>
        </div>
        <span style={descriptionStyle}>{material.description}</span>
        <span style={viewCountStyle}>
          {material.viewCount > 0 ? `Viewed ${material.viewCount} time${material.viewCount !== 1 ? 's' : ''}` : 'Not yet viewed'}
        </span>
      </div>

      <div style={actionsStyle}>
        <button
          style={iconBtnStyle}
          onClick={() => onView(material.id)}
          aria-label="View material"
          title="Open in browser"
        >
          &#x2197;
        </button>
        <button
          style={{ ...iconBtnStyle, color: 'var(--status-success)' }}
          onClick={() => onComplete(material.id)}
          aria-label="Complete material"
          title="Mark as complete"
        >
          &#x2713;
        </button>
        <button
          style={{ ...iconBtnStyle, color: 'var(--status-error, #d97757)' }}
          onClick={() => onDismiss(material.id)}
          aria-label="Dismiss material"
          title="Dismiss"
        >
          &#x2715;
        </button>
      </div>
    </motion.div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd electron-ui && npx vitest run tests/unit/components/Dashboard/materials/MaterialCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/materials/MaterialCard.tsx electron-ui/tests/unit/components/Dashboard/materials/MaterialCard.test.tsx
git commit -m "feat(ui): add MaterialCard component with tests"
```

---

## Task 11: Frontend — CompletionModal Component

**Files:**
- Create: `electron-ui/renderer/src/components/Dashboard/materials/CompletionModal.tsx`

**Step 1: Write the failing test**

Create `electron-ui/tests/unit/components/Dashboard/materials/CompletionModal.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CompletionModal } from '../../../../../renderer/src/components/Dashboard/materials/CompletionModal';
import type { LearningMaterial } from '@shared/types/entities';

function makeMaterial(): LearningMaterial {
  return {
    id: 1,
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=abc',
    title: 'Learn React Hooks',
    description: 'A great intro to React hooks',
    thumbnailUrl: null,
    question: 'What is the purpose of useState?',
    viewCount: 0,
    status: 'pending',
    createdAt: '2026-02-15T00:00:00Z',
  };
}

describe('CompletionModal', () => {
  it('renders the question', () => {
    render(
      <CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText('What is the purpose of useState?')).toBeInTheDocument();
  });

  it('renders the material title', () => {
    render(
      <CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Learn React Hooks')).toBeInTheDocument();
  });

  it('calls onSubmit with the answer text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CompletionModal material={makeMaterial()} onSubmit={onSubmit} onClose={vi.fn()} />,
    );

    await user.type(screen.getByRole('textbox'), 'useState manages component state');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(1, 'useState manages component state');
  });

  it('disables submit when textarea is empty', () => {
    render(
      <CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CompletionModal material={makeMaterial()} onSubmit={vi.fn()} onClose={onClose} />,
    );
    await user.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd electron-ui && npx vitest run tests/unit/components/Dashboard/materials/CompletionModal.test.tsx`
Expected: FAIL — module not found

**Step 3: Create the CompletionModal component**

Create `electron-ui/renderer/src/components/Dashboard/materials/CompletionModal.tsx`:

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LearningMaterial } from '@shared/types/entities';

interface CompletionModalProps {
  material: LearningMaterial;
  onSubmit: (id: number, answer: string) => void;
  onClose: () => void;
  submitting?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: '12px',
  border: '1px solid var(--border-subtle)',
  width: '100%',
  maxWidth: '520px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderBottom: '1px solid var(--border-subtle)',
};

const bodyStyle: React.CSSProperties = {
  padding: 'var(--space-lg)',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
};

const footerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-sm)',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '100px',
  padding: 'var(--space-sm)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'inherit',
  resize: 'vertical',
};

const btnStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

export function CompletionModal({ material, onSubmit, onClose, submitting = false }: CompletionModalProps) {
  const [answer, setAnswer] = useState('');

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(material.id, answer.trim());
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        data-testid="modal-overlay"
        style={overlayStyle}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleOverlayClick}
      >
        <motion.div
          style={modalStyle}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px' }}>
              {material.title}
            </h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Comprehension check
            </p>
          </div>

          <div style={bodyStyle}>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
              {material.question}
            </p>
            <textarea
              style={textareaStyle}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              disabled={submitting}
            />
          </div>

          <div style={footerStyle}>
            <button
              style={{ ...btnStyle, background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              style={{
                ...btnStyle,
                background: answer.trim() ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: answer.trim() ? '#fff' : 'var(--text-muted)',
                opacity: submitting ? 0.6 : 1,
              }}
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              aria-label="Submit answer"
            >
              {submitting ? 'Checking...' : 'Submit'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd electron-ui && npx vitest run tests/unit/components/Dashboard/materials/CompletionModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/materials/CompletionModal.tsx electron-ui/tests/unit/components/Dashboard/materials/CompletionModal.test.tsx
git commit -m "feat(ui): add CompletionModal component with tests"
```

---

## Task 12: Frontend — Update LearningMaterials Panel

**Files:**
- Modify: `electron-ui/renderer/src/components/Dashboard/LearningMaterials.tsx`

**Step 1: Rewrite the LearningMaterials component**

Replace the existing `LearningMaterials.tsx` content. The component now:
- Accepts the expanded `LearningMaterial[]` type
- Renders `MaterialCard` for each item with `AnimatePresence`
- Manages `CompletionModal` open/close state
- Sends WS messages for view/complete/dismiss
- Listens for `materials:complete_result`, `materials:updated`, `materials:open_url`
- Shows toast on incorrect answer
- Opens URL via `window.open()` when `materials:open_url` is received

```tsx
import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import type { LearningMaterial } from '@shared/types/entities';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import { MaterialCard } from './materials/MaterialCard';
import { CompletionModal } from './materials/CompletionModal';
import { showCoachingToast } from '../Hints/EditorToast';
import { useWebSocket } from '../../hooks/useWebSocket';

interface LearningMaterialsProps {
  materials: LearningMaterial[] | null;
}

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const headerStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: 'var(--space-sm)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  overflowY: 'auto',
  flex: 1,
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 'var(--text-sm)',
  textAlign: 'center',
  padding: 'var(--space-lg)',
};

export function LearningMaterials({ materials }: LearningMaterialsProps) {
  const { send, on } = useWebSocket();
  const [localMaterials, setLocalMaterials] = useState<LearningMaterial[]>(materials ?? []);
  const [modalMaterial, setModalMaterial] = useState<LearningMaterial | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync from parent prop
  useEffect(() => {
    if (materials) setLocalMaterials(materials);
  }, [materials]);

  // Listen for server responses
  useEffect(() => {
    const unsubs = [
      on('materials:updated', (msg: WebSocketMessage) => {
        const { id, viewCount, status } = msg.payload as {
          id: number;
          viewCount: number;
          status: string;
        };
        setLocalMaterials((prev) =>
          status === 'pending'
            ? prev.map((m) => (m.id === id ? { ...m, viewCount, status: status as LearningMaterial['status'] } : m))
            : prev.filter((m) => m.id !== id),
        );
      }),
      on('materials:complete_result', (msg: WebSocketMessage) => {
        const { id, correct, message } = msg.payload as {
          id: number;
          correct: boolean;
          message?: string;
        };
        setSubmitting(false);
        if (correct) {
          setModalMaterial(null);
          showCoachingToast({
            messageId: `material-complete-${id}`,
            message: 'Nice work! Material marked as complete.',
            type: 'success',
          });
        } else {
          setModalMaterial(null);
          showCoachingToast({
            messageId: `material-retry-${id}`,
            message: message ?? 'Not quite \u2014 give the material another read and try again.',
            type: 'warning',
          });
        }
      }),
      on('materials:open_url', (msg: WebSocketMessage) => {
        const { url } = msg.payload as { url: string };
        window.open(url, '_blank');
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [on]);

  const handleView = useCallback(
    (id: number) => {
      void send('materials:view', { id });
    },
    [send],
  );

  const handleComplete = useCallback(
    (id: number) => {
      const material = localMaterials.find((m) => m.id === id);
      if (material) setModalMaterial(material);
    },
    [localMaterials],
  );

  const handleDismiss = useCallback(
    (id: number) => {
      void send('materials:dismiss', { id });
    },
    [send],
  );

  const handleSubmitAnswer = useCallback(
    (id: number, answer: string) => {
      setSubmitting(true);
      void send('materials:complete', { id, answer });
    },
    [send],
  );

  // Loading state
  if (materials === null) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Learning Materials</div>
        <div style={emptyStyle}>Loading...</div>
      </div>
    );
  }

  const pendingMaterials = localMaterials.filter((m) => m.status === 'pending');

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Learning Materials</div>

      {pendingMaterials.length === 0 ? (
        <div style={emptyStyle}>
          Complete coaching phases to unlock learning materials
        </div>
      ) : (
        <LayoutGroup>
          <div style={listStyle}>
            <AnimatePresence mode="popLayout">
              {pendingMaterials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  onView={handleView}
                  onComplete={handleComplete}
                  onDismiss={handleDismiss}
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      )}

      {modalMaterial && (
        <CompletionModal
          material={modalMaterial}
          onSubmit={handleSubmitAnswer}
          onClose={() => setModalMaterial(null)}
          submitting={submitting}
        />
      )}
    </div>
  );
}
```

**Step 2: Update Dashboard.tsx**

In `electron-ui/renderer/src/views/Dashboard.tsx`, update the `LearningMaterials` import usage. Remove the `onMaterialClick` prop (no longer needed) and ensure the materials state type matches `LearningMaterial[] | null`.

Update the state declaration:

```typescript
import type { LearningMaterial } from '@shared/types/entities';

const [materials, setMaterials] = useState<LearningMaterial[] | null>(null);
```

Update the WebSocket subscription:

```typescript
on('dashboard:materials', (msg: WebSocketMessage) => {
  const m = msg as DashboardMaterialsMessage;
  setMaterials(m.payload.materials);
}),
```

Update the component usage:

```tsx
<LearningMaterials materials={materials} />
```

**Step 3: Run typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add electron-ui/renderer/src/components/Dashboard/LearningMaterials.tsx electron-ui/renderer/src/views/Dashboard.tsx
git commit -m "feat(ui): rewrite LearningMaterials panel with MaterialCard, CompletionModal, and WS integration"
```

---

## Task 13: Install Playwright Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install Playwright**

Run: `pnpm add playwright`

**Step 2: Install browser binaries**

Run: `pnpm exec playwright install chromium`

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add playwright for article thumbnail capture"
```

---

## Task 14: End-to-End Smoke Test

**Step 1: Run backend typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 2: Run backend tests**

Run: `pnpm test`
Expected: All existing + new tests PASS

**Step 3: Run frontend typecheck**

Run: `cd electron-ui && npm run typecheck`
Expected: PASS

**Step 4: Run frontend tests**

Run: `cd electron-ui && npm test`
Expected: All existing + new tests PASS

**Step 5: Manual smoke test**

Start the backend (`pnpm dev`) and Electron (`cd electron-ui && npm run dev`). Navigate to the dashboard. Verify:
- Learning Materials panel renders with empty state
- After a coaching phase completes, materials appear with thumbnails
- View button opens URL in browser
- Complete button opens modal with question
- Submitting an answer shows success/retry toast
- Dismiss button removes material from list with animation

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: learning materials dashboard PoC complete"
```

---

## Task Summary

| # | Task | Files | Type |
|---|------|-------|------|
| 1 | Backend types | `src/types/domain.ts` | Modify |
| 2 | Database migration | `src/database/migrations/004-learning-materials.ts`, `src/database/db.ts` | Create + Modify |
| 3 | Query functions | `src/database/queries/learning-materials.ts` | Create + Test |
| 4 | AI generation schema + agent | `src/api-client/schemas.ts`, `src/coaching/agents/materials.ts` | Modify + Create |
| 5 | Answer verification agent | `src/coaching/agents/verify-answer.ts` | Create |
| 6 | Thumbnail service | `src/coaching/thumbnails.ts` | Create + Test |
| 7 | Material generation orchestrator | `src/coaching/generate-materials.ts` | Create + Modify |
| 8 | WebSocket handlers | `src/websocket/handlers/materials.ts`, `src/websocket/router.ts` | Create + Modify |
| 9 | Frontend WS protocol types | `electron-ui/shared/types/websocket-messages.ts`, `entities.ts` | Modify |
| 10 | MaterialCard component | `electron-ui/renderer/src/components/Dashboard/materials/MaterialCard.tsx` | Create + Test |
| 11 | CompletionModal component | `electron-ui/renderer/src/components/Dashboard/materials/CompletionModal.tsx` | Create + Test |
| 12 | LearningMaterials panel rewrite | `electron-ui/renderer/src/components/Dashboard/LearningMaterials.tsx`, `Dashboard.tsx` | Modify |
| 13 | Install Playwright | `package.json` | Modify |
| 14 | End-to-end smoke test | — | Verify |
