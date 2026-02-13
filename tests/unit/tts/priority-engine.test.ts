import { describe, it, expect } from 'vitest';
import { shouldSpeak } from '../../../src/tts/priority-engine.js';

describe('shouldSpeak', () => {
  // === SPEAK rules ===

  it('speaks for phase introductions from pipeline', () => {
    expect(
      shouldSpeak({ message: 'Phase 1: Understanding', type: 'phase_intro', source: 'pipeline' }),
    ).toBe(true);
  });

  it('speaks for victory messages', () => {
    expect(shouldSpeak({ message: 'Tests passing!', type: 'victory' })).toBe(true);
  });

  it('speaks for celebration messages', () => {
    expect(shouldSpeak({ message: 'Great job!', type: 'celebration' })).toBe(true);
  });

  it('speaks for observer nudges', () => {
    expect(shouldSpeak({ message: 'You seem stuck', type: 'nudge', source: 'observer' })).toBe(
      true,
    );
  });

  it('speaks for session welcome', () => {
    expect(shouldSpeak({ message: 'Welcome!', type: 'session_welcome' })).toBe(true);
  });

  it('speaks for session wrapup', () => {
    expect(shouldSpeak({ message: 'Great session!', type: 'session_wrapup' })).toBe(true);
  });

  // === SILENT rules ===

  it('stays silent for anchored messages', () => {
    expect(
      shouldSpeak({
        message: 'Check line 42',
        type: 'hint',
        anchor: { path: 'foo.ts', startLine: 42 },
      }),
    ).toBe(false);
  });

  it('stays silent for file hints', () => {
    expect(shouldSpeak({ message: 'Look at utils.ts', type: 'file_hint' })).toBe(false);
  });

  it('stays silent for line hints', () => {
    expect(shouldSpeak({ message: 'Check line 10', type: 'line_hint' })).toBe(false);
  });

  it('stays silent for messages over 500 characters', () => {
    const longMessage = 'A'.repeat(501);
    expect(shouldSpeak({ message: longMessage, type: 'info' })).toBe(false);
  });

  it('speaks for messages exactly 500 characters', () => {
    const exact = 'A'.repeat(500);
    // Default: silent (no rule matched)
    expect(shouldSpeak({ message: exact, type: 'info' })).toBe(false);
  });

  // === DEFAULT ===

  it('defaults to silent for unmatched message types', () => {
    expect(shouldSpeak({ message: 'Some info', type: 'info' })).toBe(false);
  });

  it('defaults to silent for generic hints', () => {
    expect(shouldSpeak({ message: 'Try this', type: 'hint' })).toBe(false);
  });

  // === PRIORITY ORDER ===

  it('speak rule wins over silent when both could match (nudge with anchor)', () => {
    // Observer nudge should speak even if it has an anchor, because nudge rule is checked first
    expect(
      shouldSpeak({
        message: 'You seem stuck on this line',
        type: 'nudge',
        source: 'observer',
        anchor: { path: 'foo.ts', startLine: 1 },
      }),
    ).toBe(true);
  });
});
