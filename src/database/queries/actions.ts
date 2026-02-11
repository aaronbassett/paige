import type { AppDatabase } from '../db.js';
import type { ActionLogEntry } from '../../types/domain.js';

/**
 * Retrieves all action log entries for a given session, ordered by created_at ASC.
 */
export function getActionsBySession(
  _db: AppDatabase,
  _sessionId: number,
): Promise<ActionLogEntry[]> {
  return Promise.reject(new Error('Not implemented'));
}

/**
 * Retrieves action log entries for a session filtered by action type.
 */
export function getActionsByType(
  _db: AppDatabase,
  _sessionId: number,
  _actionType: string,
): Promise<ActionLogEntry[]> {
  return Promise.reject(new Error('Not implemented'));
}

/**
 * Retrieves the most recent N actions for a session, ordered by created_at DESC.
 */
export function getRecentActions(
  _db: AppDatabase,
  _sessionId: number,
  _limit: number,
): Promise<ActionLogEntry[]> {
  return Promise.reject(new Error('Not implemented'));
}
