// TDD stub — will be implemented in T092
import type { AppDatabase } from '../db.js';
import type { DreyfusAssessment, DreyfusStage } from '../../types/domain.js';

export interface UpsertDreyfusInput {
  skill_area: string;
  stage: DreyfusStage;
  confidence: number;
  evidence: string;
  assessed_at: string;
}

export function upsertDreyfus(
  _db: AppDatabase,
  _input: UpsertDreyfusInput,
): Promise<DreyfusAssessment> {
  return Promise.reject(new Error('Not implemented'));
}

export function getDreyfusBySkill(
  _db: AppDatabase,
  _skillArea: string,
): Promise<DreyfusAssessment | undefined> {
  return Promise.reject(new Error('Not implemented'));
}

export function getAllDreyfus(_db: AppDatabase): Promise<DreyfusAssessment[]> {
  return Promise.reject(new Error('Not implemented'));
}
