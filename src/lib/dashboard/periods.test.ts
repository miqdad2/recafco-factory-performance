import { describe, expect, it } from 'vitest';
import { getBuckets, getPeriodWindow, isWithin, kuwaitInstant, kuwaitMonthKey, toKuwaitCivil, toKuwaitIso } from './periods';

const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => toKuwaitIso(ms);

describe('test environment', () => {
  it('runs in a non-Kuwait local time zone', () => {
    // Kuwait is UTC+3 (offset −180). Los Angeles is −420/−480 minutes from UTC.
    expect(new Date(at('2026-10-14T12:00:00Z')).getTimezoneOffset()).not.toBe(-180);
  });
});

describe('Kuwait offset', () => {
  it('matches the Intl time-zone database across the year (no daylight saving)', () => {
    const format = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    for (let month = 1; month <= 12; month++) {
      const ms = Date.UTC(2026, month - 1, 15, 21, 30);
      const c = toKuwaitCivil(ms);
      const expected = format.format(ms); // "dd/mm/yyyy, hh:mm"
      expect(`${String(c.day).padStart(2, '0')}/${String(c.month).padStart(2, '0')}/${c.year}, ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`).toBe(expected);
    }
  });
});

describe('daily window: Kuwait midnight', () => {
  it('starts at Kuwait midnight, i.e. 21:00 UTC the previous day', () => {
    const w = getPeriodWindow('daily', at('2026-10-14T14:00:00+03:00'));
    expect(iso(w.startMs)).toBe('2026-10-14T00:00:00+03:00');
    expect(iso(w.endMs)).toBe('2026-10-15T00:00:00+03:00');
    expect(new Date(w.startMs).toISOString()).toBe('2026-10-13T21:00:00.000Z');
  });

  it('puts 23:59:59.999 in the old day and 00:00 in the new day', () => {
    expect(iso(getPeriodWindow('daily', at('2026-10-13T20:59:59.999Z')).startMs)).toBe('2026-10-13T00:00:00+03:00');
    expect(iso(getPeriodWindow('daily', at('2026-10-13T21:00:00.000Z')).startMs)).toBe('2026-10-14T00:00:00+03:00');
  });

  it('has 24 hourly buckets', () => {
    const buckets = getBuckets(getPeriodWindow('daily', at('2026-10-14T14:00:00+03:00')));
    expect(buckets).toHaveLength(24);
    expect(iso(buckets[23]!.startMs)).toBe('2026-10-14T23:00:00+03:00');
  });
});

describe('weekly window: Sunday start', () => {
  it('runs Sunday 00:00 to the next Sunday 00:00', () => {
    const w = getPeriodWindow('weekly', at('2026-10-14T14:00:00+03:00')); // Wednesday
    expect(iso(w.startMs)).toBe('2026-10-11T00:00:00+03:00');
    expect(iso(w.endMs)).toBe('2026-10-18T00:00:00+03:00');
    expect(getBuckets(w)).toHaveLength(7);
  });

  it('treats Sunday 00:00 as the start of a new week and Saturday 23:59 as the old week', () => {
    expect(iso(getPeriodWindow('weekly', at('2026-10-18T00:00:00+03:00')).startMs)).toBe('2026-10-18T00:00:00+03:00');
    expect(iso(getPeriodWindow('weekly', at('2026-10-17T23:59:00+03:00')).startMs)).toBe('2026-10-11T00:00:00+03:00');
  });

  it('crosses a year boundary', () => {
    const w = getPeriodWindow('weekly', at('2026-01-01T09:00:00+03:00')); // Thursday 1 Jan 2026
    expect(iso(w.startMs)).toBe('2025-12-28T00:00:00+03:00');
    expect(iso(w.endMs)).toBe('2026-01-04T00:00:00+03:00');
    expect(getBuckets(w).map((b) => iso(b.startMs).slice(0, 10))).toEqual([
      '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03',
    ]);
  });
});

describe('monthly and yearly windows', () => {
  it('uses calendar months with daily buckets, including leap February', () => {
    const leap = getPeriodWindow('monthly', at('2028-02-29T10:00:00+03:00'));
    expect(iso(leap.startMs)).toBe('2028-02-01T00:00:00+03:00');
    expect(iso(leap.endMs)).toBe('2028-03-01T00:00:00+03:00');
    expect(getBuckets(leap)).toHaveLength(29);
    expect(getBuckets(getPeriodWindow('monthly', at('2026-02-10T10:00:00+03:00')))).toHaveLength(28);
    expect(getBuckets(getPeriodWindow('monthly', at('2026-10-14T14:00:00+03:00')))).toHaveLength(31);
  });

  it('assigns the last minute of leap day to February and midnight to March', () => {
    expect(kuwaitMonthKey(at('2028-02-29T23:59:00+03:00'))).toBe('2028-02');
    expect(kuwaitMonthKey(at('2028-03-01T00:00:00+03:00'))).toBe('2028-03');
  });

  it('rolls December into the next year', () => {
    const dec = getPeriodWindow('monthly', at('2026-12-31T23:30:00+03:00'));
    expect(iso(dec.endMs)).toBe('2027-01-01T00:00:00+03:00');
    const year = getPeriodWindow('yearly', at('2026-12-31T23:30:00+03:00'));
    expect(iso(year.startMs)).toBe('2026-01-01T00:00:00+03:00');
    expect(iso(year.endMs)).toBe('2027-01-01T00:00:00+03:00');
  });

  it('uses 12 monthly buckets for a year', () => {
    const buckets = getBuckets(getPeriodWindow('yearly', at('2028-06-01T00:00:00+03:00')));
    expect(buckets.map((b) => iso(b.startMs).slice(0, 7))).toEqual([
      '2028-01', '2028-02', '2028-03', '2028-04', '2028-05', '2028-06',
      '2028-07', '2028-08', '2028-09', '2028-10', '2028-11', '2028-12',
    ]);
  });
});

describe('half-open intervals', () => {
  it('includes the start and excludes the end', () => {
    const start = kuwaitInstant(2026, 10, 14);
    const end = kuwaitInstant(2026, 10, 15);
    expect(isWithin(start, start, end)).toBe(true);
    expect(isWithin(end - 1, start, end)).toBe(true);
    expect(isWithin(end, start, end)).toBe(false);
  });
});
