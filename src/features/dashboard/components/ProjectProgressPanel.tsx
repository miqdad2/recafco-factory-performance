import { useId } from 'react';
import { Panel } from '../../../components/ui/Panel';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import type { ProjectProgress } from '../../../lib/dashboard/contracts';
import { formatWholePercent } from '../../../lib/format';

export function ProjectProgressPanel({ projects }: { projects: ProjectProgress[] }) {
  const basisId = useId();
  const basis = projects[0]?.basis;
  return (
    <Panel title="Active Projects" meta="Delivery progress · demo">
      {/* Calculation basis for assistive technology; documented in fixtures/README.md. */}
      {basis && (
        <p id={basisId} className="sr-only">
          Progress basis: {basis}.
        </p>
      )}
      <ul aria-describedby={basis ? basisId : undefined} className="grid flex-1 grid-cols-1 content-around gap-x-10 gap-y-6 md:grid-cols-2">
        {projects.map((p) => (
          <li key={p.code} className="min-w-0">
            {/* Code on its own line so long names never push it into an uneven wrap. */}
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-label font-semibold text-ink">{p.name}</p>
                <p className="text-support font-medium text-ink-muted">{p.code}</p>
              </div>
              <p className="text-[1.75rem] leading-tight font-bold text-ink">{formatWholePercent(p.percentComplete)}</p>
            </div>
            <div className="mt-2">
              <ProgressBar percent={p.percentComplete} colorClass="bg-chart-blue" label={`${p.name} delivery progress`} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
