import type { BucketGranularity, DashboardSnapshot, Period, QuantityUnit, ReportProduct } from '../../lib/dashboard/contracts';
import { isDashboardDataError } from '../../lib/dashboard/errors';
import { formatQuantity } from '../../lib/format';
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

/** Label for current-snapshot cards (orders); the time beside it says which moment. */
export const SNAPSHOT_SCOPE = 'Current';

export const TREND_INTERVAL_LABELS: Record<BucketGranularity, string> = {
  hour: 'Hourly output',
  day: 'Daily output',
  month: 'Monthly output',
};

/**
 * Name of the shaded part of the chart after the data's reference time. Daily is made of
 * hours, so it reads "Later hours"; other periods keep "Not yet reached". It names only
 * intervals that have not occurred at the reference time: unknown data and failed loads
 * never use it, and completed periods have no such intervals.
 */
export const FUTURE_LABELS: Record<Period, string> = {
  daily: 'Later hours',
  weekly: 'Not yet reached',
  monthly: 'Not yet reached',
  yearly: 'Not yet reached',
};

/** Shown wherever a value is unknown; unknown is never drawn as zero. */
export const NOT_AVAILABLE = 'Not available';

/** Beyond this many product rows the cards and table use their tighter spacing. */
export const DENSE_ROW_LIMIT = 4;

/** Display names of the demo product categories. */
export const PRODUCT_LABELS: Record<ReportProduct, string> = {
  hollowcore: 'Hollowcore',
  precast: 'Precast',
  grc: 'GRC',
  unmapped: 'Unmapped items',
};

/** m², m³, pieces (verified), Nos (unverified). An unmapped unit is flagged, never renamed. */
export const isUnverifiedUnit = (unit: QuantityUnit) => unit === 'nos' || unit.startsWith('raw:');

export function formatUnit(unit: QuantityUnit): string {
  switch (unit) {
    case 'm2':
      return 'm²';
    case 'm3':
      return 'm³';
    case 'pieces':
      return 'pieces';
    case 'nos':
      return 'Nos (unverified)';
    default:
      return `${unit.slice('raw:'.length) || 'Unit not stated'} (unverified)`;
  }
}

/** Value and unit together: "1,204.5 m²", "1 piece". */
export function formatQuantityWithUnit(value: number, unit: QuantityUnit): string {
  return `${formatQuantity(value, unit)} ${value === 1 && unit === 'pieces' ? 'piece' : formatUnit(unit)}`;
}

/** A table quantity: an unverified unit is short here, as the Product column already flags it. */
export function formatCellQuantity(value: number, unit: QuantityUnit): string {
  if (!isUnverifiedUnit(unit)) return formatQuantityWithUnit(value, unit);
  return `${formatQuantity(value, unit)} ${unit === 'nos' ? 'Nos' : unit.slice('raw:'.length) || 'no unit'}`;
}

type RowLabelInput = { product: ReportProduct; unit: QuantityUnit; subtype?: string | null };

/**
 * Names of the four standard rows. Precast is split into volume and pieces: separate
 * quantity groups, never added together, and not two measures of the same elements.
 */
const STANDARD_NAMES: Readonly<Record<string, string>> = {
  'hollowcore:m2': 'Hollowcore',
  'precast:m3': 'Precast volume',
  'precast:pieces': 'Precast pieces',
  'grc:m2': 'GRC',
};

/** What the unit adds to a verified subtype's name, e.g. "Precast Beam volume". */
const SUBTYPE_MEASURE: Partial<Record<QuantityUnit, string>> = { m3: 'volume', pieces: 'pieces' };

/**
 * Name beside a quantity that already shows its unit (headline cards): "Hollowcore",
 * "Precast volume", "Precast pieces", "GRC". Rows outside the standard four keep their
 * unit in the name, e.g. "Unmapped items · m²", since nothing else explains them.
 */
export function formatProductName(row: RowLabelInput): string {
  const base = PRODUCT_LABELS[row.product];
  if (row.subtype) {
    const measure = SUBTYPE_MEASURE[row.unit];
    return measure ? `${base} ${row.subtype} ${measure}` : `${base} ${row.subtype} · ${formatUnit(row.unit)}`;
  }
  return STANDARD_NAMES[`${row.product}:${row.unit}`] ?? `${base} · ${formatUnit(row.unit)}`;
}

/**
 * Name where no quantity sits beside it (chart buttons, Project Summary heading): the
 * product name plus its unit, unless the name already says it. "Precast volume · m³",
 * "Precast pieces", "Hollowcore · m²".
 */
export function formatSeriesName(row: RowLabelInput): string {
  const name = formatProductName(row);
  return name.includes(' · ') || row.unit === 'pieces' ? name : `${name} · ${formatUnit(row.unit)}`;
}

/** Axis label for one trend bucket. */
export function formatBucketLabel(startIso: string, granularity: BucketGranularity, period: Period): string {
  if (granularity === 'hour') return formatKuwaitHour(startIso);
  if (granularity === 'month') return formatKuwaitShortMonth(startIso);
  if (period === 'daily') return formatKuwaitDayMonth(startIso); // a single day-total bar
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

/** Names what is being requested: only the parts that differ from the view on screen. */
export function describeSelection(selection: { period: Period; project: string }, shown: DashboardSnapshot): string {
  const project = selection.project === shown.selectedProject.key ? null : shown.projectOptions.find((o) => o.key === selection.project)?.name;
  const period = selection.period === shown.selectedPeriod ? null : PERIOD_LABELS[selection.period];
  return [project, period].filter(Boolean).join(', ');
}

/** Short failure text naming the selection, e.g. "Monthly did not load". */
export const failureText = (selectionName: string, error: unknown) =>
  isInvalidData(error) ? `${selectionName} figures failed checks` : `${selectionName} did not load`;

/** Sentence for the initial-failure screen. */
export const initialFailureText = (error: unknown) =>
  isInvalidData(error)
    ? 'The demo figures did not pass their consistency checks, so they are not shown.'
    : 'The demo figures could not be loaded.';

/** "Wed 14 Oct, 14:00" — compact snapshot time for cards; the footer gives the year. */
export const formatSnapshotTime = (iso: string) => `${formatKuwaitDayMonth(iso)}, ${formatKuwaitTime(iso)}`;

/** "Wed 14 Oct 2026, 14:00" */
export const formatDataAsOf = (iso: string) => `${formatKuwaitShortDate(iso)}, ${formatKuwaitTime(iso)}`;
