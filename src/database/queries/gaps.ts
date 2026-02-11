// TDD stub — will be implemented in T093
import type { AppDatabase } from '../db.js';
import type { KnowledgeGap, GapSeverity } from '../../types/domain.js';

export interface CreateGapInput {
  session_id: number;
  topic: string;
  severity: GapSeverity;
  evidence: string;
  related_concepts: string;
  identified_at: string;
}

export function createGap(_db: AppDatabase, _input: CreateGapInput): Promise<KnowledgeGap> {
  return Promise.reject(new Error('Not implemented'));
}

export function getGapsBySession(_db: AppDatabase, _sessionId: number): Promise<KnowledgeGap[]> {
  return Promise.reject(new Error('Not implemented'));
}

export function markGapAddressed(_db: AppDatabase, _id: number): Promise<KnowledgeGap> {
  return Promise.reject(new Error('Not implemented'));
}
