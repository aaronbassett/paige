// Coaching pipeline — transforms issue context into phased coaching plan

import { getActiveSessionId } from '../mcp/session.js';
import { getDatabase } from '../database/db.js';
import { getSession } from '../database/queries/sessions.js';
import { getAllDreyfus } from '../database/queries/dreyfus.js';
import { createPlan } from '../database/queries/plans.js';
import { createPhase } from '../database/queries/phases.js';
import { createHint } from '../database/queries/hints.js';
import { queryMemories } from '../memory/queries.js';
import { callApi } from '../api-client/claude.js';
import {
  memoryRetrievalFilterSchema,
  type MemoryRetrievalFilterResponse,
} from '../api-client/schemas.js';
import { runCoachAgent } from './agents/coach.js';
import { broadcast } from '../websocket/server.js';
import type { HintRequiredLevel, HintLevel } from '../types/domain.js';

// ── Public Types ────────────────────────────────────────────────────────────

export interface PipelineInput {
  planText: string;
  issueSummary: string;
  issueNumber?: number;
}

export interface PipelineResult {
  planId?: number;
  title?: string;
  totalPhases?: number;
  memoryConnection?: string | null;
  estimatedDifficulty?: string;
  error?: string;
}

// ── Hint Level Mapping ──────────────────────────────────────────────────────

/**
 * Maps a phase's hint_level to the required_level stored on individual hints.
 * 'off' and 'low' both map to 'low' (lowest visible threshold).
 */
function mapHintLevelToRequired(hintLevel: HintLevel): HintRequiredLevel {
  switch (hintLevel) {
    case 'off':
      return 'low';
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
  }
}

// ── Memory Filter ───────────────────────────────────────────────────────────

const MEMORY_FILTER_SYSTEM_PROMPT = `You are a memory relevance filter for an AI coding coach called Paige. You receive past coaching memories retrieved by semantic search, plus the current issue context. Determine which memories are genuinely relevant and explain how to use each one in coaching. Discard memories that are superficially similar but not actually useful. Respond with valid JSON matching the required schema.`;

// ── Pipeline ────────────────────────────────────────────────────────────────

/** Runs the full coaching pipeline: memories -> coach agent -> store in SQLite -> broadcast. */
export async function runCoachingPipeline(input: PipelineInput): Promise<PipelineResult> {
  // Step 1: Get active session
  const sessionId = getActiveSessionId();
  if (sessionId === null) {
    return { error: 'No active session' };
  }

  // Step 2: Get database
  const db = getDatabase();
  if (db === null) {
    return { error: 'Database not available' };
  }

  // Step 3: Get session details (need project_dir for memory query)
  const session = await getSession(db, sessionId);
  if (session === undefined) {
    return { error: `Session not found (id=${String(sessionId)})` };
  }

  // Step 4: Get all Dreyfus assessments
  const dreyfusAssessments = await getAllDreyfus(db);

  // Step 5: Deactivate any existing plans for this session
  await db
    .updateTable('plans')
    .set({ is_active: 0 } as never)
    .where('session_id', '=', sessionId)
    .where('is_active', '=', 1)
    .execute();

  // Step 6: Query ChromaDB memories (graceful degradation)
  let memories: Awaited<ReturnType<typeof queryMemories>> = [];
  try {
    memories = await queryMemories({
      queryText: input.issueSummary,
      nResults: 5,
      project: session.project_dir,
    });
  } catch {
    // ChromaDB unavailable — continue without memories
    memories = [];
  }

  // Step 7: Filter memories through Haiku (if any found)
  let relevantMemories: MemoryRetrievalFilterResponse['relevant_memories'] = [];
  if (memories.length > 0) {
    try {
      const filterResult = await callApi<MemoryRetrievalFilterResponse>({
        callType: 'triage_model',
        model: 'haiku',
        systemPrompt: MEMORY_FILTER_SYSTEM_PROMPT,
        userMessage: JSON.stringify({
          issue_summary: input.issueSummary,
          plan_summary: input.planText,
          candidate_memories: memories.map((m) => ({
            content: m.content,
            metadata: m.metadata,
          })),
        }),
        responseSchema: memoryRetrievalFilterSchema,
        sessionId,
        maxTokens: 2048,
      });
      relevantMemories = filterResult.relevant_memories ?? [];
    } catch {
      // Memory filtering failed — continue without filtered memories
      relevantMemories = [];
    }
  }

  // Step 8: Call Coach Agent
  let coachResult: Awaited<ReturnType<typeof runCoachAgent>>;
  try {
    coachResult = await runCoachAgent({
      planText: input.planText,
      issueSummary: input.issueSummary,
      sessionId,
      dreyfusAssessments,
      relevantMemories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coach agent failed';
    return { error: message };
  }

  // Step 9: Store plan in SQLite
  const title = `Coaching Plan: ${input.issueSummary.slice(0, 100)}`;
  const plan = await createPlan(db, {
    session_id: sessionId,
    title,
    description: coachResult.phases.map((p) => `Phase ${String(p.number)}: ${p.title}`).join('\n'),
    total_phases: coachResult.phases.length,
    created_at: new Date().toISOString(),
  });

  // Step 10: Store phases in SQLite
  const storedPhases = [];
  for (const phase of coachResult.phases) {
    const storedPhase = await createPhase(db, {
      plan_id: plan.id,
      number: phase.number,
      title: phase.title,
      description: phase.description,
      hint_level: phase.hint_level,
      status: 'pending',
    });
    storedPhases.push(storedPhase);
  }

  // Step 11: Store hints in SQLite
  for (let i = 0; i < coachResult.phases.length; i++) {
    const coachPhase = coachResult.phases[i]!;
    const storedPhase = storedPhases[i]!;
    const requiredLevel = mapHintLevelToRequired(coachPhase.hint_level);

    // File hints
    for (const fileHint of coachPhase.hints.file_hints) {
      await createHint(db, {
        phase_id: storedPhase.id,
        type: 'file',
        path: fileHint.path,
        style: fileHint.style,
        required_level: requiredLevel,
      });
    }

    // Line hints
    for (const lineHint of coachPhase.hints.line_hints) {
      await createHint(db, {
        phase_id: storedPhase.id,
        type: 'line',
        path: lineHint.path,
        line_start: lineHint.start,
        line_end: lineHint.end,
        style: lineHint.style,
        hover_text: lineHint.hover_text,
        required_level: requiredLevel,
      });
    }
  }

  // Step 12: Broadcast coaching:plan_ready via WebSocket
  broadcast({
    type: 'coaching:plan_ready',
    data: {
      plan: {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        total_phases: plan.total_phases,
        phases: storedPhases.map((p) => ({
          number: p.number,
          title: p.title,
          description: p.description,
          hint_level: p.hint_level,
        })),
      },
    },
  });

  // Step 13: Return result
  return {
    planId: plan.id,
    title: plan.title,
    totalPhases: plan.total_phases,
    memoryConnection: coachResult.memory_connection,
    estimatedDifficulty: coachResult.estimated_difficulty,
  };
}
