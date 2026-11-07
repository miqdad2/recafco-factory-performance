import { useMemo } from 'react';
import { EChart } from '../../../components/charts/EChart';
import type { EChartsCoreOption } from '../../../components/charts/echarts';
import { Panel } from '../../../components/ui/Panel';
import { useRootFontSize } from '../../../hooks/useRootFontSize';
import type { Period, ProductionSeries, QuantityUnit } from '../../../lib/dashboard/contracts';
import { formatCount, formatQuantity } from '../../../lib/format';
import { cssVar } from '../../../styles/tokens';
import { MIN_LABELLED_FUTURE, planValueLabels, type ChartBucket, type LegendItem, type ValueLabelPlan } from '../chartLabels';
import type { ChosenSeries } from '../chartSeries';
import { formatBucketLabel, formatQuantityWithUnit, FUTURE_LABELS, formatSeriesName, formatUnit, PERIOD_SCOPES, TREND_INTERVAL_LABELS } from '../labels';

interface ProductionTrendPanelProps {
  /** One series per product and unit; only one is drawn at a time. */
  series: ProductionSeries[];
  period: Period;
  /** Source as-of time; identifies the in-progress interval among the buckets. */
  asOf: string;
  projectName: string;
  /** The product and unit shown; shared with Project Summary. */
  selected: ChosenSeries;
  onSelect: (series: ChosenSeries) => void;
}

/** Axis label cadence: every other hour (Daily) or day (Monthly); every label otherwise. */
const AXIS_LABEL_INTERVAL: Record<Period, number> = { daily: 1, weekly: 0, monthly: 1, yearly: 0 };

interface OptionInput {
  labels: string[];
  buckets: ChartBucket[];
  plan: ValueLabelPlan;
  period: Period;
  unit: QuantityUnit;
  rem: number;
}

function buildOption({ labels, buckets, plan, period, unit, rem }: OptionInput): EChartsCoreOption {
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
  const futureCount = buckets.filter((b) => b.value === null).length;

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
      valueFormatter: (v: unknown) => (typeof v === 'number' ? formatQuantityWithUnit(v, unit) : FUTURE_LABELS[period]),
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
      name: formatUnit(unit),
      nameGap: rem * 1.25,
      nameTextStyle: { color: muted, fontSize, fontWeight: 600, align: 'left' },
      // Whole pieces only: no fractional ticks.
      minInterval: unit === 'pieces' ? 1 : undefined,
      splitNumber: 3,
      axisLabel: { color: muted, fontSize, formatter: (v: number) => formatCount(v) },
      splitLine: { lineStyle: { color: line, opacity: 0.7 } },
    },
    series: [
      {
        type: 'bar',
        name: 'Produced',
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
          // Twelve five-digit values need a little less width to stay apart.
          fontSize: period === 'yearly' ? rem * 1.25 : fontSize,
          fontWeight: 700,
          formatter: ({ dataIndex }: { dataIndex: number }) => plan.texts[dataIndex] ?? '',
        },
        labelLayout: { hideOverlap: true },
        markArea:
          firstFuture >= 0
            ? {
                silent: true,
                itemStyle: { color: cssVar('--bg-raised'), opacity: 0.75 },
                label: { show: futureCount >= MIN_LABELLED_FUTURE, position: 'inside', color: muted, fontSize, fontWeight: 600 },
                data: [[{ name: FUTURE_LABELS[period], xAxis: firstFuture }, { xAxis: values.length - 1 }]],
              }
            : undefined,
      },
    ],
  };
}

function describe(labels: string[], buckets: ChartBucket[], name: string, intro: string, total: string, unit: QuantityUnit, period: Period): string {
  const reached = buckets.flatMap((b, i) => (b.value === null ? [] : [`${labels[i]} ${formatQuantity(b.value, unit)}`]));
  const hasFuture = buckets.some((b) => b.value === null);
  return `${name}, ${intro}, total ${total} produced: ${reached.join(', ')}.${hasFuture ? ` ${FUTURE_LABELS[period]}: not yet occurred at the reference time.` : ''}`;
}

function LegendSwatch({ kind }: { kind: LegendItem['kind'] }) {
  if (kind === 'emphasis') return <span aria-hidden className="inline-block size-[1rem] rounded-sm bg-chart-blue-emphasis" />;
  if (kind === 'zero') return <span aria-hidden className="inline-block h-[0.375rem] w-[1.25rem] rounded-sm bg-ink-muted" />;
  return null;
}

const LEGEND_TEXT: Record<LegendItem['kind'], string> = {
  emphasis: 'text-ink',
  note: 'text-ink',
  zero: 'text-ink-muted',
  status: 'font-semibold text-warning',
};

interface SeriesSelectorProps {
  series: ProductionSeries[];
  selected: string;
  onSelect: (series: ProductionSeries) => void;
}

/** Real buttons, like the period controls, so one press changes the chart. */
function SeriesSelector({ series, selected, onSelect }: SeriesSelectorProps) {
  return (
    <div role="group" aria-labelledby="trend-series-label" className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span id="trend-series-label" className="mr-1 text-support text-ink-muted">
        Product and unit
      </span>
      {series.map((s) => {
        const isSelected = s.key === selected;
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(s)}
            className={[
              'rounded-control border-2 px-3.5 py-1 text-support font-semibold whitespace-nowrap motion-safe:transition-colors motion-safe:duration-200',
              isSelected ? 'border-chart-blue bg-chart-blue text-[var(--bg-base)]' : 'border-line text-ink-muted hover:bg-raised hover:text-ink',
            ].join(' ')}
          >
            {formatSeriesName(s)}
          </button>
        );
      })}
    </div>
  );
}

function TrendChart({ series, period, asOf }: { series: ProductionSeries; period: Period; asOf: string }) {
  const rem = useRootFontSize();
  const { trend, granularity, unit } = series;
  const dayTotal = series.hourlyDetail === 'unavailable';
  const buckets = useMemo<ChartBucket[]>(() => trend.map((b) => ({ start: b.start, end: b.end, value: b.quantity })), [trend]);
  const labels = useMemo(() => trend.map((b) => formatBucketLabel(b.start, granularity, period)), [trend, granularity, period]);
  const plan = useMemo(() => planValueLabels(buckets, period, asOf, unit, dayTotal), [buckets, period, asOf, unit, dayTotal]);
  const option = useMemo(() => buildOption({ labels, buckets, plan, period, unit, rem }), [labels, buckets, plan, period, unit, rem]);
  const intro = `${dayTotal ? 'Day total' : TREND_INTERVAL_LABELS[granularity]} · ${PERIOD_SCOPES[period].toLowerCase()}`;

  return (
    <>
      <EChart
        option={option}
        ariaLabel={describe(labels, buckets, formatSeriesName(series), intro, formatQuantityWithUnit(series.total, unit), unit, period)}
        className="h-[22rem] w-full lg:h-auto lg:min-h-0 lg:flex-1"
      />
      {plan.legend.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-8 gap-y-1 text-support">
          {plan.legend.map((item) => (
            <li key={item.kind} className={`flex items-center gap-2 ${LEGEND_TEXT[item.kind]}`}>
              <LegendSwatch kind={item.kind} />
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ProductionTrendPanel({ series, period, asOf, projectName, selected, onSelect }: ProductionTrendPanelProps) {
  // The choice survives project and period changes: figures and chart always derive
  // from this one series, and it never silently switches to another product.
  const shown = series.find((s) => s.key === selected.key);
  const hasOutput = shown !== undefined && shown.total > 0;
  const scope = PERIOD_SCOPES[period].toLowerCase();

  return (
    <Panel
      title="Production Trend"
      meta={
        <>
          {projectName} · {shown ? `${shown.hourlyDetail === 'unavailable' ? 'Day total' : TREND_INTERVAL_LABELS[shown.granularity]} · ${scope}` : scope}
          {shown && (
            <>
              {' '}
              · total <span className="text-label font-bold text-ink">{formatQuantityWithUnit(shown.total, shown.unit)}</span>
            </>
          )}
        </>
      }
    >
      <SeriesSelector series={series} selected={selected.key} onSelect={(s) => onSelect({ key: s.key, name: formatSeriesName(s) })} />
      {hasOutput ? (
        <TrendChart series={shown} period={period} asOf={asOf} />
      ) : (
        <p role="note" className="flex min-h-[10rem] flex-1 items-center justify-center rounded-control bg-raised/60 px-6 text-center text-panel font-semibold text-ink">
          No {selected.name} production recorded for {projectName} in the {scope}.
        </p>
      )}
    </Panel>
  );
}
