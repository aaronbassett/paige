// TDD stub — will be implemented in T090
import type { AppDatabase } from '../db.js';
import type { ProgressEvent } from '../../types/domain.js';

export interface CreateProgressEventInput {
  phase_id: number;
  event_type: string;
  data?: string | null;
  created_at: string;
}

export function createProgressEvent(
  _db: AppDatabase,
  _input: CreateProgressEventInput,
): Promise<ProgressEvent> {
  return Promise.reject(new Error('Not implemented'));
}

export function getProgressEventsByPhase(
  _db: AppDatabase,
  _phaseId: number,
): Promise<ProgressEvent[]> {
  return Promise.reject(new Error('Not implemented'));
}
