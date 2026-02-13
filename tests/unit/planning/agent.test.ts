import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPlanningAgent, type PlanningCallbacks } from '../../../src/planning/agent.js';
import type { AgentPlanOutput } from '../../../src/planning/parser.js';
import type { IssueInput } from '../../../src/planning/prompts.js';

// Mock the Agent SDK — the entire module is replaced with a mock factory.
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
const mockQuery = vi.mocked(query);

const VALID_PLAN: AgentPlanOutput = {
  title: 'Test Plan',
  summary: 'A test implementation plan',
  relevant_files: ['src/index.ts'],
  phases: [
    {
      number: 1,
      title: 'Phase 1',
      description: 'Do the thing',
      hint: 'Start here',
      tasks: [
        {
          title: 'Task 1',
          description: 'First task',
          target_files: ['src/index.ts'],
          hints: {
            low: 'Look at the file',
            medium: 'Look at src/index.ts for the main export',
            high: 'Edit src/index.ts line 5 to add the new function',
          },
        },
      ],
    },
  ],
};

const VALID_PLAN_JSON = JSON.stringify(VALID_PLAN);

const DEFAULT_ISSUE: IssueInput = {
  title: 'Test issue',
  body: 'Test body content',
  number: 42,
  labels: ['enhancement'],
  url: 'https://github.com/org/repo/issues/42',
};

/**
 * Helper: creates a mock async generator from an array of messages.
 * The SDK's `query()` returns an AsyncGenerator<SDKMessage, void>, so
 * we simulate it with an async generator function.
 */
function mockAsyncGenerator(messages: unknown[]): ReturnType<typeof query> {
  const gen = (async function* () {
    for (const msg of messages) {
      yield msg;
    }
  })();
  // The real Query interface extends AsyncGenerator and adds extra methods.
  // For testing purposes we only need the iterable behavior.
  return gen as ReturnType<typeof query>;
}

describe('runPlanningAgent', () => {
  let callbacks: PlanningCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = {
      onProgress: vi.fn(),
      onPhaseUpdate: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };
  });

  it('streams progress events for tool_use content blocks', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: '/repo/package.json' },
            },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        result: '```json\n' + VALID_PLAN_JSON + '\n```',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValue(mockAsyncGenerator(messages));

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'Read',
        filePath: '/repo/package.json',
      }),
    );
  });

  it('calls onComplete with parsed plan on successful result', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      {
        type: 'result',
        subtype: 'success',
        result: '```json\n' + VALID_PLAN_JSON + '\n```',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValue(mockAsyncGenerator(messages));

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    expect(callbacks.onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Plan', summary: 'A test implementation plan' }),
    );
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('calls onError when agent result contains no valid JSON', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      {
        type: 'result',
        subtype: 'success',
        result: 'I could not generate a plan, sorry.',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValue(mockAsyncGenerator(messages));

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('No valid JSON'));
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it('calls onError when the SDK throws an exception', async () => {
    mockQuery.mockReturnValue(
      (async function* () {
        throw new Error('API key expired');
      })() as unknown as ReturnType<typeof query>,
    );

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining('API key expired'),
    );
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it('calls onError when agent returns empty result', async () => {
    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      {
        type: 'result',
        subtype: 'success',
        result: '',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValue(mockAsyncGenerator(messages));

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it('updates phase progress as tool use count increases', async () => {
    // Simulate multiple tool uses to trigger phase transitions
    const toolMessages = Array.from({ length: 10 }, (_, i) => ({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: `tool-${i}`,
            name: 'Glob',
            input: { pattern: `src/**/*.ts` },
          },
        ],
      },
    }));

    const messages = [
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      ...toolMessages,
      {
        type: 'result',
        subtype: 'success',
        result: '```json\n' + VALID_PLAN_JSON + '\n```',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValue(mockAsyncGenerator(messages));

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    // onPhaseUpdate should have been called with 'exploring' initially,
    // then again with higher progress values as tools are used.
    expect(callbacks.onPhaseUpdate).toHaveBeenCalledWith('exploring', 0);
    expect(callbacks.onPhaseUpdate).toHaveBeenCalledWith('exploring', 25);
    expect(callbacks.onPhaseUpdate).toHaveBeenCalledWith('exploring', 50);
    expect(callbacks.onPhaseUpdate).toHaveBeenCalledWith('planning', 75);
  });

  it('describes Grep tool use with search pattern', async () => {
    const messages = [
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Grep',
              input: { pattern: 'TODO', path: '/repo' },
            },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        result: '```json\n' + VALID_PLAN_JSON + '\n```',
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValue(mockAsyncGenerator(messages));

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'Grep',
        message: expect.stringContaining('TODO'),
      }),
    );
  });

  it('handles result error subtype from agent', async () => {
    const messages = [
      {
        type: 'result',
        subtype: 'error_during_execution',
        errors: ['Something went wrong'],
        session_id: 'sess-1',
      },
    ];

    mockQuery.mockReturnValue(mockAsyncGenerator(messages));

    await runPlanningAgent({
      issue: DEFAULT_ISSUE,
      repoPath: '/tmp/repo',
      callbacks,
    });

    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining('Something went wrong'),
    );
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });
});
