// Session wrap-up — calls 3 agents, stores results, updates session

import { getDatabase } from '../database/db.js';
import { getSession, updateSession } from '../database/queries/sessions.js';
import { getActionsBySession } from '../database/queries/actions.js';
import { getGapsBySession, createGap } from '../database/queries/gaps.js';
import { createKata } from '../database/queries/katas.js';
import { getAllDreyfus, upsertDreyfus } from '../database/queries/dreyfus.js';
import { getPlansBySession } from '../database/queries/plans.js';
import { getPhasesByPlan } from '../database/queries/phases.js';
import { getProgressEventsByPhase } from '../database/queries/progress.js';
import { addMemories } from '../memory/queries.js';
import { broadcast } from '../websocket/server.js';
import { runKnowledgeGapAgent } from './agents/knowledge-gap.js';
import { runDreyfusAgent } from './agents/dreyfus.js';
import { runReflectionAgent } from './agents/reflection.js';
import type { DreyfusStage } from '../types/domain.js';

export interface WrapUpResult {
  memoriesAdded: number;
  gapsIdentified: number;
  katasGenerated: number;
  assessmentsUpdated: number;
}

/** Runs session wrap-up: knowledge gaps -> dreyfus -> reflection -> mark complete. */
export async function runSessionWrapUp(sessionId: number): Promise<WrapUpResult> {
  // 1. Get database
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialised');
  }

  // 2. Get session
  const session = await getSession(db, sessionId);
  if (session === undefined) {
    throw new Error(`Session not found (id=${sessionId})`);
  }

  // 3. Gather session data for agents
  const actionLog = await getActionsBySession(db, sessionId);
  const existingGaps = await getGapsBySession(db, sessionId);
  const plans = await getPlansBySession(db, sessionId);
  const activePlan = plans.find((p) => p.is_active === 1);
  const phases = activePlan ? await getPhasesByPlan(db, activePlan.id) : [];

  // Compute Dreyfus agent inputs from phases
  const phasesCompleted = phases.filter((p) => p.status === 'complete').length;

  // Count total hint_used events across all phases
  let hintsUsed = 0;
  let independentCompletions = 0;
  for (const phase of phases) {
    const events = await getProgressEventsByPhase(db, phase.id);
    const phaseHintsUsed = events.filter((e) => e.event_type === 'hint_used').length;
    hintsUsed += phaseHintsUsed;
    // A phase completed without hints is an independent completion
    if (phase.status === 'complete' && phaseHintsUsed === 0) {
      independentCompletions += 1;
    }
  }

  // Get current Dreyfus assessments
  const currentAssessments = await getAllDreyfus(db);

  // Track counts
  let memoriesAdded = 0;
  let gapsIdentified = 0;
  let katasGenerated = 0;
  let assessmentsUpdated = 0;

  // 4a. Agent 1: Knowledge Gap Extraction (Sonnet)
  let knowledgeGaps: Array<{ topic: string; severity: string }> = [];
  try {
    const gapResponse = await runKnowledgeGapAgent({
      sessionId,
      actionLog,
      phases,
      existingGaps,
    });

    // Store each gap and its linked katas
    const createdGapIds: number[] = [];
    for (const gap of gapResponse.knowledge_gaps) {
      const gapRow = await createGap(db, {
        session_id: sessionId,
        topic: gap.topic,
        severity: gap.severity,
        evidence: gap.evidence,
        related_concepts: JSON.stringify(gap.related_concepts),
        identified_at: new Date().toISOString(),
      });
      createdGapIds.push(gapRow.id);
      gapsIdentified += 1;
    }

    // Link katas to gaps via round-robin distribution
    if (createdGapIds.length > 0) {
      for (const kata of gapResponse.kata_specs) {
        const targetGapId = createdGapIds[katasGenerated % createdGapIds.length]!;
        await createKata(db, {
          gap_id: targetGapId,
          title: kata.title,
          description: kata.description,
          scaffolding_code: kata.scaffolding_code,
          instructor_notes: kata.instructor_notes,
          constraints: JSON.stringify(kata.constraints),
          created_at: new Date().toISOString(),
        });
        katasGenerated += 1;
      }
    }

    // Build gap summaries for reflection agent
    knowledgeGaps = gapResponse.knowledge_gaps.map((g) => ({
      topic: g.topic,
      severity: g.severity,
    }));
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.warn('[wrap-up] Knowledge gap agent failed:', error);
  }

  // 4b. Agent 2: Dreyfus Assessment (Sonnet)
  try {
    const dreyfusResponse = await runDreyfusAgent({
      sessionId,
      currentAssessments,
      phasesCompleted,
      hintsUsed,
      independentCompletions,
    });

    for (const assessment of dreyfusResponse.assessments) {
      await upsertDreyfus(db, {
        skill_area: assessment.skill_area,
        stage: assessment.stage as DreyfusStage,
        confidence: assessment.confidence,
        evidence: assessment.evidence,
        assessed_at: new Date().toISOString(),
      });
      assessmentsUpdated += 1;
    }
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.warn('[wrap-up] Dreyfus agent failed:', error);
  }

  // 4c. Agent 3: Reflection / Memory Summarisation (Haiku)
  try {
    const completedPhases = phases
      .filter((p) => p.status === 'complete')
      .map((p) => ({ title: p.title, description: p.description }));

    const reflectionResponse = await runReflectionAgent({
      sessionId,
      sessionTranscript: '',
      issueTitle: session.issue_title ?? '',
      phasesCompleted: completedPhases,
      knowledgeGaps,
    });

    const result = await addMemories(
      reflectionResponse.memories,
      String(sessionId),
      session.project_dir,
    );
    memoriesAdded = result.added;
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.warn('[wrap-up] Reflection agent failed:', error);
  }

  // 5. Mark session as completed (ALWAYS runs)
  await updateSession(db, sessionId, {
    status: 'completed',
    ended_at: new Date().toISOString(),
  });

  // 6. Broadcast session:completed (ALWAYS fires)
  broadcast({
    type: 'session:completed',
    data: {
      memories_added: memoriesAdded,
      gaps_identified: gapsIdentified,
      katas_generated: katasGenerated,
      assessments_updated: assessmentsUpdated,
    },
  });

  // 7. Return result
  return {
    memoriesAdded,
    gapsIdentified,
    katasGenerated,
    assessmentsUpdated,
  };
}
