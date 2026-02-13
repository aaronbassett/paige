/**
 * Relative time formatting utility.
 *
 * For dates within the last 30 days, returns a human-readable relative
 * string like "3 days ago". For older dates, returns a full formatted
 * date like "January 15, 2025".
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** Number of days after which we switch from relative to absolute format. */
const RELATIVE_THRESHOLD_DAYS = 30;

/**
 * Format a date string as relative time or absolute date.
 *
 * @param date - ISO 8601 date string or any value parseable by dayjs
 * @returns Relative time string (e.g. "3 days ago") for recent dates,
 *          or formatted date (e.g. "January 15, 2025") for older dates
 */
export function formatRelativeTime(date: string): string {
  const parsed = dayjs(date);

  if (!parsed.isValid()) {
    return 'Unknown';
  }

  const now = dayjs();
  const diffDays = now.diff(parsed, 'day');

  if (diffDays <= RELATIVE_THRESHOLD_DAYS) {
    return parsed.fromNow();
  }

  return parsed.format('MMMM D, YYYY');
}
