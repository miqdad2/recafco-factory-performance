interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  /** "Demo snapshot" for current snapshots, or the period ("Selected day") for period totals. */
  scope: string;
  scopeKind: 'snapshot' | 'period';
  caption: string;
}

export function KpiCard({ label, value, unit, scope, scopeKind, caption }: KpiCardProps) {
  const stripe = scopeKind === 'snapshot' ? 'bg-chart-teal' : 'bg-chart-blue';
  return (
    <article className="relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-panel border border-line bg-surface py-4 pr-6 pl-8">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-2 ${stripe}`} />
      <h2 className="text-panel font-semibold text-ink">{label}</h2>
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-kpi font-bold text-ink">{value}</span>
        {unit && <span className="text-panel font-semibold text-ink-muted">{unit}</span>}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-support text-ink-muted">
        <span className="rounded-full border border-line bg-raised px-3 py-0.5 font-semibold text-ink">
          {scope}
        </span>
        {caption}
      </p>
    </article>
  );
}
