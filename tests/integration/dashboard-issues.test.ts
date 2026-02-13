// Integration test for Dashboard Issues streaming flow (Flow 2)
// Tests assembleAndStreamIssues() from src/dashboard/flows/issues.ts
// Tests handleDashboardRefreshIssues() from src/dashboard/handler.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DreyfusAssessment } from '../../src/types/domain.js';
import type { ScoredIssuePayload, DashboardSingleIssueMessage } from '../../src/types/websocket.js';

// ── Mock external dependencies ──────────────────────────────────────────────

vi.mock('../../src/github/client.js', () => ({
  getOctokit: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));

vi.mock('../../src/github/summarize.js', () => ({
  summarizeIssue: vi.fn(),
}));

vi.mock('../../src/database/db.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../src/database/queries/dreyfus.js', () => ({
  getAllDreyfus: vi.fn(),
}));

vi.mock('../../src/websocket/server.js', () => ({
  sendToClient: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock('../../src/logger/action-log.js', () => ({
  logAction: vi.fn(),
}));

vi.mock('../../src/mcp/session.js', () => ({
  getActiveSessionId: vi.fn(),
  getActiveRepo: vi.fn(),
}));

vi.mock('../../src/dashboard/flows/state.js', () => ({
  assembleState: vi.fn(),
}));

vi.mock('../../src/dashboard/flows/challenges.js', () => ({
  assembleChallenges: vi.fn(),
}));

vi.mock('../../src/dashboard/flows/learning.js', () => ({
  assembleLearningMaterials: vi.fn(),
}));

// ── Import modules under test AFTER mocking ────────────────────────────────

import { getOctokit, getAuthenticatedUser } from '../../src/github/client.js';
import { summarizeIssue } from '../../src/github/summarize.js';
import { getDatabase, type AppDatabase } from '../../src/database/db.js';
import { getAllDreyfus } from '../../src/database/queries/dreyfus.js';
import { sendToClient } from '../../src/websocket/server.js';
import { assembleAndStreamIssues } from '../../src/dashboard/flows/issues.js';
import { handleDashboardRefreshIssues } from '../../src/dashboard/handler.js';

// ── Type-safe mock references ──────────────────────────────────────────────

const mockGetOctokit = vi.mocked(getOctokit);
const mockGetAuthenticatedUser = vi.mocked(getAuthenticatedUser);
const mockSummarizeIssue = vi.mocked(summarizeIssue);
const mockGetDatabase = vi.mocked(getDatabase);
const mockGetAllDreyfus = vi.mocked(getAllDreyfus);
const mockSendToClient = vi.mocked(sendToClient);

// ── Fixtures ────────────────────────────────────────────────────────────────

const fakeDb = {} as AppDatabase;
const CONNECTION_ID = 'test-connection-123';
const OWNER = 'test-owner';
const REPO = 'test-repo';

/** Creates a mock Octokit instance with listForRepo returning test issues. */
function createMockOctokit(issues: unknown[] = sampleGitHubIssues()) {
  return {
    rest: {
      issues: {
        listForRepo: vi.fn().mockResolvedValue({ data: issues }),
      },
    },
  };
}

/** Sample GitHub issues as returned by Octokit's listForRepo. */
function sampleGitHubIssues() {
  return [
    {
      number: 12,
      title: 'Fix login form validation',
      body: 'The login form accepts empty passwords. Need to add client-side validation to prevent empty submissions.',
      html_url: 'https://github.com/test-owner/test-repo/issues/12',
      updated_at: new Date().toISOString(),
      created_at: '2026-02-01T12:00:00.000Z',
      comments: 3,
      user: { login: 'alice', avatar_url: 'https://avatars.githubusercontent.com/alice' },
      assignees: [],
      labels: [
        { name: 'bug', color: 'fc2929' },
        { name: 'good first issue', color: '0e8a16' },
      ],
    },
    {
      number: 15,
      title: 'Add dark mode support',
      body: 'Implement dark mode toggle in settings panel using CSS variables. Should persist across sessions.',
      html_url: 'https://github.com/test-owner/test-repo/issues/15',
      updated_at: new Date().toISOString(),
      created_at: '2026-02-05T12:00:00.000Z',
      comments: 1,
      user: { login: 'bob', avatar_url: 'https://avatars.githubusercontent.com/bob' },
      assignees: [{ login: 'alice', avatar_url: 'https://avatars.githubusercontent.com/alice' }],
      labels: [{ name: 'enhancement', color: '84b6eb' }],
    },
    {
      number: 18,
      title: 'Refactor database connection pooling',
      body: 'Current pool exhausts under load. Needs advanced connection management with retry logic and circuit breaker.',
      html_url: 'https://github.com/test-owner/test-repo/issues/18',
      updated_at: new Date().toISOString(),
      created_at: '2026-02-08T12:00:00.000Z',
      comments: 8,
      user: { login: 'charlie', avatar_url: 'https://avatars.githubusercontent.com/charlie' },
      assignees: [],
      labels: [],
    },
  ];
}

/** Dreyfus assessments for a Novice developer. */
function noviceDreyfus(): DreyfusAssessment[] {
  return [
    {
      id: 1,
      skill_area: 'TypeScript',
      stage: 'Novice',
      confidence: 0.7,
      evidence: 'Struggles with generics and type narrowing',
      assessed_at: '2026-02-10T12:00:00.000Z',
    },
    {
      id: 2,
      skill_area: 'Testing',
      stage: 'Advanced Beginner',
      confidence: 0.6,
      evidence: 'Can write basic unit tests but lacks integration test knowledge',
      assessed_at: '2026-02-10T12:00:00.000Z',
    },
  ];
}

// ── Test Suite: assembleAndStreamIssues ──────────────────────────────────────

describe('assembleAndStreamIssues (integration)', () => {
  let mockOctokit: ReturnType<typeof createMockOctokit>;

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    mockGetOctokit.mockReturnValue(mockOctokit as never);
    mockGetAuthenticatedUser.mockResolvedValue({
      login: 'alice',
      id: 1,
      avatarUrl: 'https://avatars.githubusercontent.com/alice',
      name: 'Alice',
    });
    mockGetDatabase.mockReturnValue(fakeDb);
    mockGetAllDreyfus.mockResolvedValue(noviceDreyfus());
    mockSummarizeIssue.mockResolvedValue({
      summary: 'Test summary',
      difficulty: 'medium',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ── Test 1: Fetches issues via Octokit ─────────────────────────────────────

  it('fetches issues via Octokit listForRepo', async () => {
    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: OWNER,
        repo: REPO,
        state: 'open',
      }),
    );
  });

  // ── Test 2: Streams individual issues to the client ────────────────────────

  it('streams individual issues to the client via sendToClient', async () => {
    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    // 3 issues + 1 completion message = 4 sendToClient calls
    expect(mockSendToClient).toHaveBeenCalledTimes(4);

    // First 3 calls should be dashboard:issue
    for (let i = 0; i < 3; i++) {
      const call = mockSendToClient.mock.calls[i]!;
      expect(call[0]).toBe(CONNECTION_ID);
      const msg = call[1] as DashboardSingleIssueMessage;
      expect(msg.type).toBe('dashboard:issue');
      expect(msg.data.issue).toBeDefined();
    }

    // Last call should be dashboard:issues_complete
    const lastCall = mockSendToClient.mock.calls[3]!;
    expect(lastCall[0]).toBe(CONNECTION_ID);
    expect((lastCall[1] as { type: string }).type).toBe('dashboard:issues_complete');
  });

  // ── Test 3: Issues include scoring and summary data ────────────────────────

  it('issues include scoring and summary data', async () => {
    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    const firstIssueCall = mockSendToClient.mock.calls[0]!;
    const msg = firstIssueCall[1] as DashboardSingleIssueMessage;
    const issue: ScoredIssuePayload = msg.data.issue;

    expect(typeof issue.score).toBe('number');
    expect(issue.summary).toBe('Test summary');
    expect(issue.difficulty).toBe('medium');
    expect(issue.htmlUrl).toContain('github.com');
    expect(issue.author).toBeDefined();
    expect(Array.isArray(issue.labels)).toBe(true);
  });

  // ── Test 4: Calls summarizeIssue for each issue ────────────────────────────

  it('calls summarizeIssue for each issue', async () => {
    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    expect(mockSummarizeIssue).toHaveBeenCalledTimes(3);
  });

  // ── Test 5: Sends completion even when no GitHub token ─────────────────────

  it('sends completion immediately when no GitHub token', async () => {
    mockGetOctokit.mockReturnValue(null);

    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    expect(mockSendToClient).toHaveBeenCalledTimes(1);
    expect((mockSendToClient.mock.calls[0]![1] as { type: string }).type).toBe(
      'dashboard:issues_complete',
    );
  });

  // ── Test 6: Sends completion when no open issues ───────────────────────────

  it('sends completion when no open issues', async () => {
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });

    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    expect(mockSendToClient).toHaveBeenCalledTimes(1);
    expect((mockSendToClient.mock.calls[0]![1] as { type: string }).type).toBe(
      'dashboard:issues_complete',
    );
    expect(mockSummarizeIssue).not.toHaveBeenCalled();
  });

  // ── Test 7: Filters out pull requests ──────────────────────────────────────

  it('filters out pull requests from the issue list', async () => {
    const issuesWithPR = [
      ...sampleGitHubIssues(),
      {
        number: 99,
        title: 'PR: Update deps',
        body: 'Updates all dependencies.',
        html_url: 'https://github.com/test-owner/test-repo/pull/99',
        updated_at: new Date().toISOString(),
        created_at: '2026-02-01T12:00:00.000Z',
        comments: 0,
        pull_request: { url: 'https://api.github.com/repos/test/test/pulls/99' },
        user: { login: 'bot', avatar_url: '' },
        assignees: [],
        labels: [],
      },
    ];
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: issuesWithPR });

    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    // 3 real issues + 1 completion = 4 calls (PR filtered out)
    expect(mockSendToClient).toHaveBeenCalledTimes(4);
    expect(mockSummarizeIssue).toHaveBeenCalledTimes(3);
  });

  // ── Test 8: Continues streaming when a single summarisation fails ──────────

  it('continues streaming when a single summarisation fails', async () => {
    mockSummarizeIssue
      .mockResolvedValueOnce({ summary: 'First', difficulty: 'low' })
      .mockRejectedValueOnce(new Error('Claude API rate limited'))
      .mockResolvedValueOnce({ summary: 'Third', difficulty: 'high' });

    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    // 2 successful issues + 1 completion = 3 calls (failed one skipped)
    expect(mockSendToClient).toHaveBeenCalledTimes(3);

    // Verify the completion message is always sent
    const lastCall = mockSendToClient.mock.calls[2]!;
    expect((lastCall[1] as { type: string }).type).toBe('dashboard:issues_complete');
  });

  // ── Test 9: Works when Dreyfus assessments are empty ───────────────────────

  it('works when Dreyfus assessments are empty', async () => {
    mockGetAllDreyfus.mockResolvedValue([]);

    await assembleAndStreamIssues(OWNER, REPO, CONNECTION_ID);

    // Should still stream all issues
    expect(mockSendToClient).toHaveBeenCalledTimes(4);
    expect(mockSummarizeIssue).toHaveBeenCalledTimes(3);
  });
});

// ── Test Suite: handleDashboardRefreshIssues ────────────────────────────────

describe('handleDashboardRefreshIssues (integration)', () => {
  let mockOctokit: ReturnType<typeof createMockOctokit>;

  beforeEach(() => {
    mockOctokit = createMockOctokit();
    mockGetOctokit.mockReturnValue(mockOctokit as never);
    mockGetAuthenticatedUser.mockResolvedValue({
      login: 'alice',
      id: 1,
      avatarUrl: 'https://avatars.githubusercontent.com/alice',
      name: 'Alice',
    });
    mockGetDatabase.mockReturnValue(fakeDb);
    mockGetAllDreyfus.mockResolvedValue(noviceDreyfus());
    mockSummarizeIssue.mockResolvedValue({
      summary: 'Test summary',
      difficulty: 'medium',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ── Test 10: Streams issues to specific client ────────────────────────────

  it('streams issues to specific client via sendToClient', async () => {
    await handleDashboardRefreshIssues(CONNECTION_ID, OWNER, REPO);

    // 3 issues + 1 completion = 4 calls
    expect(mockSendToClient).toHaveBeenCalledTimes(4);
    expect(mockSendToClient.mock.calls[0]![0]).toBe(CONNECTION_ID);
  });

  // ── Test 11: Sends completion on error ────────────────────────────────────

  it('does not crash on Octokit error', async () => {
    mockOctokit.rest.issues.listForRepo.mockRejectedValue(new Error('API error'));

    // Should not throw
    await handleDashboardRefreshIssues(CONNECTION_ID, OWNER, REPO);
  });
});
