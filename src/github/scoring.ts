// Issue scoring heuristic for ranking GitHub issues by relevance to the current user.
// Pure functions — no side effects, no I/O.

/** Minimal issue shape needed for scoring. */
export interface ScorableIssue {
  readonly number: number;
  readonly user: { readonly login: string } | null;
  readonly assignees: ReadonlyArray<{ readonly login: string }>;
  readonly comments: number;
  readonly labels: ReadonlyArray<{ readonly name: string }>;
  readonly updated_at: string;
  readonly body: string | null;
}

// ── Label Score Tables ──────────────────────────────────────────────────────

const LABEL_SCORES: Record<string, number> = {
  'good first issue': 15,
  'good-first-issue': 15,
  bug: 2,
  'help wanted': 2,
  'help-wanted': 2,
  enhancement: 2,
  security: -3,
  docs: -10,
  documentation: -10,
  question: -10,
  duplicate: -25,
  invalid: -25,
  wontfix: -50,
};

// ── Score Calculation ───────────────────────────────────────────────────────

/**
 * Scores a single GitHub issue using a heuristic that considers:
 *   - Author relationship (+5 if the current user authored it)
 *   - Assignee relationship (+20 if the current user is assigned)
 *   - Comment activity (comments * 0.25)
 *   - Label bonuses/penalties (see LABEL_SCORES)
 *   - Recency (bonus for recent updates, penalty for stale issues)
 *   - Body length (penalty for sparse issue bodies)
 *
 * @param issue - GitHub issue data
 * @param currentUserLogin - Login of the authenticated user (for author/assignee bonuses)
 * @returns Numeric score (higher = more relevant)
 */
export function scoreIssue(issue: ScorableIssue, currentUserLogin: string): number {
  let score = 0;

  // Author bonus
  if (issue.user?.login === currentUserLogin) {
    score += 5;
  }

  // Assignee bonus
  const isAssignee = issue.assignees.some((a) => a.login === currentUserLogin);
  if (isAssignee) {
    score += 20;
  }

  // Comment activity
  score += issue.comments * 0.25;

  // Label bonuses/penalties
  for (const label of issue.labels) {
    const labelName = label.name.toLowerCase();
    const labelScore = LABEL_SCORES[labelName];
    if (labelScore !== undefined) {
      score += labelScore;
    }
  }

  // Recency scoring
  const updatedAt = new Date(issue.updated_at);
  const now = new Date();
  const daysSinceUpdate = Math.max(
    0,
    (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceUpdate <= 5) {
    score += 3;
  } else if (daysSinceUpdate <= 15) {
    score += 6;
  } else {
    score -= daysSinceUpdate * 0.1;
  }

  // Body length penalty
  const bodyLength = issue.body?.length ?? 0;
  if (bodyLength < 50) {
    score -= 25;
  } else if (bodyLength < 200) {
    score -= 15;
  } else if (bodyLength < 400) {
    score -= 5;
  }

  return score;
}

/**
 * Sorts issues by score (descending) and returns the top N.
 *
 * @param issues - Array of issues with pre-computed scores
 * @param n - Maximum number of issues to return
 * @returns Top N issues sorted by score descending
 */
export function sortAndTakeTop<T extends { readonly score: number }>(
  issues: readonly T[],
  n: number,
): T[] {
  return [...issues].sort((a, b) => b.score - a.score).slice(0, n);
}
