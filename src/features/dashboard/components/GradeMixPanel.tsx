import { Panel } from '../../../components/ui/Panel';
import type { GradeVolume, Period } from '../../../lib/dashboard/contracts';
import { formatVolume } from '../../../lib/format';
import { PERIOD_SCOPES } from '../labels';

interface GradeMixPanelProps {
  grades: GradeVolume[];
  total: number;
  period: Period;
}

export function GradeMixPanel({ grades, total, period }: GradeMixPanelProps) {
  // Bar lengths are relative to the largest grade so differences stay visible.
  const largest = Math.max(0, ...grades.map((g) => g.volume));

  return (
    <Panel title="Production by Concrete Grade" meta={`${PERIOD_SCOPES[period]} · m³`}>
      <ul
        aria-label={`Total ${formatVolume(total)} cubic metres`}
        className="flex flex-1 flex-col justify-around gap-1.5"
      >
        {grades.map((g) => (
          // Columns fit "Other grades" and Yearly figures such as "21,594.2 m³".
          <li key={g.grade} className="grid grid-cols-[9.5rem_1fr_9.5rem] items-center gap-4">
            <span className="text-label font-semibold text-ink">{g.grade}</span>
            <span className="h-[1.375rem] overflow-hidden rounded-md bg-raised">
              <span
                className="block h-full rounded-md bg-chart-blue motion-safe:transition-[width] motion-safe:duration-300"
                style={{ width: largest > 0 ? `${(g.volume / largest) * 100}%` : '0%' }}
              />
            </span>
            <span className="text-right text-label font-bold text-ink">
              {formatVolume(g.volume)} <span className="text-support font-semibold text-ink-muted">m³</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
