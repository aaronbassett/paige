// TDD stub — will be implemented in T094
import type { AppDatabase } from '../db.js';
import type { KataSpec } from '../../types/domain.js';

export interface CreateKataInput {
  gap_id: number;
  title: string;
  description: string;
  scaffolding_code: string;
  instructor_notes: string;
  constraints: string;
  created_at: string;
}

export function createKata(_db: AppDatabase, _input: CreateKataInput): Promise<KataSpec> {
  return Promise.reject(new Error('Not implemented'));
}

export function getKatasByGap(_db: AppDatabase, _gapId: number): Promise<KataSpec[]> {
  return Promise.reject(new Error('Not implemented'));
}

export function updateKataAttempts(
  _db: AppDatabase,
  _id: number,
  _userAttempts: string,
): Promise<KataSpec> {
  return Promise.reject(new Error('Not implemented'));
}
