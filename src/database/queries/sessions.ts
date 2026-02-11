// TDD stub — will be implemented in T085
import type { AppDatabase } from '../db.js';
import type { Session } from '../../types/domain.js';

export interface CreateSessionInput {
  project_dir: string;
  status: 'active' | 'completed';
  started_at: string;
  issue_number?: number | null;
  issue_title?: string | null;
}

export interface UpdateSessionInput {
  status?: 'active' | 'completed';
  ended_at?: string | null;
}

export function createSession(_db: AppDatabase, _input: CreateSessionInput): Promise<Session> {
  return Promise.reject(new Error('Not implemented'));
}

export function getSession(_db: AppDatabase, _id: number): Promise<Session | undefined> {
  return Promise.reject(new Error('Not implemented'));
}

export function updateSession(
  _db: AppDatabase,
  _id: number,
  _input: UpdateSessionInput,
): Promise<Session> {
  return Promise.reject(new Error('Not implemented'));
}
