// TDD stub — will be implemented in T087
import type { AppDatabase } from '../db.js';
import type { Phase, HintLevel, PhaseStatus } from '../../types/domain.js';

export interface CreatePhaseInput {
  plan_id: number;
  number: number;
  title: string;
  description: string;
  hint_level: HintLevel;
  status: PhaseStatus;
}

export function createPhase(_db: AppDatabase, _input: CreatePhaseInput): Promise<Phase> {
  return Promise.reject(new Error('Not implemented'));
}

export function getPhasesByPlan(_db: AppDatabase, _planId: number): Promise<Phase[]> {
  return Promise.reject(new Error('Not implemented'));
}
