/**
 * HintIllustration — decorative SVG illustration for the hint level slider.
 *
 * Displays a small line-art illustration that changes with the current hint
 * level, visually communicating the coaching intensity:
 *
 *   - Level 0: Person hunched over laptop (struggling alone)
 *   - Level 1: Person with books (gentle nudge / direction)
 *   - Level 2: Two people, one pointing (active guidance)
 *   - Level 3: Two people, one coding while first relaxes (full solution)
 *
 * Loads SVGs via URL references (Vite asset handling). Falls back to an
 * emoji if the SVG fails to load. Uses a CSS animation keyframe for a
 * quick fade-in when the level changes.
 */

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HintIllustrationProps {
  level: 0 | 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SVG_PATHS: Record<number, string> = {
  0: new URL('../../../../assets/illustrations/hint-level-0.svg', import.meta.url).href,
  1: new URL('../../../../assets/illustrations/hint-level-1.svg', import.meta.url).href,
  2: new URL('../../../../assets/illustrations/hint-level-2.svg', import.meta.url).href,
  3: new URL('../../../../assets/illustrations/hint-level-3.svg', import.meta.url).href,
};

const EMOJI_FALLBACKS: Record<number, string> = {
  0: '\u{1F4BB}', // laptop
  1: '\u{1F4DA}', // books
  2: '\u{1F449}', // pointing right
  3: '\u{1F379}', // cocktail
};

const LEVEL_LABELS: Record<number, string> = {
  0: 'Struggling alone',
  1: 'Gentle nudge',
  2: 'Active guidance',
  3: 'Full solution',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  height: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
};

const imgStyle: React.CSSProperties = {
  height: 80,
  maxWidth: '100%',
  objectFit: 'contain',
  animation: 'hint-fade-in 300ms ease-in-out',
};

const emojiStyle: React.CSSProperties = {
  fontSize: 40,
  lineHeight: '80px',
  textAlign: 'center',
  animation: 'hint-fade-in 300ms ease-in-out',
  userSelect: 'none',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Inject a keyframe animation into the document once for the crossfade.
 * Using a `key` prop on the inner element triggers remount on level change,
 * which replays the fade-in animation.
 */
const KEYFRAME_ID = 'hint-illustration-keyframes';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes hint-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

export function HintIllustration({ level }: HintIllustrationProps) {
  const [failedLevels, setFailedLevels] = useState<Set<number>>(() => {
    ensureKeyframes();
    return new Set();
  });

  const handleImgError = useCallback(() => {
    setFailedLevels((prev) => {
      const next = new Set(prev);
      next.add(level);
      return next;
    });
  }, [level]);

  const svgFailed = failedLevels.has(level);
  const svgSrc = SVG_PATHS[level];
  const emoji = EMOJI_FALLBACKS[level] ?? '';
  const label = LEVEL_LABELS[level] ?? '';

  return (
    <div
      style={containerStyle}
      role="img"
      aria-label={`Hint level ${level}: ${label}`}
      data-testid="hint-illustration"
    >
      {svgFailed ? (
        <span
          key={`emoji-${level}`}
          style={emojiStyle}
          aria-hidden="true"
          data-testid="hint-emoji-fallback"
        >
          {emoji}
        </span>
      ) : (
        <img
          key={`img-${level}`}
          src={svgSrc}
          alt=""
          style={imgStyle}
          onError={handleImgError}
          data-testid="hint-illustration-img"
        />
      )}
    </div>
  );
}
