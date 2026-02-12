// Integration test for Dashboard Issues flow (Flow 2 - GitHub issues with suitability assessment)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DreyfusAssessment } from '../../src/types/domain.js';

// ── Mock external dependencies ──────────────────────────────────────────────
//
// assembleIssues calls:
//   - child_process execSync (gh CLI for issue listing)
//   - callApi (Haiku for suitability assessment)
//   - getDatabase (DB handle)
//   - getAllDreyfus (Dreyfus context for suitability prompt)
//   - logAction (action logging)
//
// handleDashboardRefreshIssues additionally calls:
//   - getActiveSessionId (current MCP session)
//   - broadcast (WebSocket push to Electron)

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../src/api-client/claude.js', () => ({
  callApi: vi.fn(),
}));

vi.mock('../../src/database/db.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../src/database/queries/dreyfus.js', () => ({
  getAllDreyfus: vi.fn(),
}));

vi.mock('../../src/websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../../src/logger/action-log.js', () => ({
  logAction: vi.fn(),
}));

vi.mock('../../src/mcp/session.js', () => ({
  getActiveSessionId: vi.fn(),
}));

// ── Import modules under test AFTER mocking ────────────────────────────────

import { execSync } from 'node:child_process';
import { callApi } from '../../src/api-client/claude.js';
import { getDatabase, type AppDatabase } from '../../src/database/db.js';
import { getAllDreyfus } from '../../src/database/queries/dreyfus.js';
import { broadcast } from '../../src/websocket/server.js';
import { logAction } from '../../src/logger/action-log.js';
import { getActiveSessionId } from '../../src/mcp/session.js';
import { assembleIssues } from '../../src/dashboard/flows/issues.js';
import { handleDashboardRefreshIssues } from '../../src/dashboard/handler.js';

// ── Type-safe mock references ──────────────────────────────────────────────

const mockExecSync = vi.mocked(execSync);
const mockCallApi = vi.mocked(callApi);
const mockGetDatabase = vi.mocked(getDatabase);
const mockGetAllDreyfus = vi.mocked(getAllDreyfus);
const mockBroadcast = vi.mocked(broadcast);
const mockLogAction = vi.mocked(logAction);
const mockGetActiveSessionId = vi.mocked(getActiveSessionId);

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Sentinel database object -- mocked, never used for real queries. */
const fakeDb = {} as AppDatabase;

/** Default session ID for all tests. */
const SESSION_ID = 42;

/** Sample GitHub issues as returned by `gh issue list --json`. */
function sampleGitHubIssues() {
  return [
    {
      number: 12,
      title: 'Fix login form validation',
      body: 'The login form accepts empty passwords. Need to add client-side validation.',
      labels: [{ name: 'bug' }, { name: 'good first issue' }],
    },
    {
      number: 15,
      title: 'Add dark mode support',
      body: 'Implement dark mode toggle in settings panel using CSS variables.',
      labels: [{ name: 'enhancement' }],
    },
    {
      number: 18,
      title: 'Refactor database connection pooling',
      body: 'Current pool exhausts under load. Needs advanced connection management with retry logic.',
      labels: [],
    },
  ];
}

/** Returns the JSON string that `gh issue list` would output. */
function ghIssueListOutput() {
  return JSON.stringify(sampleGitHubIssues());
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

/** Haiku API response matching the issueSuitabilitySchema. */
function suitabilityApiResponse() {
  return {
    assessments: [
      {
        issue_number: 12,
        suitability: 'excellent' as const,
        recommended_focus: 'Learn form validation patterns and input sanitization',
        confidence: 0.9,
      },
      {
        issue_number: 15,
        suitability: 'good' as const,
        recommended_focus: 'Practice CSS variables and theme toggling',
        confidence: 0.8,
      },
      {
        issue_number: 18,
        suitability: 'poor' as const,
        recommended_focus: 'Too advanced for current skill level',
        confidence: 0.85,
      },
    ],
  };
}

// ── Test Suite: assembleIssues ──────────────────────────────────────────────

describe('assembleIssues (integration)', () => {
  beforeEach(() => {
    mockGetDatabase.mockReturnValue(fakeDb);
    mockGetAllDreyfus.mockResolvedValue(noviceDreyfus());
    mockExecSync.mockReturnValue(Buffer.from(ghIssueListOutput()));
    mockCallApi.mockResolvedValue(suitabilityApiResponse());
    mockLogAction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockExecSync.mockReset();
    mockCallApi.mockReset();
    mockGetDatabase.mockReset();
    mockGetAllDreyfus.mockReset();
    mockLogAction.mockReset();
  });

  // ── Test 1: Fetches GitHub issues via gh CLI ────────────────────────────────

  it('fetches GitHub issues via gh issue list CLI command', async () => {
    await assembleIssues(SESSION_ID);

    expect(mockExecSync).toHaveBeenCalledTimes(1);
    const execCall = mockExecSync.mock.calls[0]!;
    const command = String(execCall[0]);
    expect(command).toContain('gh');
    expect(command).toContain('issue');
    expect(command).toContain('list');
    expect(command).toContain('--json');
  });

  // ── Test 2: Calls Haiku with suitability schema and Dreyfus context ─────────

  it('calls Haiku with issue suitability schema and Dreyfus context', async () => {
    await assembleIssues(SESSION_ID);

    expect(mockCallApi).toHaveBeenCalledTimes(1);

    const callOptions = mockCallApi.mock.calls[0]![0];
    expect(callOptions.callType).toBe('issue_suitability');
    expect(callOptions.model).toBe('haiku');
    expect(callOptions.sessionId).toBe(SESSION_ID);

    // Dreyfus context should be included in the prompt
    const combined = (callOptions.systemPrompt + ' ' + callOptions.userMessage).toLowerCase();
    expect(
      combined.includes('novice') || combined.includes('dreyfus') || combined.includes('skill'),
    ).toBe(true);
  });

  // ── Test 3: Returns issues with suitability ratings ─────────────────────────

  it('returns issues with suitability ratings', async () => {
    const result = await assembleIssues(SESSION_ID);

    expect(result.issues).toHaveLength(3);

    const excellent = result.issues.find((i) => i.number === 12);
    expect(excellent).toBeDefined();
    expect(excellent!.suitability).toBe('excellent');

    const good = result.issues.find((i) => i.number === 15);
    expect(good).toBeDefined();
    expect(good!.suitability).toBe('good');

    const poor = result.issues.find((i) => i.number === 18);
    expect(poor).toBeDefined();
    expect(poor!.suitability).toBe('poor');
  });

  // ── Test 4: Returns recommended_focus for each issue ────────────────────────

  it('returns recommended_focus for each issue', async () => {
    const result = await assembleIssues(SESSION_ID);

    for (const issue of result.issues) {
      expect(issue.recommended_focus).toBeTruthy();
      expect(typeof issue.recommended_focus).toBe('string');
    }

    const issue12 = result.issues.find((i) => i.number === 12);
    expect(issue12!.recommended_focus).toContain('validation');
  });

  // ── Test 5: Handles GitHub CLI failure gracefully ───────────────────────────

  it('handles GitHub CLI failure gracefully (throws error)', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('gh: command not found');
    });

    await expect(assembleIssues(SESSION_ID)).rejects.toThrow();
  });

  // ── Test 6: Handles no open issues ──────────────────────────────────────────

  it('handles no open issues (returns empty array)', async () => {
    mockExecSync.mockReturnValue(Buffer.from(JSON.stringify([])));

    const result = await assembleIssues(SESSION_ID);

    expect(result.issues).toHaveLength(0);
    // Should not call Haiku when there are no issues to assess
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  // ── Test 7: Handles Haiku API failure gracefully ────────────────────────────

  it('handles Haiku API failure gracefully', async () => {
    mockCallApi.mockRejectedValue(new Error('Claude API rate limited'));

    await expect(assembleIssues(SESSION_ID)).rejects.toThrow();
  });

  // ── Test 8: Works when ChromaDB unavailable (empty Dreyfus) ─────────────────

  it('works when Dreyfus assessments are empty', async () => {
    mockGetAllDreyfus.mockResolvedValue([]);

    const result = await assembleIssues(SESSION_ID);

    // Should still return valid results even without Dreyfus data
    expect(result).toBeDefined();
    expect(result.issues).toHaveLength(3);
    expect(mockCallApi).toHaveBeenCalledTimes(1);
  });

  // ── Test 9: Passes issue labels through to response ─────────────────────────

  it('passes issue labels through to response', async () => {
    const result = await assembleIssues(SESSION_ID);

    const issue12 = result.issues.find((i) => i.number === 12);
    expect(issue12).toBeDefined();
    expect(issue12!.labels).toEqual(['bug', 'good first issue']);

    const issue15 = result.issues.find((i) => i.number === 15);
    expect(issue15).toBeDefined();
    expect(issue15!.labels).toEqual(['enhancement']);

    const issue18 = result.issues.find((i) => i.number === 18);
    expect(issue18).toBeDefined();
    expect(issue18!.labels).toEqual([]);
  });
});

// ── Test Suite: handleDashboardRefreshIssues ────────────────────────────────

describe('handleDashboardRefreshIssues (integration)', () => {
  beforeEach(() => {
    mockGetDatabase.mockReturnValue(fakeDb);
    mockGetActiveSessionId.mockReturnValue(SESSION_ID);
    mockGetAllDreyfus.mockResolvedValue(noviceDreyfus());
    mockExecSync.mockReturnValue(Buffer.from(ghIssueListOutput()));
    mockCallApi.mockResolvedValue(suitabilityApiResponse());
    mockLogAction.mockResolvedValue(undefined);
    mockBroadcast.mockReturnValue(undefined);
  });

  afterEach(() => {
    mockExecSync.mockReset();
    mockCallApi.mockReset();
    mockGetDatabase.mockReset();
    mockGetAllDreyfus.mockReset();
    mockBroadcast.mockReset();
    mockLogAction.mockReset();
    mockGetActiveSessionId.mockReset();
  });

  // ── Test 10: Re-runs issues flow only ────────────────────────────────────────

  it('re-runs issues flow only (calls assembleIssues)', async () => {
    await handleDashboardRefreshIssues();

    // Should have fetched issues via gh CLI
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    // Should have called Haiku for suitability
    expect(mockCallApi).toHaveBeenCalledTimes(1);
    expect(mockCallApi).toHaveBeenCalledWith(
      expect.objectContaining({
        callType: 'issue_suitability',
      }),
    );
  });

  // ── Test 11: Broadcasts dashboard:issues on success ──────────────────────────

  it('broadcasts dashboard:issues on success', async () => {
    await handleDashboardRefreshIssues();

    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    const broadcastArg = mockBroadcast.mock.calls[0]![0] as {
      type: string;
      data: { issues: unknown[] };
    };
    expect(broadcastArg.type).toBe('dashboard:issues');
    expect(Array.isArray(broadcastArg.data.issues)).toBe(true);
    expect(broadcastArg.data.issues.length).toBe(3);
  });

  // ── Test 12: Broadcasts dashboard:issues_error on failure ────────────────────

  it('broadcasts dashboard:issues_error on failure', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('gh: not authenticated');
    });

    await handleDashboardRefreshIssues();

    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    const broadcastArg = mockBroadcast.mock.calls[0]![0] as {
      type: string;
      data: { error: string };
    };
    expect(broadcastArg.type).toBe('dashboard:issues_error');
    expect(typeof broadcastArg.data.error).toBe('string');
    expect(broadcastArg.data.error.length).toBeGreaterThan(0);
  });
});
