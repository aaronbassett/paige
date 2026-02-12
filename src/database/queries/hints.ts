import type { AppDatabase } from '../db.js';
import type { PhaseHint, HintType, HintStyle, HintRequiredLevel } from '../../types/domain.js';

// ── Input Types ─────────────────────────────────────────────────────────────

export interface CreateHintInput {
  phase_id: number;
  type: HintType;
  path: string;
  line_start?: number | null;
  line_end?: number | null;
  style: HintStyle;
  hover_text?: string | null;
  required_level: HintRequiredLevel;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new phase hint row and returns the full persisted record.
 *
 * Optional fields (`line_start`, `line_end`, `hover_text`) default to `null`
 * when omitted.
 */
export async function createHint(db: AppDatabase, input: CreateHintInput): Promise<PhaseHint> {
  const result = await db
    .insertInto('phase_hints')
    .values({
      phase_id: input.phase_id,
      type: input.type,
      path: input.path,
      line_start: input.line_start ?? null,
      line_end: input.line_end ?? null,
      style: input.style,
      hover_text: input.hover_text ?? null,
      required_level: input.required_level,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);

  const hint = await db
    .selectFrom('phase_hints')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return hint as PhaseHint;
}

/**
 * Retrieves all hints for a given phase.
 *
 * Returns an empty array when no hints exist for the phase.
 */
export async function getHintsByPhase(db: AppDatabase, phaseId: number): Promise<PhaseHint[]> {
  const hints = await db
    .selectFrom('phase_hints')
    .selectAll()
    .where('phase_id', '=', phaseId)
    .execute();

  return hints as PhaseHint[];
}
