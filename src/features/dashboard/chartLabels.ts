import type { Period, TrendBucket } from '../../lib/dashboard/contracts';
import { formatVolume } from '../../lib/format';
import { formatKuwaitDayMonth, formatKuwaitTime } from '../../lib/time';

export interface TrendHighlight {
  index: number;
  kind: 'peak' | 'latest';
  /** Readable sentence shown under the chart, e.g. "Highest day: Sun 11 Oct · 362.7 m³". */
  text: string;
}

export interface ValueLabelPlan {
  /** Text above each bar; null = no label (future, zero output, or not enough room). */
  texts: (string | null)[];
  /** Bars picked out with their own colour and a sentence under the chart (Monthly only). */
  highlights: TrendHighlight[];
  /** Whether any elapsed interval had zero output (drawn as a grey baseline mark). */
  hasZeroOutput: boolean;
}

/**
 * Which bars carry a value label.
 * - Zero-output intervals get no number; the chart draws them as a grey baseline
 *   mark (distinct from the empty "not yet reached" area) and a legend explains it.
 * - Daily (24), Weekly (7) and Yearly (12): every productive bar is labelled.
 * - Monthly (28–31 bars): a value wider than its bar would overlap neighbours, so
 *   bars are unlabelled and the highest day and the selected (latest) day are
 *   coloured and described in a sentence under the chart.
 * The latest day is the fixed demo reference date, so it is called "Selected day",
 * never "today".
 */
export function planValueLabels(trend: readonly TrendBucket[], period: Period, asOf: string): ValueLabelPlan {
  const hasZeroOutput = trend.some((b) => b.volume === 0);
  if (period !== 'monthly') {
    return {
      texts: trend.map((b) => (b.volume === null || b.volume === 0 ? null : formatVolume(b.volume, 0))),
      highlights: [],
      hasZeroOutput,
    };
  }

  let peak = -1;
  let latest = -1;
  trend.forEach((b, i) => {
    if (b.volume === null) return;
    latest = i;
    if (b.volume > 0 && (peak === -1 || b.volume > trend[peak]!.volume!)) peak = i;
  });

  const highlights: TrendHighlight[] = [];
  const describe = (i: number) => `${formatKuwaitDayMonth(trend[i]!.start)} · ${formatVolume(trend[i]!.volume ?? 0)} m³`;
  if (peak !== -1 && peak !== latest) highlights.push({ index: peak, kind: 'peak', text: `Highest day: ${describe(peak)}` });
  if (latest !== -1) {
    const inProgress = Date.parse(trend[latest]!.end) > Date.parse(asOf);
    const name = inProgress ? `Selected day, to ${formatKuwaitTime(asOf)}` : 'Last day';
    highlights.push({ index: latest, kind: 'latest', text: `${name}: ${describe(latest)}` });
  }

  return { texts: trend.map(() => null), highlights, hasZeroOutput };
}
