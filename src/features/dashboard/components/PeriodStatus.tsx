interface PeriodStatusProps {
  /** Range of the figures on screen, e.g. "Wed 14 Oct 2026". */
  shownRange: string | null;
  /** Plain status text when nothing is shown yet ("Loading demo data…"). */
  message?: string;
  pendingLabel?: string | null;
  failure?: { text: string; onRetry: () => void } | null;
}

/**
 * Line under the period buttons. A polite live region announces what is shown,
 * loading and failures; the live clock is deliberately outside it.
 * Reserves its height so the layout does not jump when a retry button appears.
 */
export function PeriodStatus({ shownRange, message, pendingLabel, failure }: PeriodStatusProps) {
  return (
    <div className="flex min-h-[2.5rem] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-label text-ink-muted">
      <p role="status" aria-live="polite" aria-atomic="true">
        {shownRange ? (
          <>
            Showing <span className="font-semibold text-ink">{shownRange}</span>
          </>
        ) : (
          <span className="font-semibold text-ink">{message}</span>
        )}
        {pendingLabel && (
          <>
            {' · '}
            <span className="font-semibold text-warning">Loading {pendingLabel}…</span>
          </>
        )}
        {failure && (
          <>
            {' · '}
            <span className="font-semibold text-error">{failure.text}</span>
          </>
        )}
      </p>
      {failure && (
        <button
          type="button"
          onClick={failure.onRetry}
          className="rounded-control border-2 border-error px-4 py-0.5 font-semibold text-ink hover:bg-raised"
        >
          Try again
        </button>
      )}
    </div>
  );
}
