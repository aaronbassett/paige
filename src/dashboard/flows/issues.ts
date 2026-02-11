// Dashboard Flow 2: GitHub issues with Haiku suitability assessment

import { execSync } from 'node:child_process';
import type { DashboardIssuesData, IssueSuitability } from '../../types/websocket.js';
import { callApi } from '../../api-client/claude.js';
import { issueSuitabilitySchema } from '../../api-client/schemas.js';
import { getDatabase } from '../../database/db.js';
import { getAllDreyfus } from '../../database/queries/dreyfus.js';

/** Shape returned by `gh issue list --json number,title,body,labels`. */
interface GhIssue {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
}

/**
 * Fetches open GitHub issues, assesses suitability with Haiku, and returns ranked results.
 *
 * 1. Runs `gh issue list` via execSync to fetch open issues
 * 2. If no issues, returns empty array without calling Haiku
 * 3. Loads Dreyfus assessments for skill-level context
 * 4. Calls Haiku with issueSuitabilitySchema to rate each issue
 * 5. Merges GitHub data with suitability assessments
 */
export async function assembleIssues(sessionId: number): Promise<DashboardIssuesData> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialised');
  }

  // Fetch open GitHub issues via CLI
  const output = execSync('gh issue list --state open --json number,title,body,labels --limit 20', {
    encoding: 'utf-8',
    timeout: 15000,
  });

  const parsed: unknown = JSON.parse(String(output));
  const ghIssues = parsed as GhIssue[];

  if (ghIssues.length === 0) {
    return { issues: [] };
  }

  // Load Dreyfus assessments for suitability context
  const assessments = await getAllDreyfus(db);
  const dreyfusContext =
    assessments.length > 0
      ? assessments
          .map((a) => `${a.skill_area}: ${a.stage} (confidence: ${String(a.confidence)})`)
          .join(', ')
      : 'No skill assessments available';

  // Build issue summaries for Haiku
  const issueSummaries = ghIssues
    .map(
      (issue) => `Issue #${String(issue.number)}: "${issue.title}" — ${issue.body.slice(0, 200)}`,
    )
    .join('\n');

  // Call Haiku for suitability assessment
  const systemPrompt =
    "You assess GitHub issues for suitability based on a developer's skill level. " +
    `Developer skill levels: ${dreyfusContext}. ` +
    'Rate each issue as excellent, good, fair, or poor based on whether the developer can learn from working on it.';

  const userMessage =
    'Assess the suitability of these GitHub issues for the developer:\n\n' + issueSummaries;

  const result = await callApi({
    callType: 'issue_suitability',
    model: 'haiku',
    sessionId,
    systemPrompt,
    userMessage,
    responseSchema: issueSuitabilitySchema,
  });

  // Merge GitHub data with suitability assessments
  const issues = ghIssues.map((ghIssue) => {
    const assessment = result.assessments.find((a) => a.issue_number === ghIssue.number);
    return {
      number: ghIssue.number,
      title: ghIssue.title,
      body: ghIssue.body,
      suitability: (assessment?.suitability ?? 'fair') as IssueSuitability,
      recommended_focus: assessment?.recommended_focus ?? '',
      labels: ghIssue.labels.map((l) => l.name),
    };
  });

  return { issues };
}
