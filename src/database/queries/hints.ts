// TDD stub — will be implemented in T089
import type { AppDatabase } from '../db.js';
import type { PhaseHint, HintType, HintStyle, HintRequiredLevel } from '../../types/domain.js';

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

export function createHint(_db: AppDatabase, _input: CreateHintInput): Promise<PhaseHint> {
  return Promise.reject(new Error('Not implemented'));
}

export function getHintsByPhase(_db: AppDatabase, _phaseId: number): Promise<PhaseHint[]> {
  return Promise.reject(new Error('Not implemented'));
}
