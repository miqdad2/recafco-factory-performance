import type { BucketGranularity, Period } from './contracts';

/**
 * Asia/Kuwait period maths. Kuwait keeps UTC+03:00 all year with no daylight
 * saving (cross-checked against the Intl time-zone database in tests), so all
 * calculations use UTC arithmetic shifted by this offset and never depend on
 * the computer's local time zone.
 */
export const KUWAIT_TIME_ZONE = 'Asia/Kuwait';
export const KUWAIT_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface KuwaitCivilTime {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

export function toKuwaitCivil(instantMs: number): KuwaitCivilTime {
  const d = new Date(instantMs + KUWAIT_UTC_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

/** Instant of a Kuwait wall-clock time. Out-of-range parts roll over (day 0, month 13, …). */
export function kuwaitInstant(year: number, month: number, day = 1, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) - KUWAIT_UTC_OFFSET_MS;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-14T14:00:00+03:00" */
export function toKuwaitIso(instantMs: number): string {
  const c = toKuwaitCivil(instantMs);
  return `${c.year}-${pad(c.month)}-${pad(c.day)}T${pad(c.hour)}:${pad(c.minute)}:${pad(c.second)}+03:00`;
}

/** "2026-10" */
export function kuwaitMonthKey(instantMs: number): string {
  const c = toKuwaitCivil(instantMs);
  return `${c.year}-${pad(c.month)}`;
}

export function parseInstant(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid timestamp: ${iso}`);
  return ms;
}

export const PERIOD_GRANULARITY: Record<Period, BucketGranularity> = {
  daily: 'hour',
  weekly: 'day',
  monthly: 'day',
  yearly: 'month',
};

/** Full calendar period containing `asOfMs`, as a half-open interval [startMs, endMs). */
export interface PeriodWindow {
  period: Period;
  startMs: number;
  endMs: number;
  granularity: BucketGranularity;
}

export function getPeriodWindow(period: Period, asOfMs: number): PeriodWindow {
  const { year, month, day, weekday } = toKuwaitCivil(asOfMs);
  const window = (startMs: number, endMs: number): PeriodWindow => ({
    period,
    startMs,
    endMs,
    granularity: PERIOD_GRANULARITY[period],
  });

  switch (period) {
    case 'daily':
      return window(kuwaitInstant(year, month, day), kuwaitInstant(year, month, day + 1));
    case 'weekly': {
      // Proposed factory week: Sunday 00:00 to the following Sunday 00:00 (pending confirmation).
      const sunday = day - weekday;
      return window(kuwaitInstant(year, month, sunday), kuwaitInstant(year, month, sunday + 7));
    }
    case 'monthly':
      return window(kuwaitInstant(year, month, 1), kuwaitInstant(year, month + 1, 1));
    case 'yearly':
      return window(kuwaitInstant(year, 1, 1), kuwaitInstant(year + 1, 1, 1));
  }
}

export interface BucketWindow {
  startMs: number;
  endMs: number;
}

/** Chart buckets covering the whole window: hours, Kuwait calendar days or calendar months. */
export function getBuckets(window: PeriodWindow): BucketWindow[] {
  const origin = toKuwaitCivil(window.startMs);
  const boundary = (i: number): number => {
    switch (window.granularity) {
      case 'hour':
        return window.startMs + i * HOUR_MS;
      case 'day':
        return kuwaitInstant(origin.year, origin.month, origin.day + i);
      case 'month':
        return kuwaitInstant(origin.year, origin.month + i, 1);
    }
  };

  const buckets: BucketWindow[] = [];
  for (let i = 0, start = window.startMs; start < window.endMs; i++) {
    const end = boundary(i + 1);
    buckets.push({ startMs: start, endMs: end });
    start = end;
  }
  return buckets;
}

/** Half-open membership test: start inclusive, end exclusive. */
export const isWithin = (instantMs: number, startMs: number, endMs: number): boolean =>
  instantMs >= startMs && instantMs < endMs;
