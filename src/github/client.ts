// GitHub API client with graceful degradation when no token is available.
// Singleton Octokit instance, reused for all GitHub API calls.

import { Octokit } from 'octokit';

// ── Singleton Client ─────────────────────────────────────────────────────────

/** Lazily-initialized Octokit client, reused for all GitHub API calls. */
let client: Octokit | null = null;

/** Whether initialization has been attempted (prevents repeated attempts with no token). */
let initialized = false;

/**
 * Returns the singleton Octokit client, or null if no GITHUB_TOKEN is available.
 * Gracefully degrades: callers should check for null before making API calls.
 */
export function getOctokit(): Octokit | null {
  if (!initialized) {
    initialized = true;
    const token = process.env['GITHUB_TOKEN'];
    if (token !== undefined && token !== '') {
      client = new Octokit({ auth: token });
    }
  }
  return client;
}

// ── Authenticated User (Cached) ─────────────────────────────────────────────

/** Cached authenticated user data. */
interface AuthenticatedUser {
  readonly login: string;
  readonly id: number;
  readonly avatarUrl: string;
  readonly name: string | null;
}

let cachedUser: AuthenticatedUser | null = null;

/**
 * Returns the authenticated GitHub user, caching the result after the first call.
 * Returns null if no Octokit client is available.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (cachedUser !== null) {
    return cachedUser;
  }

  const octokit = getOctokit();
  if (octokit === null) {
    return null;
  }

  const { data } = await octokit.rest.users.getAuthenticated();
  cachedUser = {
    login: data.login,
    id: data.id,
    avatarUrl: data.avatar_url,
    name: data.name ?? null,
  };

  return cachedUser;
}

// ── Testing Helpers ──────────────────────────────────────────────────────────

/**
 * Resets the singleton state. Only for use in tests.
 * @internal
 */
export function _resetForTesting(): void {
  client = null;
  initialized = false;
  cachedUser = null;
}
