import { describe, expect, it } from 'vitest';
import { formatKuwaitHour, formatKuwaitShortDate, formatKuwaitTime } from './time';

describe('12-hour Kuwait time', () => {
  it('shows midnight as 12:00 AM and noon as 12:00 PM', () => {
    expect(formatKuwaitTime('2026-10-14T00:00:00+03:00')).toBe('12:00 AM');
    expect(formatKuwaitTime('2026-10-14T12:00:00+03:00')).toBe('12:00 PM');
  });

  it('uses uppercase AM/PM without a leading zero', () => {
    expect(formatKuwaitTime('2026-10-14T13:05:00+03:00')).toBe('1:05 PM');
    expect(formatKuwaitTime('2026-10-14T09:30:00+03:00')).toBe('9:30 AM');
    expect(formatKuwaitTime('2026-10-14T23:59:00+03:00')).toBe('11:59 PM');
  });

  it('converts any instant to Kuwait time regardless of the input offset', () => {
    // 10:05 UTC = 1:05 PM in Kuwait (UTC+3); tests run under America/Los_Angeles.
    expect(formatKuwaitTime(new Date('2026-10-14T10:05:00Z'))).toBe('1:05 PM');
    expect(formatKuwaitTime('2026-10-13T21:00:00Z')).toBe('12:00 AM');
    expect(formatKuwaitShortDate('2026-10-13T21:00:00Z')).toBe('Wed 14 Oct 2026');
  });

  it('formats hour-only axis labels', () => {
    expect(formatKuwaitHour('2026-10-14T00:00:00+03:00')).toBe('12 AM');
    expect(formatKuwaitHour('2026-10-14T06:00:00+03:00')).toBe('6 AM');
    expect(formatKuwaitHour('2026-10-14T12:00:00+03:00')).toBe('12 PM');
    expect(formatKuwaitHour('2026-10-14T22:00:00+03:00')).toBe('10 PM');
  });
});
