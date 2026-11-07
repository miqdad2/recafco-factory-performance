import type { Period, QuantityUnit } from '../../lib/dashboard/contracts';
import { formatBarValue, formatQuantity } from '../../lib/format';
import { formatKuwaitDayMonth, formatKuwaitMonthYear, formatKuwaitTime } from '../../lib/time';
import { FUTURE_LABELS, formatQuantityWithUnit } from './labels';

/** One chart interval; value null = not yet reached, 0 = elapsed with no production. */
export interface ChartBucket {
  start: string;
  end: string;
  value: number | null;
}

export interface LegendItem {
  /** emphasis = the lighter "current" bar; zero = grey baseline mark; note = plain sentence; status = data limitation. */
  kind: 'emphasis' | 'zero' | 'note' | 'status';
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

/** Fewer future intervals than this leave no room for their label inside the shading. */
export const MIN_LABELLED_FUTURE = 3;

/**
 * Value labels, emphasis and legend for one product-and-unit production series.
 * - Zero-output intervals: no number; drawn as a grey baseline mark, keyed "No production",
 *   distinct from the shaded future area ("Later hours" on Daily, "Not yet reached" otherwise).
 * - The interval that contains the demo reference time is still in progress: it is drawn
 *   in a lighter blue and named in the legend ("Selected day, to 2:00 PM"). It is never
 *   called "today" because the demo date is fixed.
 * - Daily (24), Weekly (7), Yearly (12): every productive bar is labelled.
 * - Monthly (28–31 narrow bars): only the highest bar (nothing taller beside it can
 *   collide) carries a number; the selected day is described in the legend instead.
 * - Daily without reliable times (`dayTotal`): one bar for the whole day, in the same
 *   format as the card, with "Hourly detail unavailable" stated.
 */
export function planValueLabels(
  trend: readonly ChartBucket[],
  period: Period,
  asOf: string,
  unit: QuantityUnit,
  dayTotal = false,
): ValueLabelPlan {
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
    const describe = (i: number) => `${formatKuwaitDayMonth(trend[i]!.start)} · ${formatQuantityWithUnit(trend[i]!.value ?? 0, unit)}`;
    // Only the highest bar: nothing taller beside it can collide with its label.
    texts = trend.map((b, i) => (i === peak && b.value !== null ? formatBarValue(b.value, unit) : null));
    if (emphasisIndex !== null) legend.push({ kind: 'emphasis', text: `Selected day, to ${time}: ${describe(emphasisIndex)}` });
    if (peak !== -1 && peak !== emphasisIndex) legend.push({ kind: 'note', text: `Highest day: ${describe(peak)}` });
  } else {
    const format = dayTotal ? formatQuantity : formatBarValue;
    texts = trend.map((b) => (b.value === null || b.value === 0 ? null : format(b.value, unit)));
    if (emphasisIndex !== null) {
      const start = trend[emphasisIndex]!.start;
      const text = {
        daily: dayTotal ? `Selected day, to ${time}` : `Current hour, to ${time}`,
        weekly: `Selected day, to ${time}`,
        yearly: `${formatKuwaitMonthYear(start)}, to ${formatKuwaitDayMonth(asOf)}`,
      }[period];
      legend.push({ kind: 'emphasis', text });
    }
  }

  // Too narrow a shaded area cannot hold its own label, so the key names it instead.
  const future = trend.filter((b) => b.value === null).length;
  if (future > 0 && future < MIN_LABELLED_FUTURE) legend.push({ kind: 'note', text: `Shaded area: ${FUTURE_LABELS[period].toLowerCase()}` });
  if (dayTotal) legend.unshift({ kind: 'status', text: 'Hourly detail unavailable' });
  if (trend.some((b) => b.value === 0)) legend.push({ kind: 'zero', text: 'No production' });
  return { texts, emphasisIndex, legend };
}
