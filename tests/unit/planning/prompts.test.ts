import { describe, it, expect } from 'vitest';
import { buildPlanningPrompt, PLANNING_SYSTEM_PROMPT } from '../../../src/planning/prompts.js';

describe('buildPlanningPrompt', () => {
  it('includes issue title and body', () => {
    const prompt = buildPlanningPrompt({
      title: 'Add dark mode',
      body: 'Users want dark mode support',
      number: 42,
      labels: ['enhancement'],
      url: 'https://github.com/org/repo/issues/42',
    });
    expect(prompt).toContain('Add dark mode');
    expect(prompt).toContain('Users want dark mode support');
    expect(prompt).toContain('#42');
  });

  it('includes labels', () => {
    const prompt = buildPlanningPrompt({
      title: 'Fix bug',
      body: 'Something broken',
      number: 1,
      labels: ['bug', 'priority-high'],
      url: 'https://github.com/org/repo/issues/1',
    });
    expect(prompt).toContain('bug');
    expect(prompt).toContain('priority-high');
  });

  it('handles empty labels gracefully', () => {
    const prompt = buildPlanningPrompt({
      title: 'No labels issue',
      body: 'Body text',
      number: 99,
      labels: [],
      url: 'https://github.com/org/repo/issues/99',
    });
    expect(prompt).toContain('none');
    expect(prompt).toContain('#99');
  });

  it('includes the issue URL', () => {
    const prompt = buildPlanningPrompt({
      title: 'Test',
      body: 'Body',
      number: 7,
      labels: [],
      url: 'https://github.com/org/repo/issues/7',
    });
    expect(prompt).toContain('https://github.com/org/repo/issues/7');
  });
});

describe('PLANNING_SYSTEM_PROMPT', () => {
  it('instructs JSON output', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('JSON');
  });

  it('describes the output schema fields', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('phases');
    expect(PLANNING_SYSTEM_PROMPT).toContain('hints');
    expect(PLANNING_SYSTEM_PROMPT).toContain('relevant_files');
  });

  it('describes hint detail levels', () => {
    expect(PLANNING_SYSTEM_PROMPT).toContain('low');
    expect(PLANNING_SYSTEM_PROMPT).toContain('medium');
    expect(PLANNING_SYSTEM_PROMPT).toContain('high');
  });
});
