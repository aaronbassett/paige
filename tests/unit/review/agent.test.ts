// Unit tests for the review agent multi-turn loop.
// Mocks the Anthropic SDK client and tool executor to test the agent logic in isolation.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────

// Mock the tool executor so we never touch the file system
const mockExecuteReviewTool = vi.fn().mockResolvedValue('file contents here');

vi.mock('../../../src/review/tools.js', () => ({
  reviewTools: [
    {
      name: 'read_file',
      description: 'Read file',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  ],
  executeReviewTool: (...args: unknown[]): Promise<string> =>
    mockExecuteReviewTool(...args) as Promise<string>,
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { runReviewAgent, _setClient } from '../../../src/review/agent.js';

// ── Test Setup ──────────────────────────────────────────────────────────────

/** The mock for `client.messages.create`. Set up fresh in beforeEach. */
let mockCreate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate = vi.fn();
  // Inject a mock Anthropic client via the test helper
  _setClient({ messages: { create: mockCreate } } as never);
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('runReviewAgent', () => {
  it('returns a parsed ReviewResult from a direct text response', async () => {
    const reviewJson = JSON.stringify({
      overallFeedback: 'Good work!',
      codeComments: [
        {
          filePath: 'src/main.ts',
          startLine: 10,
          endLine: 12,
          comment: 'Nice error handling',
          severity: 'praise',
        },
      ],
      phaseComplete: true,
    });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: reviewJson }],
    });

    const result = await runReviewAgent({
      scope: 'phase',
      projectDir: '/test',
      phaseTitle: 'Implement',
    });

    expect(result.overallFeedback).toBe('Good work!');
    expect(result.codeComments).toHaveLength(1);
    expect(result.codeComments[0]?.severity).toBe('praise');
    expect(result.phaseComplete).toBe(true);

    // Verify the API was called with correct parameters
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('coaching-oriented') as string,
        tools: expect.any(Array) as unknown[],
        messages: expect.arrayContaining([expect.objectContaining({ role: 'user' })]) as unknown[],
      }),
    );
  });

  it('executes tool calls and continues the loop', async () => {
    // Turn 1: model requests a tool call
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'read_file',
          input: { path: 'src/main.ts' },
        },
      ],
    });

    // Turn 2: model produces final text response
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            overallFeedback: 'Reviewed after reading files',
            codeComments: [],
          }),
        },
      ],
    });

    const result = await runReviewAgent({
      scope: 'current_file',
      projectDir: '/test',
      activeFilePath: 'src/main.ts',
    });

    // Agent should have made two API calls (one tool use, one final)
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Tool executor should have been called once
    expect(mockExecuteReviewTool).toHaveBeenCalledTimes(1);
    expect(mockExecuteReviewTool).toHaveBeenCalledWith(
      'read_file',
      { path: 'src/main.ts' },
      '/test',
    );

    // Final result should be parsed correctly
    expect(result.overallFeedback).toBe('Reviewed after reading files');
    expect(result.codeComments).toHaveLength(0);
  });

  it('handles multiple tool calls in a single turn', async () => {
    // Turn 1: model requests two tool calls at once
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'read_file',
          input: { path: 'src/a.ts' },
        },
        {
          type: 'tool_use',
          id: 'tool-2',
          name: 'read_file',
          input: { path: 'src/b.ts' },
        },
      ],
    });

    // Turn 2: final response
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            overallFeedback: 'Both files look good',
            codeComments: [],
          }),
        },
      ],
    });

    const result = await runReviewAgent({
      scope: 'open_files',
      projectDir: '/test',
      openFilePaths: ['src/a.ts', 'src/b.ts'],
    });

    // Tool executor called for each tool use block
    expect(mockExecuteReviewTool).toHaveBeenCalledTimes(2);
    expect(result.overallFeedback).toBe('Both files look good');

    // Second API call should include tool results
    const secondCallArgs = mockCreate.mock.calls[1]?.[0] as { messages: unknown[] } | undefined;
    expect(secondCallArgs?.messages).toHaveLength(3); // user prompt + assistant + tool results
  });

  it('returns fallback result when no JSON is found in response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'I could not produce a structured review right now.',
        },
      ],
    });

    const result = await runReviewAgent({
      scope: 'current_task',
      projectDir: '/test',
    });

    expect(result.overallFeedback).toBe('I could not produce a structured review right now.');
    expect(result.codeComments).toHaveLength(0);
  });

  it('returns fallback when response has no text block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [],
    });

    const result = await runReviewAgent({
      scope: 'phase',
      projectDir: '/test',
    });

    expect(result.overallFeedback).toBe('Review completed but no structured output was produced.');
    expect(result.codeComments).toHaveLength(0);
  });

  it('throws when maximum turns are exceeded', async () => {
    // Every turn returns a tool use, never a final text response
    for (let i = 0; i < 20; i++) {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: `tool-${i}`,
            name: 'read_file',
            input: { path: `file-${i}.ts` },
          },
        ],
      });
    }

    await expect(runReviewAgent({ scope: 'phase', projectDir: '/test' })).rejects.toThrow(
      'Review agent exceeded maximum turns',
    );

    expect(mockCreate).toHaveBeenCalledTimes(20);
  });

  it('parses JSON wrapped in markdown code fences', async () => {
    const reviewJson = JSON.stringify({
      overallFeedback: 'Wrapped in fences',
      codeComments: [],
      phaseComplete: false,
    });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: `Here is my review:\n\`\`\`json\n${reviewJson}\n\`\`\``,
        },
      ],
    });

    const result = await runReviewAgent({
      scope: 'phase',
      projectDir: '/test',
    });

    expect(result.overallFeedback).toBe('Wrapped in fences');
    expect(result.phaseComplete).toBe(false);
  });

  it('includes task information in the prompt when tasks are provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            overallFeedback: 'Task review',
            codeComments: [],
            taskFeedback: [
              { taskTitle: 'Add tests', feedback: 'Tests look solid', taskComplete: true },
            ],
          }),
        },
      ],
    });

    const result = await runReviewAgent({
      scope: 'phase',
      projectDir: '/test',
      phaseTitle: 'Testing',
      tasks: [{ title: 'Add tests', description: 'Write unit tests for the module' }],
    });

    // Verify the user message includes task information
    const firstCallArgs = mockCreate.mock.calls[0]?.[0] as
      | { messages: Array<{ content: string }> }
      | undefined;
    const userMessage = firstCallArgs?.messages?.[0]?.content;
    expect(userMessage).toContain('Add tests');
    expect(userMessage).toContain('Write unit tests for the module');

    // Verify task feedback is parsed
    expect(result.taskFeedback).toHaveLength(1);
    expect(result.taskFeedback?.[0]?.taskComplete).toBe(true);
  });
});
