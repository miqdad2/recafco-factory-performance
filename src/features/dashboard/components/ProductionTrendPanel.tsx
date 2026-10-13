import { useMemo } from 'react';
import { EChart } from '../../../components/charts/EChart';
import type { EChartsCoreOption } from '../../../components/charts/echarts';
import { Panel } from '../../../components/ui/Panel';
import { useRootFontSize } from '../../../hooks/useRootFontSize';
import type { BucketGranularity, Period, TrendBucket } from '../../../lib/dashboard/contracts';
import { formatCount } from '../../../lib/format';
import { cssVar } from '../../../styles/tokens';
import { planValueLabels, type ChartBucket, type LegendItem, type ValueLabelPlan } from '../chartLabels';
import { formatBucketLabel, PERIOD_SCOPES, TREND_INTERVAL_LABELS } from '../labels';

interface ProductionTrendPanelProps {
  /** Completed finished elements per interval, in whole pieces. */
  trend: TrendBucket[];
  total: number;
  granularity: BucketGranularity;
  period: Period;
  /** Demo reference time; identifies the in-progress interval among the buckets. */
  asOf: string;
}

const UNIT = 'pieces';

/** Axis label cadence: every other hour (Daily) or day (Monthly); every label otherwise. */
const AXIS_LABEL_INTERVAL: Record<Period, number> = { daily: 1, weekly: 0, monthly: 1, yearly: 0 };

const pieces = (n: number) => `${formatCount(n)} ${n === 1 ? 'piece' : UNIT}`;

interface OptionInput {
  labels: string[];
  buckets: ChartBucket[];
  plan: ValueLabelPlan;
  period: Period;
  rem: number;
}

function buildOption({ labels, buckets, plan, period, rem }: OptionInput): EChartsCoreOption {
  const ink = cssVar('--text-primary');
  const muted = cssVar('--text-secondary');
  const line = cssVar('--border-default');
  const emphasis = cssVar('--chart-blue-emphasis');
  const values = buckets.map((b, i) => {
    // Elapsed zero-output interval: a short grey baseline mark (barMinHeight) instead of
    // a "0" label, so it stays distinct from the empty "not yet reached" area.
    if (b.value === 0) return { value: 0, itemStyle: { color: muted } };
    if (i === plan.emphasisIndex) return { value: b.value, itemStyle: { color: emphasis } };
    return b.value;
  });
  const firstFuture = buckets.findIndex((b) => b.value === null);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fontSize = rem * 1.375;

  return {
    animation: !reduceMotion,
    animationDuration: 300,
    animationDurationUpdate: 300,
    textStyle: { fontFamily: "'Inter Variable', 'Segoe UI', sans-serif" },
    grid: { left: rem * 0.25, right: rem * 0.75, top: rem * 3, bottom: rem * 0.25, containLabel: true },
    // Supplementary detail only; essential values are printed on the chart or in the legend.
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: cssVar('--bg-raised'),
      borderColor: line,
      textStyle: { color: ink, fontSize },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? pieces(v) : 'Not yet reached'),
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: line, width: 2 } },
      axisLabel: { color: muted, fontSize, interval: AXIS_LABEL_INTERVAL[period], margin: rem * 0.75 },
    },
    yAxis: {
      type: 'value',
      name: UNIT,
      nameGap: rem * 1.25,
      nameTextStyle: { color: muted, fontSize, fontWeight: 600, align: 'left' },
      // Whole pieces only: no fractional ticks.
      minInterval: 1,
      splitNumber: 3,
      axisLabel: { color: muted, fontSize, formatter: (v: number) => formatCount(v) },
      splitLine: { lineStyle: { color: line, opacity: 0.7 } },
    },
    series: [
      {
        type: 'bar',
        name: 'Elements produced',
        data: values,
        barMaxWidth: rem * 3,
        barCategoryGap: '32%',
        // Makes zero-output intervals visible as a baseline mark; real output bars are taller.
        barMinHeight: rem * 0.375,
        itemStyle: { color: cssVar('--chart-blue'), borderRadius: [rem * 0.375, rem * 0.375, 0, 0] },
        label: {
          show: true,
          position: 'top',
          distance: rem * 0.375,
          color: ink,
          fontSize,
          fontWeight: 700,
          formatter: ({ dataIndex }: { dataIndex: number }) => plan.texts[dataIndex] ?? '',
        },
        labelLayout: { hideOverlap: true },
        markArea:
          firstFuture >= 0
            ? {
                silent: true,
                itemStyle: { color: cssVar('--bg-raised'), opacity: 0.75 },
                label: { position: 'inside', color: muted, fontSize, fontWeight: 600 },
                data: [[{ name: 'Not yet reached', xAxis: firstFuture }, { xAxis: values.length - 1 }]],
              }
            : undefined,
      },
    ],
  };
}

function describe(labels: string[], buckets: ChartBucket[], intro: string, total: number): string {
  const reached = buckets.flatMap((b, i) => (b.value === null ? [] : [`${labels[i]} ${formatCount(b.value)}`]));
  const hasFuture = buckets.some((b) => b.value === null);
  return `${intro}, total ${pieces(total)} produced: ${reached.join(', ')}.${hasFuture ? ' Later intervals not yet reached.' : ''}`;
}

function LegendSwatch({ kind }: { kind: LegendItem['kind'] }) {
  if (kind === 'emphasis') return <span aria-hidden className="inline-block size-[1rem] rounded-sm bg-chart-blue-emphasis" />;
  if (kind === 'zero') return <span aria-hidden className="inline-block h-[0.375rem] w-[1.25rem] rounded-sm bg-ink-muted" />;
  return null;
}

export function ProductionTrendPanel({ trend, total, granularity, period, asOf }: ProductionTrendPanelProps) {
  const rem = useRootFontSize();
  const buckets = useMemo<ChartBucket[]>(() => trend.map((b) => ({ start: b.start, end: b.end, value: b.pieces })), [trend]);
  const labels = useMemo(() => trend.map((b) => formatBucketLabel(b.start, granularity, period)), [trend, granularity, period]);
  const plan = useMemo(() => planValueLabels(buckets, period, asOf, UNIT), [buckets, period, asOf]);
  const option = useMemo(() => buildOption({ labels, buckets, plan, period, rem }), [labels, buckets, plan, period, rem]);
  const intro = `${TREND_INTERVAL_LABELS[granularity]} · ${PERIOD_SCOPES[period].toLowerCase()}`;

  return (
    <Panel
      title="Production Trend"
      meta={
        <>
          {intro} · total <span className="text-label font-bold text-ink">{pieces(total)}</span>
        </>
      }
    >
      <EChart
        option={option}
        ariaLabel={describe(labels, buckets, intro, total)}
        className="h-[22rem] w-full lg:h-auto lg:min-h-0 lg:flex-1"
      />
      {plan.legend.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-8 gap-y-1 text-support">
          {plan.legend.map((item) => (
            <li key={item.kind} className={`flex items-center gap-2 ${item.kind === 'zero' ? 'text-ink-muted' : 'text-ink'}`}>
              <LegendSwatch kind={item.kind} />
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
