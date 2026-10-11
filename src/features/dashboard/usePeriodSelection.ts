import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { DashboardSnapshot, Period } from '../../lib/dashboard/contracts';
import { useDashboardDataProvider } from './dataProvider';
import { snapshotQueryOptions } from './snapshotQuery';

export type PeriodSelection =
  | { status: 'loading'; requested: Period }
  | { status: 'error'; requested: Period; error: unknown; retry: () => void }
  | {
      status: 'ready';
      /** The period the user asked for most recently. */
      requested: Period;
      /** The last successfully loaded snapshot; it carries its own period and range. */
      snapshot: DashboardSnapshot;
      /** Set while `requested` differs from the displayed period and is loading. */
      pending: Period | null;
      /** Set when `requested` failed; the displayed snapshot stays unchanged. */
      failure: { period: Period; error: unknown; retry: () => void } | null;
      select: (period: Period) => void;
    };

/**
 * Separates the requested period from the displayed one.
 * - The screen keeps the last successful snapshot (with its own labels) while
 *   another period loads or after it fails.
 * - A requested period becomes the displayed one only once its validated
 *   snapshot exists, so figures, range and labels change together.
 * - Only the latest request can be committed: the query follows `requested`,
 *   and obsolete requests are cancelled through their AbortSignal.
 */
export function usePeriodSelection(initial: Period = 'daily'): PeriodSelection {
  const provider = useDashboardDataProvider();
  const [requested, setRequested] = useState<Period>(initial);
  const [displayed, setDisplayed] = useState<Period>(initial);

  const requestedQuery = useQuery(snapshotQueryOptions(provider, requested));
  // Commit during render (React's "adjust state when props change" pattern):
  // no intermediate frame shows new labels with old figures.
  if (requestedQuery.isSuccess && displayed !== requested) setDisplayed(requested);

  // Keeps the displayed snapshot subscribed in the cache. Same entry as the
  // requested query once committed; never refetches (staleTime: Infinity).
  const displayedQuery = useQuery(snapshotQueryOptions(provider, displayed));

  const select = useCallback((period: Period) => setRequested(period), []);
  const { refetch } = requestedQuery;
  const retry = useCallback(() => void refetch(), [refetch]);

  const snapshot = displayedQuery.data;
  if (!snapshot) {
    return requestedQuery.isError
      ? { status: 'error', requested, error: requestedQuery.error, retry }
      : { status: 'loading', requested };
  }

  const waiting = requested !== snapshot.selectedPeriod;
  return {
    status: 'ready',
    requested,
    snapshot,
    pending: waiting && requestedQuery.isPending ? requested : null,
    failure:
      waiting && requestedQuery.isError
        ? { period: requested, error: requestedQuery.error, retry }
        : null,
    select,
  };
}
