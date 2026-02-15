import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/database/db.js', () => ({
  getDatabase: vi.fn(),
}));
vi.mock('../../src/database/queries/katas.js', () => ({
  getKataById: vi.fn(),
}));
vi.mock('../../src/websocket/server.js', () => ({
  broadcast: vi.fn(),
}));
vi.mock('../../src/mcp/session.js', () => ({
  getActiveSessionId: vi.fn(() => 1),
}));

import { getDatabase } from '../../src/database/db.js';
import { getKataById } from '../../src/database/queries/katas.js';
import { broadcast } from '../../src/websocket/server.js';
import { handleChallengeLoad } from '../../src/websocket/handlers/challenge.js';

describe('handleChallengeLoad', () => {
  const mockWs = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockReturnValue({} as never);
  });

  it('broadcasts challenge:loaded with kata data on success', async () => {
    vi.mocked(getKataById).mockResolvedValue({
      id: 1,
      gap_id: 1,
      title: 'FizzBuzz',
      description: 'Write a FizzBuzz function',
      scaffolding_code: 'function fizzbuzz(n) {}',
      instructor_notes: '',
      constraints: JSON.stringify([
        { id: 'perf', description: 'Must run in O(n)', minLevel: 3 },
        { id: 'no-if', description: 'No if statements', minLevel: 5 },
      ]),
      user_attempts: '[]',
      created_at: '2026-01-01T00:00:00Z',
    });

    await handleChallengeLoad(mockWs, { kataId: 1 }, 'conn-1');

    expect(broadcast).toHaveBeenCalledWith({
      type: 'challenge:loaded',
      data: {
        kataId: 1,
        title: 'FizzBuzz',
        description: 'Write a FizzBuzz function',
        scaffoldingCode: 'function fizzbuzz(n) {}',
        constraints: [
          { id: 'perf', description: 'Must run in O(n)' },
          { id: 'no-if', description: 'No if statements' },
        ],
      },
    });
  });

  it('broadcasts challenge:load_error when kata not found', async () => {
    vi.mocked(getKataById).mockResolvedValue(null);

    await handleChallengeLoad(mockWs, { kataId: 999 }, 'conn-1');

    expect(broadcast).toHaveBeenCalledWith({
      type: 'challenge:load_error',
      data: { error: 'Kata not found (id=999)' },
    });
  });
});
