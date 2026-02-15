// Dashboard Flow: In-progress issues + authored PRs streaming.
//
// Pipeline:
//   1. Query local DB for active sessions with issue_number
//   2. Fetch those issues from GitHub API, enrich with summary/difficulty
//   3. Fetch open PRs authored by authenticated user
//   4. Stream each as InProgressItem to requesting client
//   5. Send completion signal
//   6. Return set of in-progress issue numbers for exclusion

import { getLogger } from '../../logger/logtape.js';
import { getOctokit, getAuthenticatedUser } from '../../github/client.js';

const logger = getLogger(['paige', 'dashboard', 'in-progress']);
import { summarizeIssue } from '../../github/summarize.js';
import { getDatabase } from '../../database/db.js';
import { getActiveSessionId } from '../../mcp/session.js';
import { getInProgressIssueNumbers } from '../../database/queries/sessions.js';
import { getAllDreyfus } from '../../database/queries/dreyfus.js';
import { sendToClient } from '../../websocket/server.js';
import type {
  InProgressItemPayload,
  ScoredIssueLabel,
  ScoredIssueAuthor,
  DashboardInProgressItemMessage,
  DashboardInProgressCompleteMessage,
} from '../../types/websocket.js';

/** Shape returned by octokit.rest.issues.get (subset we use). */
interface OctokitIssueDetail {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  updated_at: string;
  created_at: string;
  comments: number;
  user: { login: string; avatar_url: string } | null;
  labels: Array<{ name?: string; color?: string } | string>;
}

/** Shape returned by octokit.rest.pulls.list (subset we use). */
interface OctokitPR {
  number: number;
  title: string;
  html_url: string;
  updated_at: string;
  created_at: string;
  draft: boolean;
  user: { login: string; avatar_url: string } | null;
  labels: Array<{ name?: string; color?: string } | string>;
}

/**
 * Fetches in-progress issues and authored PRs, streams them to client.
 * Returns the set of in-progress issue numbers for use in excluding
 * them from the main issues panel.
 */
export async function assembleAndStreamInProgress(
  owner: string,
  repo: string,
  connectionId: string,
): Promise<Set<number>> {
  const db = getDatabase();
  const inProgressNumbers = new Set<number>();

  // Step 1: Get in-progress issue numbers from local DB
  if (db !== null) {
    const numbers = await getInProgressIssueNumbers(db);
    for (const n of numbers) {
      inProgressNumbers.add(n);
    }
  }

  const octokit = getOctokit();
  if (octokit === null) {
    sendToClient(connectionId, {
      type: 'dashboard:in_progress_complete',
      data: {},
    } as DashboardInProgressCompleteMessage);
    return inProgressNumbers;
  }

  // Step 2: Fetch and stream in-progress issues
  if (inProgressNumbers.size > 0) {
    const sessionId = getActiveSessionId();
    let dreyfusContext = 'No skill assessments available';
    if (db !== null) {
      const assessments = await getAllDreyfus(db);
      if (assessments.length > 0) {
        dreyfusContext = assessments
          .map((a) => `${a.skill_area}: ${a.stage} (confidence: ${String(a.confidence)})`)
          .join(', ');
      }
    }

    for (const issueNumber of inProgressNumbers) {
      try {
        const { data: issue } = await octokit.rest.issues.get({
          owner,
          repo,
          issue_number: issueNumber,
        });

        const octokitIssue = issue as unknown as OctokitIssueDetail;
        const labels = normalizeLabels(octokitIssue.labels);

        const { summary, difficulty } = await summarizeIssue(
          {
            number: octokitIssue.number,
            title: octokitIssue.title,
            body: octokitIssue.body,
            updated_at: octokitIssue.updated_at,
            labels,
          },
          dreyfusContext,
          sessionId,
        );

        const item: InProgressItemPayload = {
          type: 'issue',
          number: octokitIssue.number,
          title: octokitIssue.title,
          labels: labels.map((l): ScoredIssueLabel => ({ name: l.name, color: l.color })),
          author: toAuthor(octokitIssue.user),
          updatedAt: octokitIssue.updated_at,
          createdAt: octokitIssue.created_at,
          htmlUrl: octokitIssue.html_url,
          difficulty,
          summary,
        };

        sendToClient(connectionId, {
          type: 'dashboard:in_progress_item',
          data: { item },
        } as DashboardInProgressItemMessage);
      } catch (err) {
        logger.error`Failed to fetch issue #${String(issueNumber)}: ${err instanceof Error ? err.message : err}`;
      }
    }
  }

  // Step 3: Fetch open PRs authored by the authenticated user
  try {
    const user = await getAuthenticatedUser();
    if (user !== null) {
      const { data: prs } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'open',
        per_page: 50,
        sort: 'updated',
        direction: 'desc',
      });

      // Filter to PRs authored by the authenticated user
      const authoredPRs = (prs as unknown as OctokitPR[]).filter(
        (pr) => pr.user?.login === user.login,
      );

      for (const pr of authoredPRs) {
        const labels = normalizeLabels(pr.labels);
        const item: InProgressItemPayload = {
          type: 'pr',
          number: pr.number,
          title: pr.title,
          labels: labels.map((l): ScoredIssueLabel => ({ name: l.name, color: l.color })),
          author: toAuthor(pr.user),
          updatedAt: pr.updated_at,
          createdAt: pr.created_at,
          htmlUrl: pr.html_url,
          prStatus: pr.draft ? 'draft' : 'open',
        };

        sendToClient(connectionId, {
          type: 'dashboard:in_progress_item',
          data: { item },
        } as DashboardInProgressItemMessage);
      }
    }
  } catch (err) {
    logger.error`Failed to fetch PRs: ${err instanceof Error ? err.message : err}`;
  }

  // Step 4: Signal completion
  sendToClient(connectionId, {
    type: 'dashboard:in_progress_complete',
    data: {},
  } as DashboardInProgressCompleteMessage);

  return inProgressNumbers;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

function toAuthor(user: { login: string; avatar_url: string } | null): ScoredIssueAuthor {
  if (user === null) {
    return { login: '', avatarUrl: '' };
  }
  return { login: user.login, avatarUrl: user.avatar_url };
}
