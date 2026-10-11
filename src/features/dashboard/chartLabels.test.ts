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

describe('planValueLabels', () => {
  it('labels productive bars for Daily, Weekly and Yearly, but not zero-output or future bars', () => {
    const trend = octoberDays([12.4, 0, 30.6, null, null]);
    for (const period of ['daily', 'weekly', 'yearly'] as const) {
      const plan = planValueLabels(trend, period, AS_OF);
      expect(plan.texts).toEqual(['12', null, '31', null, null]);
      expect(plan.highlights).toEqual([]);
      expect(plan.hasZeroOutput).toBe(true);
    }
  });

  it('reports when no elapsed interval had zero output', () => {
    expect(planValueLabels(octoberDays([5, 6, null]), 'daily', AS_OF).hasZeroOutput).toBe(false);
  });

  it('leaves Monthly bars unlabelled and names the highest and selected days under the chart', () => {
    const volumes: (number | null)[] = [300, 0, 180, 320, 410.6, 330, 310, 290, 0, 200, 305, 315, 298, 152.3];
    const plan = planValueLabels(octoberDays([...volumes, ...Array(17).fill(null)]), 'monthly', AS_OF);

    expect(plan.texts.every((t) => t === null)).toBe(true);
    expect(plan.hasZeroOutput).toBe(true);
    expect(plan.highlights).toEqual([
      { index: 4, kind: 'peak', text: 'Highest day: Mon 5 Oct · 410.6 m³' },
      { index: 13, kind: 'latest', text: 'Selected day, to 14:00: Wed 14 Oct · 152.3 m³' },
    ]);
  });

  it('never calls the fixed demo date "today"', () => {
    const plan = planValueLabels(octoberDays([100, 200, 500, ...Array(28).fill(null)]), 'monthly', '2026-10-03T12:00:00+03:00');
    expect(plan.highlights).toEqual([{ index: 2, kind: 'latest', text: 'Selected day, to 12:00: Sat 3 Oct · 500 m³' }]);
    expect(JSON.stringify(plan)).not.toMatch(/today/i);
  });

  it('uses "Last day" for a completed month', () => {
    const plan = planValueLabels(octoberDays([100, 200, 50]), 'monthly', '2026-11-05T12:00:00+03:00');
    expect(plan.highlights.map((h) => h.text)).toEqual(['Highest day: Fri 2 Oct · 200 m³', 'Last day: Sat 3 Oct · 50 m³']);
  });
});
