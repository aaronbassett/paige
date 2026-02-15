// PR creation via the GitHub API (Octokit).
// Delegates authentication to the shared GitHub client singleton.

import { getOctokit } from '../github/client.js';

/** Result returned after successfully creating a pull request. */
export interface PullRequestResult {
  readonly prUrl: string;
  readonly prNumber: number;
}

/**
 * Creates a pull request on GitHub.
 *
 * @param owner  - Repository owner (user or org)
 * @param repo   - Repository name
 * @param head   - Branch containing changes
 * @param base   - Branch to merge into
 * @param title  - PR title
 * @param body   - PR description (Markdown)
 * @returns The URL and number of the created PR
 * @throws If no GITHUB_TOKEN is configured or the API call fails
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<PullRequestResult> {
  const octokit = getOctokit();
  if (octokit === null) {
    throw new Error('GitHub API not available — no GITHUB_TOKEN set');
  }

  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });

  return { prUrl: data.html_url, prNumber: data.number };
}
