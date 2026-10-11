interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  /** "Demo snapshot" for current snapshots, or the period ("Selected day") for period totals. */
  scope: string;
  scopeKind: 'snapshot' | 'period';
  /** Optional extra fact, e.g. the snapshot time or delivery-note count. */
  caption?: string;
}

/** Values longer than this (e.g. "66,197.9") step down so they never truncate. */
const LONG_VALUE_CHARS = 6;

/**
 * Headline figure card. The number is the strongest element; the unit sits on its
 * baseline; the scope chip says whether it is a demo snapshot or a period total.
 * Strip colour: neutral slate for snapshots, production blue for period output.
 */
export function KpiCard({ label, value, unit, scope, scopeKind, caption }: KpiCardProps) {
  const stripe = scopeKind === 'snapshot' ? 'bg-accent-snapshot' : 'bg-chart-blue';
  const valueSize = value.length > LONG_VALUE_CHARS ? 'text-kpi-long' : 'text-kpi';
  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface py-3.5 pr-6 pl-8 shadow-panel">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${stripe}`} />
      <h2 className="text-panel font-semibold text-ink">{label}</h2>
      {/* Fixed-height figure row keeps numbers and units aligned across all four cards. */}
      <div className="flex h-[4.75rem] items-end">
        <p className="flex items-baseline gap-x-3 whitespace-nowrap">
          <span className={`${valueSize} font-bold tracking-tight text-ink`}>
            {value}
          </span>
          {unit && <span className="text-[1.75rem] font-semibold text-ink-muted">{unit}</span>}
        </p>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-support text-ink-muted">
        <span className="rounded-full border border-line bg-raised px-3 py-0.5 font-semibold text-ink">{scope}</span>
        {caption}
      </p>
    </article>
  );
}
