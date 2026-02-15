// Dashboard Flow 2: GitHub issues with scoring, summarisation, and per-issue streaming.
//
// Pipeline:
//   1. Fetch open issues via Octokit (filter out PRs)
//   2. Get authenticated user for scoring context
//   3. Score all issues with heuristic
//   4. Take top 15
//   5. Load Dreyfus context for personalised difficulty
//   6. Summarise each issue with Haiku (cached)
//   7. Stream each scored issue to the requesting client
//   8. Send completion signal

import { getOctokit, getAuthenticatedUser } from '../../github/client.js';
import { scoreIssue, sortAndTakeTop, type ScorableIssue } from '../../github/scoring.js';
import { summarizeIssue } from '../../github/summarize.js';
import { getDatabase } from '../../database/db.js';
import { getActiveSessionId } from '../../mcp/session.js';
import { getAllDreyfus } from '../../database/queries/dreyfus.js';
import { sendToClient } from '../../websocket/server.js';
import type {
  ScoredIssuePayload,
  ScoredIssueLabel,
  ScoredIssueAuthor,
  DashboardSingleIssueMessage,
  DashboardIssuesCompleteMessage,
} from '../../types/websocket.js';

/** Maximum number of issues to return after scoring. */
const TOP_N = 15;

/** Shape returned by octokit.rest.issues.listForRepo (subset we use). */
interface OctokitIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  updated_at: string;
  created_at: string;
  comments: number;
  pull_request?: unknown;
  user: { login: string; avatar_url: string } | null;
  assignees?: Array<{ login: string; avatar_url: string }> | null;
  labels: Array<{ name?: string; color?: string } | string>;
}

/**
 * Fetches, scores, summarises, and streams GitHub issues to a specific client.
 *
 * Each issue is sent individually via `dashboard:issue` as soon as it is ready,
 * allowing the frontend to render issues progressively. After all issues are
 * sent, a `dashboard:issues_complete` message signals the end of the stream.
 *
 * @param owner - Repository owner (e.g. "aaronbassett")
 * @param repo - Repository name (e.g. "paige")
 * @param connectionId - WebSocket connection to stream results to
 */
export async function assembleAndStreamIssues(
  owner: string,
  repo: string,
  connectionId: string,
  excludeIssueNumbers?: Set<number>,
): Promise<void> {
  const octokit = getOctokit();
  if (octokit === null) {
    // No GitHub token — send completion immediately with no issues
    sendToClient(connectionId, {
      type: 'dashboard:issues_complete',
      data: {},
    } as DashboardIssuesCompleteMessage);
    return;
  }

  // Step 1: Fetch open issues (filter out PRs)
  const { data: rawIssues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    per_page: 100,
    sort: 'updated',
    direction: 'desc',
  });

  // Filter out pull requests (GitHub's issues endpoint includes PRs)
  const issues = (rawIssues as OctokitIssue[])
    .filter((issue) => issue.pull_request === undefined)
    .filter((issue) => !excludeIssueNumbers?.has(issue.number));

  if (issues.length === 0) {
    sendToClient(connectionId, {
      type: 'dashboard:issues_complete',
      data: {},
    } as DashboardIssuesCompleteMessage);
    return;
  }

  // Step 2: Get authenticated user for scoring
  const user = await getAuthenticatedUser();
  const currentUserLogin = user?.login ?? '';

  // Step 3: Score all issues
  const scoredIssues = issues.map((issue) => {
    const scorable: ScorableIssue = {
      number: issue.number,
      user: issue.user,
      assignees: issue.assignees ?? [],
      comments: issue.comments,
      labels: normalizeLabels(issue.labels),
      updated_at: issue.updated_at,
      body: issue.body,
    };
    return {
      ...issue,
      score: scoreIssue(scorable, currentUserLogin),
    };
  });

  // Step 4: Take top 15
  const topIssues = sortAndTakeTop(scoredIssues, TOP_N);

  // Step 5: Load Dreyfus context
  const db = getDatabase();
  let dreyfusContext = 'No skill assessments available';
  if (db !== null) {
    const assessments = await getAllDreyfus(db);
    if (assessments.length > 0) {
      dreyfusContext = assessments
        .map((a) => `${a.skill_area}: ${a.stage} (confidence: ${String(a.confidence)})`)
        .join(', ');
    }
  }

  // Step 6 & 7: Summarise each issue and stream to client
  // Dashboard may run without an active coaching session
  const sessionId = getActiveSessionId();

  for (const issue of topIssues) {
    try {
      const { summary, difficulty } = await summarizeIssue(
        {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          updated_at: issue.updated_at,
          labels: normalizeLabels(issue.labels),
        },
        dreyfusContext,
        sessionId,
      );

      const payload: ScoredIssuePayload = {
        number: issue.number,
        title: issue.title,
        body: issue.body ?? '',
        summary,
        difficulty,
        labels: normalizeLabels(issue.labels).map(
          (l): ScoredIssueLabel => ({
            name: l.name,
            color: l.color,
          }),
        ),
        author: toAuthor(issue.user),
        assignees: (issue.assignees ?? []).map(toAuthor),
        commentCount: issue.comments,
        updatedAt: issue.updated_at,
        createdAt: issue.created_at,
        htmlUrl: issue.html_url,
        score: issue.score,
      };

      sendToClient(connectionId, {
        type: 'dashboard:issue',
        data: { issue: payload },
      } as DashboardSingleIssueMessage);
    } catch (err) {
      // Log but continue — a single summarisation failure should not block others
      // eslint-disable-next-line no-console
      console.error(
        `[dashboard:issues] Failed to summarise issue #${String(issue.number)}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Step 8: Signal completion
  sendToClient(connectionId, {
    type: 'dashboard:issues_complete',
    data: {},
  } as DashboardIssuesCompleteMessage);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalizes GitHub's label format (can be string or { name, color }). */
function normalizeLabels(
  labels: Array<{ name?: string; color?: string } | string>,
): Array<{ name: string; color: string }> {
  return labels
    .map((label) => {
      if (typeof label === 'string') {
        return { name: label, color: '666666' };
      }
      return { name: label.name ?? '', color: label.color ?? '666666' };
    })
    .filter((l) => l.name !== '');
}

/** Converts an Octokit user object to ScoredIssueAuthor. */
function toAuthor(user: { login: string; avatar_url: string } | null): ScoredIssueAuthor {
  if (user === null) {
    return { login: '', avatarUrl: '' };
  }
  return { login: user.login, avatarUrl: user.avatar_url };
}
