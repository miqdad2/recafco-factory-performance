import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { DashboardSnapshot, Period } from '../../lib/dashboard/contracts';
import type { SnapshotRequest } from '../../lib/dashboard/provider';
import { ALL_PROJECTS } from '../../lib/dashboard/projects';
import { useDashboardDataProvider } from './dataProvider';
import { snapshotQueryOptions } from './snapshotQuery';

export type ViewSelection = SnapshotRequest;

const sameView = (a: ViewSelection, b: ViewSelection) => a.period === b.period && a.project === b.project;

export type DashboardSelection =
  | { status: 'loading'; requested: ViewSelection }
  | { status: 'error'; requested: ViewSelection; error: unknown; retry: () => void }
  | {
      status: 'ready';
      /** The period and project the user asked for most recently. */
      requested: ViewSelection;
      /** The last successfully loaded snapshot; it carries its own period, project and range. */
      snapshot: DashboardSnapshot;
      /** Set while `requested` differs from the displayed view and is loading. */
      pending: ViewSelection | null;
      /** Set when `requested` failed; the displayed snapshot stays unchanged. */
      failure: { selection: ViewSelection; error: unknown; retry: () => void } | null;
      selectPeriod: (period: Period) => void;
      selectProject: (project: string) => void;
    };

/**
 * Separates the requested view from the displayed one.
 * - The screen keeps the last successful snapshot (with its own labels) while
 *   another period or project loads, or after it fails.
 * - A requested view becomes the displayed one only once its validated snapshot
 *   exists, so figures, chart, project name and range change together.
 * - Only the latest request can be committed: the query follows `requested`,
 *   and obsolete requests are cancelled through their AbortSignal.
 */
export function useDashboardSelection(initialPeriod: Period = 'daily'): DashboardSelection {
  const provider = useDashboardDataProvider();
  const [requested, setRequested] = useState<ViewSelection>({ period: initialPeriod, project: ALL_PROJECTS });
  const [displayed, setDisplayed] = useState<ViewSelection>(requested);

  const requestedQuery = useQuery(snapshotQueryOptions(provider, requested));
  // Commit during render (React's "adjust state when props change" pattern):
  // no intermediate frame shows new labels with old figures.
  if (requestedQuery.isSuccess && !sameView(displayed, requested)) setDisplayed(requested);

  // Keeps the displayed snapshot subscribed in the cache. Same entry as the
  // requested query once committed; never refetches (staleTime: Infinity).
  const displayedQuery = useQuery(snapshotQueryOptions(provider, displayed));

  const selectPeriod = useCallback((period: Period) => setRequested((view) => ({ ...view, period })), []);
  const selectProject = useCallback((project: string) => setRequested((view) => ({ ...view, project })), []);
  const { refetch } = requestedQuery;
  const retry = useCallback(() => void refetch(), [refetch]);

  const snapshot = displayedQuery.data;
  if (!snapshot) {
    return requestedQuery.isError
      ? { status: 'error', requested, error: requestedQuery.error, retry }
      : { status: 'loading', requested };
  }

  const shown: ViewSelection = { period: snapshot.selectedPeriod, project: snapshot.selectedProject.key };
  const waiting = !sameView(requested, shown);
  return {
    status: 'ready',
    requested,
    snapshot,
    pending: waiting && requestedQuery.isPending ? requested : null,
    failure: waiting && requestedQuery.isError ? { selection: requested, error: requestedQuery.error, retry } : null,
    selectPeriod,
    selectProject,
  };
}
