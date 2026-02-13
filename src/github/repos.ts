// GitHub repository listing and activity fetching with caching.
// All functions gracefully return empty arrays when no GitHub token is available.

import { getOctokit } from './client.js';
import { repoCache, activityCache } from './cache.js';
import type { RepoInfo, RepoActivityEntry } from '../types/websocket.js';

// ── Cache Keys ───────────────────────────────────────────────────────────────

const REPOS_CACHE_KEY = 'user:repos';

function activityCacheKey(fullName: string): string {
  return `activity:${fullName}`;
}

// ── Repository Listing ───────────────────────────────────────────────────────

/**
 * Fetches the authenticated user's repositories, filtered for coaching suitability.
 *
 * Filters applied:
 *   - Public repositories only (not private)
 *   - Not archived
 *   - Has at least one open issue
 *
 * Results are cached for 5 minutes (via repoCache).
 * Returns an empty array if no GitHub token is configured.
 */
export async function fetchUserRepos(): Promise<RepoInfo[]> {
  // Check cache first
  const cached = await repoCache.get(REPOS_CACHE_KEY);
  if (cached !== undefined) {
    return cached;
  }

  const octokit = getOctokit();
  if (octokit === null) {
    return [];
  }

  // Fetch all repos via pagination
  const rawRepos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    type: 'owner',
    sort: 'pushed',
    per_page: 100,
  });

  // Filter: public, not archived, has open issues
  const filtered = rawRepos.filter(
    (repo) => !repo.private && !repo.archived && (repo.open_issues_count ?? 0) > 0,
  );

  // Map to RepoInfo[]
  const repos: RepoInfo[] = filtered.map((repo) => ({
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner?.login ?? '',
    description: repo.description ?? '',
    language: repo.language ?? '',
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    openPRs: 0, // Not available from list endpoint; populated separately if needed
    license: repo.license?.spdx_id ?? '',
    updatedAt: repo.updated_at ?? '',
    pushedAt: repo.pushed_at ?? '',
  }));

  // Cache the result
  await repoCache.set(REPOS_CACHE_KEY, repos);

  return repos;
}

// ── Repository Activity ──────────────────────────────────────────────────────

/**
 * Fetches recent activity for a specific repository (last 30 days).
 *
 * Results are cached for 60 minutes (via activityCache).
 * Returns an empty array if no GitHub token is configured.
 *
 * @param fullName - Repository full name in "owner/repo" format
 */
export async function fetchRepoActivity(fullName: string): Promise<RepoActivityEntry[]> {
  const cacheKey = activityCacheKey(fullName);

  // Check cache first
  const cached = await activityCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const octokit = getOctokit();
  if (octokit === null) {
    return [];
  }

  const [owner, repo] = fullName.split('/');
  if (owner === undefined || repo === undefined) {
    return [];
  }

  // Calculate 30 days ago in ISO format
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  try {
    // Use the REST API endpoint for repository activity
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/activity', {
      owner,
      repo,
      time_period: 'month',
      per_page: 100,
    });

    // Map to RepoActivityEntry[], filtering to last 30 days
    const activities: RepoActivityEntry[] = (data as Array<{ timestamp: string; activity_type: string }>)
      .filter((entry) => entry.timestamp >= since)
      .map((entry) => ({
        timestamp: entry.timestamp,
        activityType: entry.activity_type,
      }));

    // Cache the result
    await activityCache.set(cacheKey, activities);

    return activities;
  } catch {
    // If the endpoint fails (e.g., repo not found, permissions), return empty
    return [];
  }
}
