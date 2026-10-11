import type { DataSource } from '../../../lib/dashboard/contracts';
import { formatDataAsOf } from '../labels';

interface DashboardFooterProps {
  source: DataSource;
  /** Time the figures refer to (demo reference timestamp); null before the first load. */
  sourceDataAsOf: string | null;
  /** When the display last loaded data successfully; null before the first success. */
  fetchedAt: string | null;
}

/**
 * Three distinct facts: the data source, the time the figures refer to, and when
 * the display last loaded them. Panel-level "illustrative"/"demo" notes cover
 * capacity and projects, so they are not repeated here.
 */
export function DashboardFooter({ source, sourceDataAsOf, fetchedAt }: DashboardFooterProps) {
  const isDemo = source === 'demo';

  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-10 gap-y-2 text-support text-ink-muted">
      <p>
        <span className="font-semibold text-warning">{isDemo ? 'Demo data' : 'SAP data'}</span>
        {isDemo && ' · SAP not connected'}
      </p>
      {sourceDataAsOf && (
        <p>
          {isDemo ? 'Demo reference time: ' : 'Data as of: '}
          <span className="font-semibold text-ink">{formatDataAsOf(sourceDataAsOf)}</span>
        </p>
      )}
      <p>
        {isDemo ? 'Last successful demo load: ' : 'Last successful update: '}
        <span className="font-semibold text-ink">{fetchedAt ? formatDataAsOf(fetchedAt) : 'none yet'}</span>
      </p>
    </footer>
  );
}
