import type { Period } from '../../lib/dashboard/contracts';
import { formatCount } from '../../lib/format';
import { formatKuwaitDayMonth, formatKuwaitMonthYear, formatKuwaitTime } from '../../lib/time';

/** One chart interval; value null = not yet reached, 0 = elapsed with no production. */
export interface ChartBucket {
  start: string;
  end: string;
  value: number | null;
}

export interface LegendItem {
  /** emphasis = the lighter "current" bar; zero = grey baseline mark; note = plain sentence. */
  kind: 'emphasis' | 'zero' | 'note';
  text: string;
}

export interface ValueLabelPlan {
  /** Text above each bar; null = no label (future, zero output, or not enough room). */
  texts: (string | null)[];
  /** Bucket containing the demo reference time (selected day, current month…), drawn lighter. */
  emphasisIndex: number | null;
  /** Readable key under the chart. */
  legend: LegendItem[];
}

/**
 * Value labels, emphasis and legend for the production trend (whole pieces).
 * - Zero-output intervals: no number; drawn as a grey baseline mark, keyed "No production",
 *   distinct from the shaded "Not yet reached" area.
 * - The interval that contains the demo reference time is still in progress: it is drawn
 *   in a lighter blue and named in the legend ("Selected day, to 2:00 PM"). It is never
 *   called "today" because the demo date is fixed.
 * - Daily (24), Weekly (7), Yearly (12): every productive bar is labelled.
 * - Monthly (28–31 narrow bars): only the highest bar (nothing taller beside it can
 *   collide) carries a number; the selected day is described in the legend instead.
 */
export function planValueLabels(trend: readonly ChartBucket[], period: Period, asOf: string, unit: string): ValueLabelPlan {
  const asOfMs = Date.parse(asOf);
  const emphasis = trend.findIndex((b) => b.value !== null && Date.parse(b.start) < asOfMs && asOfMs < Date.parse(b.end));
  const emphasisIndex = emphasis === -1 ? null : emphasis;
  const time = formatKuwaitTime(asOf);
  const legend: LegendItem[] = [];
  let texts: (string | null)[];

  if (period === 'monthly') {
    let peak = -1;
    trend.forEach((b, i) => {
      if (b.value !== null && b.value > 0 && (peak === -1 || b.value > trend[peak]!.value!)) peak = i;
    });
    const describe = (i: number) => `${formatKuwaitDayMonth(trend[i]!.start)} · ${formatCount(trend[i]!.value ?? 0)} ${unit}`;
    // Only the highest bar: nothing taller beside it can collide with its label.
    texts = trend.map((b, i) => (i === peak && b.value !== null ? formatCount(b.value) : null));
    if (emphasisIndex !== null) legend.push({ kind: 'emphasis', text: `Selected day, to ${time}: ${describe(emphasisIndex)}` });
    if (peak !== -1 && peak !== emphasisIndex) legend.push({ kind: 'note', text: `Highest day: ${describe(peak)}` });
  } else {
    texts = trend.map((b) => (b.value === null || b.value === 0 ? null : formatCount(b.value)));
    if (emphasisIndex !== null) {
      const start = trend[emphasisIndex]!.start;
      const text = {
        daily: `Current hour, to ${time}`,
        weekly: `Selected day, to ${time}`,
        yearly: `${formatKuwaitMonthYear(start)}, to ${formatKuwaitDayMonth(asOf)}`,
      }[period];
      legend.push({ kind: 'emphasis', text });
    }
  }

  if (trend.some((b) => b.value === 0)) legend.push({ kind: 'zero', text: 'No production' });
  return { texts, emphasisIndex, legend };
}
