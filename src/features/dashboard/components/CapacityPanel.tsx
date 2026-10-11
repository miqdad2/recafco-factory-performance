import { SemicircleGauge } from '../../../components/charts/SemicircleGauge';
import { Panel } from '../../../components/ui/Panel';
import type { MonthlyCapacity } from '../../../lib/dashboard/contracts';
import { formatPercent, formatVolume } from '../../../lib/format';
import { formatMonth } from '../../../lib/time';

/** A capacity figure in m³, or a plain word when the value does not exist. */
function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-support text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[1.75rem] leading-tight font-bold whitespace-nowrap text-ink">
        {value === null ? (
          <span className="text-ink-muted">Not set</span>
        ) : (
          <>
            {formatVolume(value)} <span className="text-support font-semibold text-ink-muted">m³</span>
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * Always the month containing the demo reference time, whatever period is selected.
 * The gauge takes all spare height; actual output, capacity and remaining sit in three
 * aligned columns beneath it. Turquoise is neutral: no good/bad colouring without
 * agreed business thresholds.
 */
export function CapacityPanel({ capacity }: { capacity: MonthlyCapacity }) {
  const { percentUsed, plannedCapacity, actualOutput, remaining } = capacity;
  const overCapacity = remaining !== null && remaining < 0;
  const caption = percentUsed === null ? 'capacity not set' : overCapacity ? 'over capacity' : 'used, month to date';

  return (
    <Panel
      title="Monthly Plant Capacity"
      meta={formatMonth(capacity.month)}
      subtitle={`Concrete batch plant${capacity.basis === 'illustrative-demo' ? ' · illustrative' : ''}`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-[14rem] min-w-0 lg:h-auto lg:min-h-[8rem] lg:flex-1">
          <SemicircleGauge
            percent={percentUsed}
            valueText={percentUsed === null ? 'Not available' : formatPercent(percentUsed)}
            caption={caption}
            trackColor="var(--bg-raised)"
            fillColor="var(--chart-teal)"
          />
        </div>

        <dl className="mt-2 grid grid-cols-3 gap-4 border-t border-line pt-2.5">
          <Figure label="Actual output" value={actualOutput} />
          <Figure label="Capacity" value={plannedCapacity} />
          <Figure label={overCapacity ? 'Above capacity' : 'Remaining'} value={remaining === null ? null : Math.abs(remaining)} />
        </dl>
      </div>
    </Panel>
  );
}
