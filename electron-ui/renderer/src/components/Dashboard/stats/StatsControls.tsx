import { useState } from 'react';
import {
  useFloating,
  useClick,
  useDismiss,
  useInteractions,
  offset,
  flip,
  shift,
  autoUpdate,
} from '@floating-ui/react';
import { ChevronDown, ListFilter, RotateCcw } from 'lucide-react';
import { PERIODS, STATS_CATALOG, MAX_ACTIVE_STATS } from './catalog';
import type { StatId, StatsPeriod } from './types';

/* ------------------------------------------------------------------ */
/*  DateRangeDropdown                                                  */
/* ------------------------------------------------------------------ */

function DateRangeDropdown({
  period,
  onPeriodChange,
}: {
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
}) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const currentLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        style={{
          background: 'none',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          color: 'var(--text-secondary)',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-small-size)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {currentLabel}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: 'var(--space-xs)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
          {...getFloatingProps()}
        >
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                onPeriodChange(p.key);
                setOpen(false);
              }}
              style={{
                background: p.key === period ? 'var(--bg-surface)' : 'none',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                color: p.key === period ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left' as const,
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-small-size)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  FilterPopover                                                      */
/* ------------------------------------------------------------------ */

function FilterPopover({
  activeStats,
  onToggle,
  onReset,
  isAtLimit,
}: {
  activeStats: readonly StatId[];
  onToggle: (id: StatId) => void;
  onReset: () => void;
  isAtLimit: boolean;
}) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        style={{
          background: 'none',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          color: 'var(--text-secondary)',
          padding: '4px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ListFilter size={14} />
      </button>

      {open && (
        <div
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: 'var(--space-xs)',
            zIndex: 100,
            width: '280px',
            maxHeight: '320px',
            overflowY: 'auto' as const,
          }}
          {...getFloatingProps()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-xs)',
              padding: '0 4px',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-small-size)',
                fontFamily: 'var(--font-family)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              Filter Stats ({activeStats.length}/{MAX_ACTIVE_STATS})
            </span>
            <button
              onClick={onReset}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Reset to defaults"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {/* 2-col grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
            }}
          >
            {STATS_CATALOG.map((stat) => {
              const isActive = activeStats.includes(stat.id);
              const isDisabled = !isActive && isAtLimit;

              return (
                <button
                  key={stat.id}
                  onClick={() => {
                    if (!isDisabled) onToggle(stat.id);
                  }}
                  disabled={isDisabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: isDisabled ? 'default' : 'pointer',
                    fontSize: 'var(--font-small-size)',
                    fontFamily: 'var(--font-family)',
                    color: 'var(--text-secondary)',
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {/* Active indicator circle */}
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      ...(isActive
                        ? { background: 'var(--accent-primary)' }
                        : { border: '1px solid var(--border-subtle)' }),
                    }}
                  />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {stat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  StatsControls (combined)                                           */
/* ------------------------------------------------------------------ */

export function StatsControls({
  period,
  onPeriodChange,
  activeStats,
  onToggle,
  onReset,
  isAtLimit,
}: {
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
  activeStats: readonly StatId[];
  onToggle: (id: StatId) => void;
  onReset: () => void;
  isAtLimit: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <DateRangeDropdown period={period} onPeriodChange={onPeriodChange} />
      <FilterPopover
        activeStats={activeStats}
        onToggle={onToggle}
        onReset={onReset}
        isAtLimit={isAtLimit}
      />
    </div>
  );
}
