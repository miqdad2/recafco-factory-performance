import { useCurrentTime } from '../../../hooks/useCurrentTime';
import { formatKuwaitShortDate, formatKuwaitTime } from '../../../lib/time';

/**
 * Real wall-clock time (Asia/Kuwait, 12-hour). Labelled "Current time" so it is
 * never mistaken for the fixed demo-data date, and never a data-freshness signal.
 */
export function KuwaitClock() {
  const now = useCurrentTime();
  return (
    <div className="text-right">
      <p className="text-support leading-tight text-ink-muted">Current time</p>
      <time dateTime={now.toISOString()} className="block text-[2.5rem] leading-[1.1] font-bold text-ink">
        {formatKuwaitTime(now)}
      </time>
      <p className="text-support leading-tight text-ink-muted">{formatKuwaitShortDate(now)}</p>
    </div>
  );
}
