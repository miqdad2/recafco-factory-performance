interface PeriodStatusProps {
  /** Project of the figures on screen, e.g. "All Projects". */
  shownProject: string;
  /** Range of the figures on screen, e.g. "Wed 14 Oct 2026". */
  shownRange: string;
  /** What is loading, named by what changed. */
  pendingLabel?: string | null;
  failure?: { text: string; onRetry: () => void } | null;
}

/** Two status lines at 22px; shared with the loading screen so the header never changes height. */
export const STATUS_HEIGHT = 'min-h-[4.25rem]';

/**
 * Lines under the controls. A polite live region announces what is shown, loading and
 * failures; the live clock is deliberately outside it. The second line is always
 * reserved, so a loading or failure message never moves the dashboard. A long project
 * name ends in an ellipsis on screen; the full name stays in the text that is announced,
 * and in the selector and Project Summary.
 */
export function PeriodStatus({ shownProject, shownRange, pendingLabel, failure }: PeriodStatusProps) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className={`flex w-full flex-col items-center text-label text-ink-muted ${STATUS_HEIGHT}`}>
      <span className="flex max-w-full items-baseline gap-x-2 whitespace-nowrap">
        <span className="shrink-0">Showing </span>
        <span title={shownProject} className="truncate font-semibold text-ink">
          {shownProject}
        </span>
        <span className="shrink-0">
          {' · '}
          <span className="font-semibold text-ink">{shownRange}</span>
        </span>
      </span>
      <span className="flex min-h-[2.375rem] max-w-full items-center gap-x-3 whitespace-nowrap">
        {pendingLabel && <span className="truncate font-semibold text-warning">Loading {pendingLabel}…</span>}
        {failure && (
          <>
            <span title={failure.text} className="truncate font-semibold text-error">
              {failure.text}
            </span>
            <button
              type="button"
              onClick={failure.onRetry}
              className="shrink-0 rounded-control border-2 border-error px-4 py-0.5 font-semibold text-ink hover:bg-raised"
            >
              Retry
            </button>
          </>
        )}
      </span>
    </p>
  );
}
