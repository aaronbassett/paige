import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../../../src/websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../../../src/planning/nudge-agent.js', () => ({
  generateNudge: vi.fn(),
}));

import { broadcast } from '../../../src/websocket/server.js';
import { generateNudge } from '../../../src/planning/nudge-agent.js';
import { deliverNudge, broadcastObserverStatus } from '../../../src/observer/nudge.js';

const mockBroadcast = vi.mocked(broadcast);
const mockGenerateNudge = vi.mocked(generateNudge);

describe('deliverNudge', () => {
  const basePayload = {
    signal: 'stuck_on_implementation',
    confidence: 0.85,
    context: 'Developer has been idle for 3 minutes on auth module',
    phase: 'Implement JWT validation',
    currentFile: 'src/auth/middleware.ts',
    repoPath: '/tmp/test-repo',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers AI-generated nudge when available', async () => {
    const agentMessage =
      'It looks like you might be stuck on the middleware. Try checking how auth.ts handles token parsing.';
    mockGenerateNudge.mockResolvedValue(agentMessage);

    await deliverNudge(basePayload);

    // The nudge agent should have been called with the payload fields
    expect(mockGenerateNudge).toHaveBeenCalledWith({
      sessionContext: basePayload.context,
      currentPhase: basePayload.phase,
      currentFile: basePayload.currentFile,
      repoPath: basePayload.repoPath,
    });

    // The broadcast should use the agent-generated message, not the raw context
    expect(mockBroadcast).toHaveBeenCalledWith({
      type: 'observer:nudge',
      data: {
        signal: basePayload.signal,
        confidence: basePayload.confidence,
        context: agentMessage,
      },
    });
  });

  it('falls back to signal-based nudge when agent returns null', async () => {
    mockGenerateNudge.mockResolvedValue(null);

    await deliverNudge(basePayload);

    expect(mockGenerateNudge).toHaveBeenCalledOnce();

    // Should broadcast the raw triage context as fallback
    expect(mockBroadcast).toHaveBeenCalledWith({
      type: 'observer:nudge',
      data: {
        signal: basePayload.signal,
        confidence: basePayload.confidence,
        context: basePayload.context,
      },
    });
  });

  it('falls back to signal-based nudge when agent throws', async () => {
    mockGenerateNudge.mockRejectedValue(new Error('Agent SDK unavailable'));

    await deliverNudge(basePayload);

    // Should still broadcast with the raw context
    expect(mockBroadcast).toHaveBeenCalledWith({
      type: 'observer:nudge',
      data: {
        signal: basePayload.signal,
        confidence: basePayload.confidence,
        context: basePayload.context,
      },
    });
  });
});

describe('broadcastObserverStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcasts observer status unchanged', () => {
    broadcastObserverStatus(true, false);

    expect(mockBroadcast).toHaveBeenCalledWith({
      type: 'observer:status',
      data: { active: true, muted: false },
    });
  });

  it('broadcasts muted status', () => {
    broadcastObserverStatus(true, true);

    expect(mockBroadcast).toHaveBeenCalledWith({
      type: 'observer:status',
      data: { active: true, muted: true },
    });
  });

  it('broadcasts inactive status', () => {
    broadcastObserverStatus(false, false);

    expect(mockBroadcast).toHaveBeenCalledWith({
      type: 'observer:status',
      data: { active: false, muted: false },
    });
  });
});
