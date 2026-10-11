import { describe, expect, it } from 'vitest';
import type { TrendBucket } from '../../lib/dashboard/contracts';
import { planValueLabels } from './chartLabels';

const AS_OF = '2026-10-14T14:00:00+03:00';

/** Daily buckets for October 2026 with the given volumes (null = future). */
function octoberDays(volumes: (number | null)[]): TrendBucket[] {
  return volumes.map((volume, i) => {
    const day = String(i + 1).padStart(2, '0');
    const next = String(i + 2).padStart(2, '0');
    return { start: `2026-10-${day}T00:00:00+03:00`, end: `2026-10-${next}T00:00:00+03:00`, volume };
  });
}

/** Hourly buckets for 14 Oct 2026. */
function hours(volumes: (number | null)[]): TrendBucket[] {
  return volumes.map((volume, h) => ({
    start: `2026-10-14T${String(h).padStart(2, '0')}:00:00+03:00`,
    end: new Date(Date.parse(`2026-10-14T00:00:00+03:00`) + (h + 1) * 3_600_000).toISOString(),
    volume,
  }));
}

describe('planValueLabels', () => {
  it('labels productive bars, never zero-output or future bars', () => {
    const plan = planValueLabels(octoberDays([12.4, 0, 30.6, null, null]), 'weekly', '2026-10-06T00:00:00+03:00');
    expect(plan.texts).toEqual(['12', null, '31', null, null]);
    expect(plan.legend).toEqual([{ kind: 'zero', text: 'No production' }]);
  });

  it('emphasises the day containing the demo reference time in Weekly and calls it "Selected day"', () => {
    // 11–14 Oct elapsed; 14 Oct is in progress at 2:00 PM.
    const plan = planValueLabels(octoberDays([363, 298, 330, 152.3, null, null, null]).slice(0), 'weekly', '2026-10-04T14:00:00+03:00');
    expect(plan.emphasisIndex).toBe(3);
    expect(plan.legend).toContainEqual({ kind: 'emphasis', text: 'Selected day, to 2:00 PM' });
    expect(JSON.stringify(plan)).not.toMatch(/today/i);
  });

  it('does not emphasise a Daily hour that starts exactly at the reference time', () => {
    const plan = planValueLabels(hours([5, 6, ...Array(12).fill(10), ...Array(10).fill(null)]), 'daily', AS_OF);
    expect(plan.emphasisIndex).toBeNull();
    expect(plan.legend).toEqual([]);
  });

  it('emphasises a partly elapsed Daily hour', () => {
    const plan = planValueLabels(hours([...Array(14).fill(10), 4, ...Array(9).fill(null)]), 'daily', '2026-10-14T14:30:00+03:00');
    expect(plan.emphasisIndex).toBe(14);
    expect(plan.legend).toContainEqual({ kind: 'emphasis', text: 'Current hour, to 2:30 PM' });
  });

  it('labels only the highest day in Monthly and describes the selected and highest days under the chart', () => {
    const volumes: (number | null)[] = [300, 0, 180, 320, 410.6, 330, 310, 290, 0, 200, 305, 315, 298, 152.3];
    const plan = planValueLabels(octoberDays([...volumes, ...Array(17).fill(null)]), 'monthly', AS_OF);

    expect(plan.texts.flatMap((t, i) => (t === null ? [] : [[i, t]]))).toEqual([[4, '411']]);
    expect(plan.emphasisIndex).toBe(13);
    expect(plan.legend).toEqual([
      { kind: 'emphasis', text: 'Selected day, to 2:00 PM: Wed 14 Oct · 152.3 m³' },
      { kind: 'note', text: 'Highest day: Mon 5 Oct · 410.6 m³' },
      { kind: 'zero', text: 'No production' },
    ]);
  });

  it('names a completed month by its highest day only', () => {
    const plan = planValueLabels(octoberDays([100, 200, 50]), 'monthly', '2026-11-05T12:00:00+03:00');
    expect(plan.emphasisIndex).toBeNull();
    expect(plan.legend).toEqual([{ kind: 'note', text: 'Highest day: Fri 2 Oct · 200 m³' }]);
  });

  it('emphasises the current month in Yearly with a month-to-date description', () => {
    const months: TrendBucket[] = Array.from({ length: 12 }, (_, i) => ({
      start: `2026-${String(i + 1).padStart(2, '0')}-01T00:00:00+03:00`,
      end: i === 11 ? '2027-01-01T00:00:00+03:00' : `2026-${String(i + 2).padStart(2, '0')}-01T00:00:00+03:00`,
      volume: i < 9 ? 6800 : i === 9 ? 3406.8 : null,
    }));
    const plan = planValueLabels(months, 'yearly', AS_OF);
    expect(plan.emphasisIndex).toBe(9);
    expect(plan.legend).toEqual([{ kind: 'emphasis', text: 'October 2026, to Wed 14 Oct' }]);
  });
});
