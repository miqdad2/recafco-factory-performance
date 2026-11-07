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
    expect(plan.legend).toContainEqual({ kind: 'zero', text: 'No production' });
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

  it('formats quantities in their own unit and never as pieces', () => {
    const plan = planValueLabels(octoberDays([120.4, 7.26, null]), 'monthly', AS_OF, 'm2');
    expect(plan.texts).toEqual(['120', null, null]);
    expect(plan.legend).toContainEqual({ kind: 'note', text: 'Highest day: Thu 1 Oct · 120.4 m²' });
    const small = planValueLabels(octoberDays([7.26, 0]), 'weekly', AS_OF, 'm3');
    expect(small.texts).toEqual(['7.3', null]);
  });

  it('states when hourly detail is unavailable and labels the day total like the card', () => {
    const bar: ChartBucket[] = [{ start: '2026-10-14T00:00:00+03:00', end: '2026-10-15T00:00:00+03:00', value: 1234.56 }];
    const plan = planValueLabels(bar, 'daily', AS_OF, 'm2', true);
    expect(plan.texts).toEqual(['1,234.6']);
    expect(plan.legend).toEqual([
      { kind: 'status', text: 'Hourly detail unavailable' },
      { kind: 'emphasis', text: 'Selected day, to 2:00 PM' },
    ]);
    expect(JSON.stringify(plan)).not.toMatch(/Current hour/);
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
    expect(plan.legend).toEqual([
      { kind: 'emphasis', text: 'October 2026, to Wed 14 Oct' },
      { kind: 'note', text: 'Shaded area: not yet reached' },
    ]);
  });
});

describe('future-interval wording', () => {
  it('names the shaded area for the period, from the reference time in the data', () => {
    const futureHours = hours([...Array(22).fill(3), null, null]);
    expect(planValueLabels(futureHours, 'daily', '2026-10-14T21:30:00+03:00', 'm2').legend).toContainEqual({ kind: 'note', text: 'Shaded area: later hours' });
    const futureDays = octoberDays([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, null, null]);
    expect(planValueLabels(futureDays, 'monthly', '2026-10-26T12:00:00+03:00', 'm2').legend).toContainEqual({ kind: 'note', text: 'Shaded area: not yet reached' });
  });

  it('adds no future wording when no interval is still to come', () => {
    const done = hours(Array(24).fill(2));
    const legend = planValueLabels(done, 'daily', '2026-10-15T00:00:00+03:00', 'm2').legend;
    expect(legend.some((l) => /later hours|not yet reached/i.test(l.text))).toBe(false);
  });

  it('distinguishes elapsed zero hours from later hours', () => {
    const legend = planValueLabels(hours([0, 0, ...Array(20).fill(3), null, null]), 'daily', '2026-10-14T21:30:00+03:00', 'm2').legend;
    expect(legend).toContainEqual({ kind: 'zero', text: 'No production' });
    expect(legend).toContainEqual({ kind: 'note', text: 'Shaded area: later hours' });
  });
});
