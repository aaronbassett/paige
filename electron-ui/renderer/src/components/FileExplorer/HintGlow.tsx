/**
 * HintGlow component for the Paige Electron UI file explorer.
 *
 * Wraps a tree node with a Framer Motion animation that produces a
 * breathing glow effect. The glow intensity, color, and animation
 * spring parameters are driven by the HintInfo from the hint manager
 * service.
 *
 * The breathing animation oscillates the box-shadow opacity between
 * `intensity * 0.25` and `intensity * 0.4`, creating a subtle
 * pulsing effect that draws attention without being distracting.
 */

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { HintInfo } from '../../services/hint-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HintGlowProps {
  /** Computed hint info from the hint manager service. */
  hint: HintInfo;
  /** The tree node content to wrap with a glow effect. */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Base glow color (terracotta accent) without alpha. The alpha channel
 * is computed dynamically from the hint intensity.
 */
const GLOW_R = 217;
const GLOW_G = 119;
const GLOW_B = 87;

/** Duration of one full breathing cycle in seconds. */
const BREATHING_DURATION = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a CSS box-shadow string for the glow effect at a given alpha.
 */
function glowShadow(alpha: number): string {
  return `0 0 8px 2px rgba(${GLOW_R}, ${GLOW_G}, ${GLOW_B}, ${alpha.toFixed(3)})`;
}

/**
 * Build a subtle inner background highlight for the glow at a given alpha.
 */
function glowBackground(alpha: number): string {
  return `rgba(${GLOW_R}, ${GLOW_G}, ${GLOW_B}, ${(alpha * 0.15).toFixed(3)})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Wraps its children with a breathing box-shadow glow animation.
 *
 * The glow color is the Paige terracotta accent (`#d97757`) and the
 * animation parameters (stiffness, damping) come from the hint info,
 * allowing different hint styles to feel visually distinct.
 *
 * @example
 * ```tsx
 * const hint = hintManager.getHint('/src/App.tsx');
 * if (hint) {
 *   return (
 *     <HintGlow hint={hint}>
 *       <TreeNode />
 *     </HintGlow>
 *   );
 * }
 * ```
 */
export function HintGlow({ hint, children }: HintGlowProps): ReactNode {
  const lowAlpha = hint.intensity * 0.25;
  const highAlpha = hint.intensity * 0.4;

  return (
    <motion.div
      style={{
        borderRadius: 4,
        position: 'relative',
      }}
      animate={{
        boxShadow: [glowShadow(lowAlpha), glowShadow(highAlpha), glowShadow(lowAlpha)],
        backgroundColor: [
          glowBackground(lowAlpha),
          glowBackground(highAlpha),
          glowBackground(lowAlpha),
        ],
      }}
      transition={{
        duration: BREATHING_DURATION,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}
