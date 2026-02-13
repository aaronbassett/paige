import type { PriorityRule, SpeakableMessage } from './tts-types.js';

/**
 * Ordered rules for deciding whether a coaching message should be spoken.
 * First match wins. If no rule matches, default is 'silent'.
 */
const PRIORITY_RULES: readonly PriorityRule[] = [
  // === SPEAK ===
  {
    match: (msg) => msg.source === 'pipeline' && msg.type === 'phase_intro',
    priority: 'speak',
    reason: 'Phase transitions are major coaching moments',
  },
  {
    match: (msg) => msg.type === 'victory' || msg.type === 'celebration',
    priority: 'speak',
    reason: 'Celebrate wins vocally',
  },
  {
    match: (msg) => msg.source === 'observer' && msg.type === 'nudge',
    priority: 'speak',
    reason: 'Stuck nudges need audible attention',
  },
  {
    match: (msg) => msg.type === 'session_welcome',
    priority: 'speak',
    reason: 'First impression matters',
  },
  {
    match: (msg) => msg.type === 'session_wrapup',
    priority: 'speak',
    reason: 'Closing moment should feel personal',
  },

  // === SILENT ===
  {
    match: (msg) => msg.anchor !== undefined,
    priority: 'silent',
    reason: 'Anchored hints are visual — reading them aloud is awkward',
  },
  {
    match: (msg) => msg.type === 'file_hint' || msg.type === 'line_hint',
    priority: 'silent',
    reason: 'Spatial hints work better visually',
  },
  {
    match: (msg) => msg.message.length > 500,
    priority: 'silent',
    reason: 'Long messages are painful to listen to',
  },
];

/**
 * Evaluates whether a coaching message should be spoken aloud.
 * Rules are evaluated in order; first match wins.
 * Returns false (silent) if no rule matches.
 */
export function shouldSpeak(msg: SpeakableMessage): boolean {
  for (const rule of PRIORITY_RULES) {
    if (rule.match(msg)) {
      return rule.priority === 'speak';
    }
  }
  return false;
}
