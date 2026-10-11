import type { RefObject } from 'react';
import { PERIODS, type Period } from '../../../lib/dashboard/contracts';
import { PERIOD_LABELS } from '../labels';

interface PeriodControlsProps {
  /** The period the user chose (aria-pressed). */
  requested: Period;
  /** The period whose figures are on screen; null before the first load. */
  displayed: Period | null;
  /** Whether the requested period is still loading or has failed. */
  requestState: 'settled' | 'loading' | 'failed';
  onSelect?: (period: Period) => void;
  /** Before the first successful load the buttons cannot be used. */
  disabled?: boolean;
  buttonRefs?: RefObject<Partial<Record<Period, HTMLButtonElement | null>>>;
}

/**
 * Four real buttons. Buttons are never disabled while data changes, so
 * keyboard focus stays where it is.
 * - Requested and shown: solid red fill.
 * - Requested but loading or failed: red outline with "…" or "!" after the name.
 * - Still shown while another period loads: raised fill.
 */
export function PeriodControls({ requested, displayed, requestState, onSelect, disabled, buttonRefs }: PeriodControlsProps) {
  return (
    <div role="group" aria-label="Reporting period" className="flex gap-2 rounded-panel border border-line bg-surface p-1.5">
      {PERIODS.map((period) => {
        const isRequested = period === requested;
        const isDisplayed = period === displayed;
        const waiting = isRequested && requestState !== 'settled';
        const marker = waiting ? (requestState === 'loading' ? '…' : ' !') : '';
        return (
          <button
            key={period}
            ref={(el) => {
              if (buttonRefs) buttonRefs.current[period] = el;
            }}
            type="button"
            aria-pressed={isRequested}
            disabled={disabled}
            onClick={() => onSelect?.(period)}
            className={[
              'min-w-[7.5rem] rounded-control px-5 py-2.5 text-label font-semibold whitespace-nowrap motion-safe:transition-colors motion-safe:duration-200 disabled:cursor-not-allowed',
              isRequested && !waiting
                ? 'bg-accent text-white'
                : waiting
                  ? 'text-ink shadow-[inset_0_0_0_0.1875rem_var(--accent-primary)]'
                  : isDisplayed
                    ? 'bg-raised text-ink'
                    : 'text-ink-muted hover:bg-raised hover:text-ink',
            ].join(' ')}
          >
            {PERIOD_LABELS[period]}
            <span aria-hidden>{marker}</span>
          </button>
        );
      })}
    </div>
  );
}
