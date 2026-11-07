import { useId } from 'react';
import type { ConcreteOutput, Period } from '../../../lib/dashboard/contracts';
import { formatVolume } from '../../../lib/format';
import { formatKuwaitDateOnly } from '../../../lib/time';
import { NOT_AVAILABLE, PERIOD_SCOPES } from '../labels';

interface ConcreteOutputPanelProps {
  concrete: ConcreteOutput;
  period: Period;
  /** True while the rest of the screen shows one project. */
  projectFiltered: boolean;
}

function Figure({ label, value, sizeClass }: { label: string; value: number | null; sizeClass: string }) {
  return (
    <div className="min-w-0">
      <p className="text-support whitespace-nowrap text-ink-muted">{label}</p>
      {value === null ? (
        <p className="text-panel font-semibold text-ink-muted">{NOT_AVAILABLE}</p>
      ) : (
        <p className="leading-none whitespace-nowrap">
          <span className={`${sizeClass} leading-none font-bold tracking-tight text-ink`}>{formatVolume(value)}</span>{' '}
          <span className="text-[1.5rem] font-semibold text-ink-muted">m³</span>
        </p>
      )}
    </div>
  );
}

/**
 * Batching-plant output only, a separate measure from element quantities. Batches
 * carry no project reference, so this always covers All Projects, and says so plainly
 * while a project is selected elsewhere on the screen. A compact band: the title and its
 * scope on one line, the two labelled figures beneath. The month-to-date label names its
 * cutoff date in full, and the figures wrap rather than clip if a screen is too narrow.
 */
export function ConcreteOutputPanel({ concrete, period, projectFiltered }: ConcreteOutputPanelProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-y-1.5 rounded-panel border border-line bg-surface px-6 py-3 shadow-panel">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id={titleId} className="text-panel font-semibold whitespace-nowrap text-ink">
          Concrete Output
        </h2>
        <p className="text-support text-ink-muted">
          <span className="font-semibold text-ink">All Projects</span> · {projectFiltered ? 'not filtered by project' : 'batch plant'}
        </p>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <Figure label={PERIOD_SCOPES[period]} value={concrete.periodOutput} sizeClass="text-[2.5rem]" />
        <div className="text-right">
          <Figure label={`Month to date · through ${formatKuwaitDateOnly(concrete.monthToDateThrough)}`} value={concrete.monthToDate} sizeClass="text-row" />
        </div>
      </div>
    </section>
  );
}
