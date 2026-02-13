// In-memory caches for GitHub API responses with TTL-based expiration.
// Uses Keyv with default in-memory Map store.

import Keyv from 'keyv';
import type { RepoInfo, RepoActivityEntry } from '../types/websocket.js';

// ── Cache Instances ──────────────────────────────────────────────────────────

/** Cache for repository listings. TTL: 5 minutes. */
export const repoCache = new Keyv<RepoInfo[]>({ ttl: 5 * 60 * 1000 });

/** Cache for repository activity data. TTL: 60 minutes. */
export const activityCache = new Keyv<RepoActivityEntry[]>({ ttl: 60 * 60 * 1000 });

/**
 * Cache for issue summaries produced by Claude.
 * Key format: `issue:{number}:{updated_at}`
 * TTL: 1 hour.
 */
export const summaryCache = new Keyv<string>({ ttl: 60 * 60 * 1000 });
