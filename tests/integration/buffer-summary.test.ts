import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, closeDatabase, type AppDatabase } from '../../src/database/db.js';
import { createSession } from '../../src/database/queries/sessions.js';
import { updateBuffer, markClean, clearAll } from '../../src/file-system/buffer-cache.js';
import {
  logBufferSummaries,
  checkSignificantChange,
  startBufferSummaryTimer,
  stopBufferSummaryTimer,
} from '../../src/logger/action-log.js';

/**
 * Integration tests for US4: buffer summary logging and significant change detection.
 *
 * Tests exercise:
 *   - logBufferSummaries: periodic summary of dirty buffer state into action_log
 *   - checkSignificantChange: immediate logging when a buffer changes significantly
 *   - startBufferSummaryTimer / stopBufferSummaryTimer: timer lifecycle
 *
 * Written TDD-style: these tests MUST fail until logBufferSummaries and
 * checkSignificantChange are implemented in src/logger/action-log.ts.
 */

describe('Buffer summary logging (US4)', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: AppDatabase;
  let sessionId: number;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'paige-buf-summary-'));
    dbPath = join(tmpDir, 'test.db');
    db = await createDatabase(dbPath);

    // Create a session to satisfy the FK constraint on action_log.session_id
    const session = await createSession(db, {
      project_dir: '/tmp/test-project',
      status: 'active',
      started_at: new Date().toISOString(),
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    clearAll();
    await closeDatabase();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── logBufferSummaries ──────────────────────────────────────────────────────

  describe('logBufferSummaries', () => {
    it('logs dirty files as buffer_summary actions', async () => {
      // Set up 2 dirty buffers
      updateBuffer('/tmp/test-project/src/index.ts', 'console.log("hello");', {
        line: 1,
        column: 22,
      });
      updateBuffer(
        '/tmp/test-project/src/util.ts',
        'export function add(a: number, b: number) { return a + b; }',
        {
          line: 1,
          column: 60,
        },
      );

      await logBufferSummaries(db, sessionId);

      // Query action_log for buffer_summary entries
      const rows = await db
        .selectFrom('action_log')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('action_type', '=', 'buffer_summary')
        .execute();

      expect(rows).toHaveLength(2);

      // Each row should contain path, editCount, charDelta, charCount in its data field
      for (const row of rows) {
        expect(row.data).not.toBeNull();
        const data = JSON.parse(row.data!) as {
          path: string;
          editCount: number;
          charDelta: number;
          charCount: number;
        };
        expect(data.path).toBeTypeOf('string');
        expect(data.editCount).toBeTypeOf('number');
        expect(data.charDelta).toBeTypeOf('number');
        expect(data.charCount).toBeTypeOf('number');
      }

      // Verify the paths logged match the dirty buffers
      const paths = rows.map((r) => {
        const data = JSON.parse(r.data!) as { path: string };
        return data.path;
      });
      expect(paths).toContain('/tmp/test-project/src/index.ts');
      expect(paths).toContain('/tmp/test-project/src/util.ts');
    });

    it('skips clean buffers', async () => {
      // Set up 1 dirty buffer and 1 clean buffer
      updateBuffer('/tmp/test-project/src/dirty.ts', 'dirty content', { line: 1, column: 1 });
      updateBuffer('/tmp/test-project/src/clean.ts', 'clean content', { line: 1, column: 1 });
      markClean('/tmp/test-project/src/clean.ts');

      await logBufferSummaries(db, sessionId);

      const rows = await db
        .selectFrom('action_log')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('action_type', '=', 'buffer_summary')
        .execute();

      expect(rows).toHaveLength(1);

      const data = JSON.parse(rows[0]!.data!) as { path: string };
      expect(data.path).toBe('/tmp/test-project/src/dirty.ts');
    });

    it('is a no-op when no dirty files exist', async () => {
      // Don't set up any buffers at all
      await logBufferSummaries(db, sessionId);

      const rows = await db
        .selectFrom('action_log')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('action_type', '=', 'buffer_summary')
        .execute();

      expect(rows).toHaveLength(0);
    });
  });

  // ── checkSignificantChange ────────────────────────────────────────────────

  describe('checkSignificantChange', () => {
    it('logs when absolute char delta exceeds 500', async () => {
      const filePath = '/tmp/test-project/src/big-change.ts';

      // Set up a buffer with 100 chars — simulate the "last logged" state
      const initialContent = 'x'.repeat(100);
      updateBuffer(filePath, initialContent, { line: 1, column: 1 });

      // Now the buffer grows to 700 chars (delta = 600 > 500 threshold)
      const newContent = 'x'.repeat(700);
      updateBuffer(filePath, newContent, { line: 1, column: 1 });

      await checkSignificantChange(db, sessionId, filePath, 700);

      const rows = await db
        .selectFrom('action_log')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('action_type', '=', 'buffer_significant_change')
        .execute();

      expect(rows).toHaveLength(1);

      const data = JSON.parse(rows[0]!.data!) as { path: string };
      expect(data.path).toBe(filePath);
    });

    it('logs when percentage change exceeds 50%', async () => {
      const filePath = '/tmp/test-project/src/pct-change.ts';

      // Set up a buffer with 50 chars
      const initialContent = 'y'.repeat(50);
      updateBuffer(filePath, initialContent, { line: 1, column: 1 });

      // Now update to 80 chars (delta = 30 = 60% of 50 > 50% threshold)
      const newContent = 'y'.repeat(80);
      updateBuffer(filePath, newContent, { line: 1, column: 1 });

      await checkSignificantChange(db, sessionId, filePath, 80);

      const rows = await db
        .selectFrom('action_log')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('action_type', '=', 'buffer_significant_change')
        .execute();

      expect(rows).toHaveLength(1);

      const data = JSON.parse(rows[0]!.data!) as { path: string };
      expect(data.path).toBe(filePath);
    });

    it('does not log when delta is small', async () => {
      const filePath = '/tmp/test-project/src/small-change.ts';

      // Set up a buffer with 1000 chars
      const initialContent = 'z'.repeat(1000);
      updateBuffer(filePath, initialContent, { line: 1, column: 1 });

      // Update to 1050 chars (delta = 50 = 5% of 1000 < 50%, and 50 < 500)
      const newContent = 'z'.repeat(1050);
      updateBuffer(filePath, newContent, { line: 1, column: 1 });

      await checkSignificantChange(db, sessionId, filePath, 1050);

      const rows = await db
        .selectFrom('action_log')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('action_type', '=', 'buffer_significant_change')
        .execute();

      expect(rows).toHaveLength(0);
    });
  });

  // ── Buffer summary timer lifecycle ────────────────────────────────────────

  describe('startBufferSummaryTimer / stopBufferSummaryTimer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      stopBufferSummaryTimer();
      vi.useRealTimers();
    });

    it('calls the callback every 30 seconds', () => {
      const callback = vi.fn();

      startBufferSummaryTimer(callback);

      // Advance 30s — first tick
      vi.advanceTimersByTime(30_000);
      expect(callback).toHaveBeenCalledTimes(1);

      // Advance another 30s — second tick
      vi.advanceTimersByTime(30_000);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('stops calling the callback after stopBufferSummaryTimer', () => {
      const callback = vi.fn();

      startBufferSummaryTimer(callback);

      // First tick fires
      vi.advanceTimersByTime(30_000);
      expect(callback).toHaveBeenCalledTimes(1);

      // Stop the timer
      stopBufferSummaryTimer();

      // Advance another 30s — should NOT fire
      vi.advanceTimersByTime(30_000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('replaces the previous timer when called twice', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      startBufferSummaryTimer(callback1);
      startBufferSummaryTimer(callback2);

      vi.advanceTimersByTime(30_000);

      // Only the second callback should fire — the first was replaced
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });
});
