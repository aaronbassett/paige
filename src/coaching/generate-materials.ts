// Material generation orchestrator — triggered when a phase completes.
// Calls the Materials Agent (Sonnet) to generate curated learning resources,
// persists them to SQLite, generates thumbnails, and broadcasts to the Electron UI.

import type { Kysely } from 'kysely';
import type { DatabaseTables } from '../types/domain.js';
import { getDatabase } from '../database/db.js';
import { getSession } from '../database/queries/sessions.js';
import { getGapsBySession } from '../database/queries/gaps.js';
import {
  createLearningMaterial,
  getLearningMaterialsBySession,
} from '../database/queries/learning-materials.js';
import { getPlansBySession } from '../database/queries/plans.js';
import { getPhasesByPlan } from '../database/queries/phases.js';
import { runMaterialsAgent } from './agents/materials.js';
import { getThumbnailUrl } from './thumbnails.js';
import { logAction } from '../logger/action-log.js';
import { broadcast } from '../websocket/server.js';

// ── Input ───────────────────────────────────────────────────────────────────

export interface GenerateMaterialsInput {
  /** Phase number (1-indexed) that just completed. */
  phaseNumber: number;
  /** Coaching session database ID. */
  sessionId: number;
}

// ── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Generates learning materials for a completed phase.
 *
 * 1. Looks up the session and phase from the database
 * 2. Gathers knowledge gaps for additional context
 * 3. Calls the Materials Agent to generate curated resources
 * 4. Persists each material and generates thumbnails
 * 5. Broadcasts the updated materials list to Electron
 *
 * This function is designed to be called fire-and-forget from the
 * phase completion handler. Errors are caught and logged rather than
 * propagated so they never break the main coaching flow.
 */
export async function generateLearningMaterials(input: GenerateMaterialsInput): Promise<void> {
  const db = getDatabase();
  if (db === null) {
    // eslint-disable-next-line no-console
    console.error('[generate-materials] No active database — skipping material generation');
    return;
  }

  try {
    // Look up the session
    const session = await getSession(db, input.sessionId);
    if (session === undefined) {
      // eslint-disable-next-line no-console
      console.error(`[generate-materials] Session not found (id=${input.sessionId})`);
      return;
    }

    // Resolve the phase from the database by looking up the plan and phases
    const phase = await resolvePhase(db, input.sessionId, input.phaseNumber);
    if (phase === null) {
      // eslint-disable-next-line no-console
      console.error(
        `[generate-materials] Phase ${input.phaseNumber} not found for session ${input.sessionId}`,
      );
      return;
    }

    // Gather knowledge gaps for additional context
    const gaps = await getGapsBySession(db, input.sessionId);
    const knowledgeGaps = gaps.map((g) => ({
      topic: g.topic,
      description: g.evidence,
    }));

    // Call the Materials Agent (Sonnet) to generate curated resources
    const response = await runMaterialsAgent({
      phaseTitle: phase.title,
      phaseDescription: phase.description,
      knowledgeGaps,
      issueTitle: session.issue_title ?? 'Coding task',
      sessionId: input.sessionId,
    });

    // Persist each material, generate thumbnails, and log actions
    for (const mat of response.materials) {
      const material = await createLearningMaterial(db, {
        session_id: input.sessionId,
        phase_id: phase.id,
        type: mat.type,
        url: mat.url,
        title: mat.title,
        description: mat.description,
        thumbnail_url: null,
        question: mat.question,
      });

      // Generate thumbnail (YouTube: static URL, Article: Playwright screenshot)
      const thumbnailUrl = await getThumbnailUrl(mat.type, mat.url, material.id);
      if (thumbnailUrl !== null) {
        await db
          .updateTable('learning_materials')
          .set({ thumbnail_url: thumbnailUrl } as never)
          .where('id', '=', material.id)
          .execute();
      }

      await logAction(db, input.sessionId, 'learning_material_generated', {
        materialId: material.id,
        type: mat.type,
        url: mat.url,
      });
    }

    // Broadcast the full materials list to Electron
    // New materials are 'pending' by default, which matches the default statusFilter
    const allMaterials = await getLearningMaterialsBySession(db, input.sessionId);
    broadcast({
      type: 'dashboard:materials',
      data: {
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
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[generate-materials] Failed to generate materials:', err);
  }
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Resolves a Phase database record from a session ID and phase number.
 *
 * Looks up the most recent plan for the session, then finds the matching
 * phase by number. Returns null if no plan or phase is found.
 */
async function resolvePhase(
  db: Kysely<DatabaseTables>,
  sessionId: number,
  phaseNumber: number,
): Promise<{ id: number; title: string; description: string } | null> {
  const plans = await getPlansBySession(db, sessionId);
  if (plans.length === 0) return null;

  // Use the most recent plan (last in chronological order)
  const latestPlan = plans[plans.length - 1]!;
  const phases = await getPhasesByPlan(db, latestPlan.id);
  const phase = phases.find((p) => p.number === phaseNumber);

  if (phase === undefined) return null;

  return { id: phase.id, title: phase.title, description: phase.description };
}
