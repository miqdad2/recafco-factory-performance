import type { BucketGranularity, DashboardSnapshot, DeliveredUnit, Period } from '../../lib/dashboard/contracts';
import { isDashboardDataError } from '../../lib/dashboard/errors';
import {
  formatKuwaitDayMonth,
  formatKuwaitDayOfMonth,
  formatKuwaitHour,
  formatKuwaitMonthYear,
  formatKuwaitShortDate,
  formatKuwaitShortMonth,
  formatKuwaitTime,
  formatKuwaitWeekdayDay,
  formatKuwaitYear,
} from '../../lib/time';

export const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/**
 * Name of the reporting period on cards and panels. Deliberately "Selected …",
 * not "Today/This week": demo figures belong to the fixed demo reference date,
 * which differs from the live Kuwait date shown by the clock.
 */
export const PERIOD_SCOPES: Record<Period, string> = {
  daily: 'Selected day',
  weekly: 'Selected week',
  monthly: 'Selected month',
  yearly: 'Selected year',
};

/** Label for current-snapshot cards (orders): a demo snapshot, not "now". */
export const SNAPSHOT_SCOPE = 'Demo snapshot';

export const TREND_INTERVAL_LABELS: Record<BucketGranularity, string> = {
  hour: 'Hourly output',
  day: 'Daily output',
  month: 'Monthly output',
};

export const DELIVERED_UNIT_LABELS: Record<DeliveredUnit, string> = {
  pieces: 'pieces',
  m3: 'm³',
};

/** Axis label for one trend bucket. */
export function formatBucketLabel(startIso: string, granularity: BucketGranularity, period: Period): string {
  if (granularity === 'hour') return formatKuwaitHour(startIso);
  if (granularity === 'month') return formatKuwaitShortMonth(startIso);
  return period === 'weekly' ? formatKuwaitWeekdayDay(startIso) : formatKuwaitDayOfMonth(startIso);
}

/**
 * Selected calendar period:
 * Daily "Wed 14 Oct 2026" · Weekly "Sun 11 – Sat 17 Oct 2026" (or across months/years
 * "Sun 28 Dec 2025 – Sat 3 Jan 2026") · Monthly "October 2026" · Yearly "2026".
 */
export function formatPeriodRange({ selectedPeriod, range }: Pick<DashboardSnapshot, 'selectedPeriod' | 'range'>): string {
  switch (selectedPeriod) {
    case 'daily':
      return formatKuwaitShortDate(range.start);
    case 'weekly': {
      // Range end is exclusive; the last day is one millisecond earlier.
      const last = new Date(Date.parse(range.end) - 1);
      const lastText = formatKuwaitShortDate(last);
      if (formatKuwaitYear(range.start) !== formatKuwaitYear(last)) return `${formatKuwaitShortDate(range.start)} – ${lastText}`;
      if (formatKuwaitShortMonth(range.start) !== formatKuwaitShortMonth(last)) return `${formatKuwaitDayMonth(range.start)} – ${lastText}`;
      return `${formatKuwaitWeekdayDay(range.start)} – ${lastText}`;
    }
    case 'monthly':
      return formatKuwaitMonthYear(range.start);
    case 'yearly':
      return formatKuwaitYear(range.start);
  }
}

const isInvalidData = (error: unknown) =>
  isDashboardDataError(error) && (error.code === 'invalid-response' || error.code === 'invalid-source-data');

/** Short failure text naming the requested period, e.g. "Monthly did not load". */
export const failureText = (period: Period, error: unknown) =>
  isInvalidData(error) ? `${PERIOD_LABELS[period]} figures failed checks` : `${PERIOD_LABELS[period]} did not load`;

/** Sentence for the initial-failure screen. */
export const initialFailureText = (error: unknown) =>
  isInvalidData(error)
    ? 'The demo figures did not pass their consistency checks, so they are not shown.'
    : 'The demo figures could not be loaded.';

/** "Wed 14 Oct, 14:00" — compact snapshot time for cards; the footer gives the year. */
export const formatSnapshotTime = (iso: string) => `${formatKuwaitDayMonth(iso)}, ${formatKuwaitTime(iso)}`;

/** "Wed 14 Oct 2026, 14:00" */
export const formatDataAsOf = (iso: string) => `${formatKuwaitShortDate(iso)}, ${formatKuwaitTime(iso)}`;
