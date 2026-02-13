import { describe, it, expect } from 'vitest';
import { parsePlanOutput, type AgentPlanOutput } from '../../../src/planning/parser.js';

const VALID_PLAN: AgentPlanOutput = {
  title: 'Add user authentication',
  summary: 'Implement JWT-based auth with login/register endpoints',
  relevant_files: ['src/auth/middleware.ts', 'src/routes/auth.ts'],
  phases: [
    {
      number: 1,
      title: 'Set up auth middleware',
      description: 'Create Express middleware for JWT validation',
      hint: 'Start with the middleware pattern used in other routes',
      tasks: [
        {
          title: 'Create JWT validation function',
          description: 'Parse and validate JWT tokens from Authorization header',
          target_files: ['src/auth/middleware.ts'],
          hints: {
            low: 'Look at how the existing middleware handles headers',
            medium: 'Use jsonwebtoken library to verify the token, check the Authorization header format',
            high: 'Import jwt from jsonwebtoken, extract token from "Bearer <token>" header, call jwt.verify(token, process.env.JWT_SECRET)',
          },
        },
      ],
    },
  ],
};

describe('parsePlanOutput', () => {
  it('parses valid JSON plan from agent result text', () => {
    const text = `Here is the plan:\n\`\`\`json\n${JSON.stringify(VALID_PLAN)}\n\`\`\``;
    const result = parsePlanOutput(text);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Add user authentication');
      expect(result.data.phases).toHaveLength(1);
      const firstPhase = result.data.phases[0];
      expect(firstPhase).toBeDefined();
      const firstTask = firstPhase?.tasks[0];
      expect(firstTask).toBeDefined();
      expect(firstTask?.hints.low).toContain('middleware');
    }
  });

  it('parses raw JSON without code fences', () => {
    const text = JSON.stringify(VALID_PLAN);
    const result = parsePlanOutput(text);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid JSON', () => {
    const result = parsePlanOutput('not json at all');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('No valid JSON');
    }
  });

  it('returns error for JSON missing required fields', () => {
    const result = parsePlanOutput(JSON.stringify({ title: 'incomplete' }));
    expect(result.success).toBe(false);
  });

  it('returns error for empty phases array', () => {
    const plan = { ...VALID_PLAN, phases: [] };
    const result = parsePlanOutput(JSON.stringify(plan));
    expect(result.success).toBe(false);
  });
});
