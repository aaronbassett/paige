import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateNudge } from '../../../src/planning/nudge-agent.js';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
const mockQuery = vi.mocked(query);

describe('generateNudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns nudge message from agent result', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      { type: 'result', subtype: 'success', result: 'It looks like you might be stuck on the JWT middleware. Try looking at how the existing auth.ts file handles token parsing.' },
    ];

    mockQuery.mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
    })() as any);

    const nudge = await generateNudge({
      sessionContext: 'User is working on auth middleware, idle for 3 minutes',
      currentPhase: 'Implement JWT validation',
      currentFile: 'src/auth/middleware.ts',
      repoPath: '/tmp/repo',
    });

    expect(nudge).toContain('JWT');
  });

  it('returns null when agent fails', async () => {
    mockQuery.mockReturnValue((async function* () {
      throw new Error('API error');
    })() as any);

    const nudge = await generateNudge({
      sessionContext: 'test',
      currentPhase: 'test',
      currentFile: null,
      repoPath: '/tmp/repo',
    });

    expect(nudge).toBeNull();
  });

  it('returns null when agent returns empty result', async () => {
    const messages = [
      { type: 'result', subtype: 'success', result: '' },
    ];

    mockQuery.mockReturnValue((async function* () {
      for (const msg of messages) yield msg;
    })() as any);

    const nudge = await generateNudge({
      sessionContext: 'test',
      currentPhase: 'test',
      currentFile: null,
      repoPath: '/tmp/repo',
    });

    expect(nudge).toBeNull();
  });
});
