import { describe, expect, it } from 'vitest';
import { planValueLabels, type ChartBucket } from './chartLabels';

const AS_OF = '2026-10-14T14:00:00+03:00';

/** Daily buckets for October 2026 with the given piece counts (null = future). */
function octoberDays(values: (number | null)[]): ChartBucket[] {
  return values.map((value, i) => {
    const day = String(i + 1).padStart(2, '0');
    const next = String(i + 2).padStart(2, '0');
    return { start: `2026-10-${day}T00:00:00+03:00`, end: `2026-10-${next}T00:00:00+03:00`, value };
  });
}

/** Hourly buckets for 14 Oct 2026. */
function hours(values: (number | null)[]): ChartBucket[] {
  return values.map((value, h) => ({
    start: `2026-10-14T${String(h).padStart(2, '0')}:00:00+03:00`,
    end: new Date(Date.parse('2026-10-14T00:00:00+03:00') + (h + 1) * 3_600_000).toISOString(),
    value,
  }));
}

describe('planValueLabels', () => {
  it('labels productive bars with whole counts, never zero-output or future bars', () => {
    const plan = planValueLabels(octoberDays([12, 0, 1305, null, null]), 'weekly', '2026-10-06T00:00:00+03:00', 'pieces');
    expect(plan.texts).toEqual(['12', null, '1,305', null, null]);
    expect(plan.legend).toEqual([{ kind: 'zero', text: 'No production' }]);
  });

  it('emphasises the day containing the demo reference time in Weekly and calls it "Selected day"', () => {
    const plan = planValueLabels(octoberDays([84, 84, 90, 50, null, null, null]), 'weekly', '2026-10-04T14:00:00+03:00', 'pieces');
    expect(plan.emphasisIndex).toBe(3);
    expect(plan.legend).toContainEqual({ kind: 'emphasis', text: 'Selected day, to 2:00 PM' });
    expect(JSON.stringify(plan)).not.toMatch(/today/i);
  });

  it('does not emphasise a Daily hour that starts exactly at the reference time', () => {
    const plan = planValueLabels(hours([5, 6, ...Array(12).fill(10), ...Array(10).fill(null)]), 'daily', AS_OF, 'pieces');
    expect(plan.emphasisIndex).toBeNull();
    expect(plan.legend).toEqual([]);
  });

  it('emphasises a partly elapsed Daily hour', () => {
    const plan = planValueLabels(hours([...Array(14).fill(10), 4, ...Array(9).fill(null)]), 'daily', '2026-10-14T14:30:00+03:00', 'pieces');
    expect(plan.emphasisIndex).toBe(14);
    expect(plan.legend).toContainEqual({ kind: 'emphasis', text: 'Current hour, to 2:30 PM' });
  });

  it('labels only the highest day in Monthly and describes the selected and highest days in pieces', () => {
    const values: (number | null)[] = [85, 0, 33, 70, 102, 80, 73, 70, 0, 30, 84, 84, 90, 50];
    const plan = planValueLabels(octoberDays([...values, ...Array(17).fill(null)]), 'monthly', AS_OF, 'pieces');

    expect(plan.texts.flatMap((t, i) => (t === null ? [] : [[i, t]]))).toEqual([[4, '102']]);
    expect(plan.emphasisIndex).toBe(13);
    expect(plan.legend).toEqual([
      { kind: 'emphasis', text: 'Selected day, to 2:00 PM: Wed 14 Oct · 50 pieces' },
      { kind: 'note', text: 'Highest day: Mon 5 Oct · 102 pieces' },
      { kind: 'zero', text: 'No production' },
    ]);
  });

  it('names a completed month by its highest day only', () => {
    const plan = planValueLabels(octoberDays([100, 200, 50]), 'monthly', '2026-11-05T12:00:00+03:00', 'pieces');
    expect(plan.emphasisIndex).toBeNull();
    expect(plan.legend).toEqual([{ kind: 'note', text: 'Highest day: Fri 2 Oct · 200 pieces' }]);
  });

  it('emphasises the current month in Yearly with a month-to-date description', () => {
    const months: ChartBucket[] = Array.from({ length: 12 }, (_, i) => ({
      start: `2026-${String(i + 1).padStart(2, '0')}-01T00:00:00+03:00`,
      end: i === 11 ? '2027-01-01T00:00:00+03:00' : `2026-${String(i + 2).padStart(2, '0')}-01T00:00:00+03:00`,
      value: i < 9 ? 1800 : i === 9 ? 881 : null,
    }));
    const plan = planValueLabels(months, 'yearly', AS_OF, 'pieces');
    expect(plan.emphasisIndex).toBe(9);
    expect(plan.texts[0]).toBe('1,800');
    expect(plan.legend).toEqual([{ kind: 'emphasis', text: 'October 2026, to Wed 14 Oct' }]);
  });
});
