import { useCurrentTime } from '../../../hooks/useCurrentTime';
import { formatKuwaitShortDate, formatKuwaitTime } from '../../../lib/time';

/** Real Kuwait wall-clock time. This is not a data-freshness indicator. */
export function KuwaitClock() {
  const now = useCurrentTime();
  return (
    <div className="text-right">
      <time dateTime={now.toISOString()} className="block text-[2.5rem] leading-none font-bold text-ink">
        {formatKuwaitTime(now)}
      </time>
      <p className="mt-1.5 text-support text-ink-muted">{formatKuwaitShortDate(now)} · Kuwait</p>
    </div>
  );
}
