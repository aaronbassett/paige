import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase, getDatabase } from '../../src/database/db.js';
import {
  createLearningMaterial,
  getLearningMaterialsBySession,
  getLearningMaterial,
  updateLearningMaterialStatus,
  incrementViewCount,
  type CreateLearningMaterialInput,
} from '../../src/database/queries/learning-materials.js';
import { createSession } from '../../src/database/queries/sessions.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('learning-materials queries', () => {
  let tmpDir: string;
  let dbPath: string;
  let sessionId: number;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'paige-test-'));
    dbPath = join(tmpDir, 'test.db');
    await createDatabase(dbPath);
    const session = await createSession(getDatabase()!, {
      project_dir: '/test',
      status: 'active',
      started_at: new Date().toISOString(),
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await closeDatabase();
    rmSync(tmpDir, { recursive: true, force: true });
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
      session_id: sessionId,
      phase_id: null,
      type: 'article',
      url: 'https://example.com',
      title: 'Article',
      description: 'Desc',
      thumbnail_url: null,
      question: 'Q?',
    });
    await createLearningMaterial(db, {
      session_id: sessionId,
      phase_id: null,
      type: 'youtube',
      url: 'https://youtube.com/watch?v=abc',
      title: 'Video',
      description: 'Desc',
      thumbnail_url: null,
      question: 'Q?',
    });

    const materials = await getLearningMaterialsBySession(db, sessionId);
    expect(materials).toHaveLength(2);
  });

  it('updates status to completed', async () => {
    const db = getDatabase()!;
    const material = await createLearningMaterial(db, {
      session_id: sessionId,
      phase_id: null,
      type: 'youtube',
      url: 'https://youtube.com/watch?v=abc',
      title: 'Video',
      description: 'Desc',
      thumbnail_url: null,
      question: 'Q?',
    });

    const updated = await updateLearningMaterialStatus(db, material.id, 'completed');
    expect(updated!.status).toBe('completed');
    expect(updated!.completed_at).not.toBeNull();
  });

  it('increments view count', async () => {
    const db = getDatabase()!;
    const material = await createLearningMaterial(db, {
      session_id: sessionId,
      phase_id: null,
      type: 'youtube',
      url: 'https://youtube.com/watch?v=abc',
      title: 'Video',
      description: 'Desc',
      thumbnail_url: null,
      question: 'Q?',
    });

    const updated = await incrementViewCount(db, material.id);
    expect(updated!.view_count).toBe(1);

    const updated2 = await incrementViewCount(db, material.id);
    expect(updated2!.view_count).toBe(2);
  });
});
