/**
 * DifficultyIcon -- Inline SVG mountain icons representing issue difficulty.
 *
 * Five distinct mountain silhouettes from gentle hill (low) to jagged peaks (extreme).
 * Uses a warm earth-tone palette: body #5C4033, snow #D4C5B2, base #3D2B1F.
 *
 * Usage: <DifficultyIcon level="high" size={24} />
 */

import type { IssueDifficulty } from '@shared/types/entities';

interface DifficultyIconProps {
  level: IssueDifficulty;
  size?: number;
}

const BODY_COLOR = '#5C4033';
const SNOW_COLOR = '#D4C5B2';
const BASE_COLOR = '#3D2B1F';

/**
 * Low difficulty -- gentle rolling hill.
 */
function LowMountain({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* Base ground line */}
      <rect x="0" y="20" width="24" height="4" fill={BASE_COLOR} rx="1" />
      {/* Gentle hill */}
      <path
        d="M2 20 Q12 10 22 20 Z"
        fill={BODY_COLOR}
      />
      {/* Snow cap */}
      <path
        d="M9 15 Q12 11 15 15"
        fill={SNOW_COLOR}
      />
    </svg>
  );
}

/**
 * Medium difficulty -- a single defined peak.
 */
function MediumMountain({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0" y="20" width="24" height="4" fill={BASE_COLOR} rx="1" />
      {/* Single peak */}
      <path
        d="M3 20 L12 6 L21 20 Z"
        fill={BODY_COLOR}
      />
      {/* Snow cap */}
      <path
        d="M10 10 L12 6 L14 10 Z"
        fill={SNOW_COLOR}
      />
    </svg>
  );
}

/**
 * High difficulty -- two peaks, the taller one in front.
 */
function HighMountain({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0" y="20" width="24" height="4" fill={BASE_COLOR} rx="1" />
      {/* Back peak */}
      <path
        d="M10 20 L17 7 L24 20 Z"
        fill={BODY_COLOR}
        opacity="0.7"
      />
      {/* Front peak */}
      <path
        d="M0 20 L9 5 L18 20 Z"
        fill={BODY_COLOR}
      />
      {/* Snow caps */}
      <path d="M7 9 L9 5 L11 9 Z" fill={SNOW_COLOR} />
      <path d="M15.5 10 L17 7 L18.5 10 Z" fill={SNOW_COLOR} />
    </svg>
  );
}

/**
 * Very high difficulty -- steep jagged twin peaks.
 */
function VeryHighMountain({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0" y="20" width="24" height="4" fill={BASE_COLOR} rx="1" />
      {/* Three overlapping peaks */}
      <path
        d="M14 20 L20 6 L24 20 Z"
        fill={BODY_COLOR}
        opacity="0.6"
      />
      <path
        d="M6 20 L13 4 L20 20 Z"
        fill={BODY_COLOR}
        opacity="0.8"
      />
      <path
        d="M0 20 L7 3 L14 20 Z"
        fill={BODY_COLOR}
      />
      {/* Snow caps */}
      <path d="M5.5 7 L7 3 L8.5 7 Z" fill={SNOW_COLOR} />
      <path d="M11.5 8 L13 4 L14.5 8 Z" fill={SNOW_COLOR} />
      <path d="M18.5 9 L20 6 L21.5 9 Z" fill={SNOW_COLOR} />
    </svg>
  );
}

/**
 * Extreme difficulty -- sharp jagged peaks with serrated ridgeline.
 */
function ExtremeMountain({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0" y="20" width="24" height="4" fill={BASE_COLOR} rx="1" />
      {/* Jagged multi-peak silhouette */}
      <path
        d="M0 20 L3 8 L5 12 L8 2 L11 10 L14 4 L17 11 L20 3 L23 9 L24 20 Z"
        fill={BODY_COLOR}
      />
      {/* Snow caps on the tallest peaks */}
      <path d="M6.5 6 L8 2 L9.5 6 Z" fill={SNOW_COLOR} />
      <path d="M12.5 7 L14 4 L15.5 7 Z" fill={SNOW_COLOR} />
      <path d="M18.5 6 L20 3 L21.5 6 Z" fill={SNOW_COLOR} />
    </svg>
  );
}

const MOUNTAIN_COMPONENTS: Record<IssueDifficulty, React.FC<{ size: number }>> = {
  low: LowMountain,
  medium: MediumMountain,
  high: HighMountain,
  very_high: VeryHighMountain,
  extreme: ExtremeMountain,
};

export function DifficultyIcon({ level, size = 24 }: DifficultyIconProps) {
  const MountainComponent = MOUNTAIN_COMPONENTS[level];
  return <MountainComponent size={size} />;
}
