// TDD stub — will be implemented in T086
import type { AppDatabase } from '../db.js';
import type { Plan } from '../../types/domain.js';

export interface CreatePlanInput {
  session_id: number;
  title: string;
  description: string;
  total_phases: number;
  created_at: string;
}

export function createPlan(_db: AppDatabase, _input: CreatePlanInput): Promise<Plan> {
  return Promise.reject(new Error('Not implemented'));
}

export function getPlansBySession(_db: AppDatabase, _sessionId: number): Promise<Plan[]> {
  return Promise.reject(new Error('Not implemented'));
}
