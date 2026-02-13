/**
 * ActivityPlot -- Visual background for a repo row showing recent activity.
 *
 * Renders a Nivo SwarmPlot canvas in the background of each repo row.
 * When activity data is null (not yet fetched), renders nothing.
 * When data arrives, fades in with a smooth opacity transition.
 *
 * The plot is non-interactive and purely decorative -- it provides a
 * visual density indicator for how active a repository has been recently.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveSwarmPlotCanvas } from '@nivo/swarmplot';
import type { RepoActivityEntry } from '@shared/types/entities';

interface ActivityPlotProps {
  /** Activity entries for this repo, or null if not yet fetched. */
  activities: RepoActivityEntry[] | null;
}

/** Map activity types to groups for the swarm plot. */
const ACTIVITY_GROUPS = ['commit', 'pr', 'issue', 'review', 'other'];

/** Warm color palette matching Paige design system. */
const ACTIVITY_COLORS = ['#d97757', '#c9a87c', '#7d9c6f', '#d4a843', '#a89c8c'];

interface SwarmDatum {
  id: string;
  group: string;
  value: number;
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
};

/**
 * ActivityPlot renders a decorative swarm plot of repository activity.
 *
 * Renders nothing when activities is null. Fades in when data arrives.
 */
export const ActivityPlot = memo(function ActivityPlot({ activities }: ActivityPlotProps) {
  const data = useMemo<SwarmDatum[]>(() => {
    if (!activities || activities.length === 0) return [];

    return activities.map((entry, i) => {
      const group = ACTIVITY_GROUPS.includes(entry.activityType)
        ? entry.activityType
        : 'other';
      const ts = new Date(entry.timestamp).getTime();

      return {
        id: `${group}-${i}`,
        group,
        value: ts,
      };
    });
  }, [activities]);

  if (!activities || data.length === 0) {
    return null;
  }

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.15 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <ResponsiveSwarmPlotCanvas<SwarmDatum>
        data={data}
        groups={ACTIVITY_GROUPS}
        id="id"
        value="value"
        valueScale={{ type: 'linear' }}
        groupBy="group"
        size={4}
        spacing={1}
        gap={0}
        forceStrength={0.5}
        simulationIterations={60}
        layout="horizontal"
        colors={ACTIVITY_COLORS}
        borderWidth={0}
        borderColor={{ from: 'color', modifiers: [] }}
        enableGridX={false}
        enableGridY={false}
        axisTop={null}
        axisRight={null}
        axisBottom={null}
        axisLeft={null}
        isInteractive={false}
        animate={false}
        margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
      />
    </motion.div>
  );
});
