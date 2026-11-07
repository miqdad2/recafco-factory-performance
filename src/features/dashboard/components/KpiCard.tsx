import type { ReactNode } from 'react';
import type { QuantityRow } from '../../../lib/dashboard/contracts';
import { formatQuantity } from '../../../lib/format';
import { DENSE_ROW_LIMIT, formatProductName, formatUnit, isUnverifiedUnit, NOT_AVAILABLE } from '../labels';

interface KpiCardProps {
  label: string;
  /** "Current" for snapshots, or the period ("Selected day") for period totals. */
  scope: string;
  /** Optional extra fact, e.g. the snapshot time or delivery-note count. */
  caption?: string;
  /** Strip colour: slate for snapshots, blue for production, teal for delivery. */
  stripeClass: string;
  children: ReactNode;
}

/** Shared frame so all four cards align: title, content, then the scope chip on one row. */
function KpiCard({ label, scope, caption, stripeClass, children }: KpiCardProps) {
  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface py-3.5 pr-6 pl-8 shadow-panel">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${stripeClass}`} />
      <h2 className="text-panel font-semibold text-ink">{label}</h2>
      <div className="flex flex-1 flex-col pt-1.5 pb-2.5">{children}</div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-support text-ink-muted">
        <span className="rounded-full border border-line bg-raised px-3 py-0.5 font-semibold text-ink">{scope}</span>
        {caption}
      </p>
    </article>
  );
}

interface CountCardProps extends Omit<KpiCardProps, 'children' | 'stripeClass'> {
  /** Formatted count; null = unknown. */
  value: string | null;
  unit: string;
}

/** Single headline count: the strongest element on the card. */
export function CountCard({ value, unit, ...frame }: CountCardProps) {
  return (
    <KpiCard {...frame} stripeClass="bg-accent-snapshot">
      {value === null ? (
        <p className="my-auto text-panel font-semibold text-ink-muted">{NOT_AVAILABLE}</p>
      ) : (
        <p className="my-auto flex items-baseline gap-x-3 whitespace-nowrap">
          <span className="text-kpi font-bold tracking-tight text-ink">{value}</span>
          <span className="text-[1.75rem] font-semibold text-ink-muted">{unit}</span>
        </p>
      )}
    </KpiCard>
  );
}

interface QuantityCardProps extends Omit<KpiCardProps, 'children'> {
  rows: QuantityRow[];
  field: 'produced' | 'delivered';
  /** Row shown in Production Trend; highlighted, never used to hide other rows. */
  selectedKey?: string;
}

/**
 * One row per product and unit. Rows are never totalled: their units differ. Extra rows
 * (unmapped items, further units) tighten slightly so the screen still fits. The row
 * shown in Production Trend gets a quiet background and edge, plus aria-current, at the
 * same height as every other row.
 */
export function QuantityCard({ rows, field, selectedKey, ...frame }: QuantityCardProps) {
  const figureSize = rows.length > DENSE_ROW_LIMIT ? 'text-panel' : 'text-row compact:text-panel';
  return (
    <KpiCard {...frame}>
      <ul className={`flex flex-col ${rows.length > DENSE_ROW_LIMIT ? '' : 'gap-1'}`}>
        {rows.map((row) => {
          const value = row[field];
          return (
            <li
              key={row.key}
              aria-current={row.key === selectedKey ? 'true' : undefined}
              className={`-mx-2 flex items-baseline justify-between gap-4 rounded-md px-2 ${row.key === selectedKey ? 'bg-raised shadow-[inset_0.25rem_0_0_0_var(--chart-blue)]' : ''}`}
            >
              <span className={`text-label font-semibold compact:text-support ${row.product === 'unmapped' || isUnverifiedUnit(row.unit) ? 'text-warning' : 'text-ink'}`}>
                {formatProductName(row)}
              </span>
              {value === null ? (
                <span className="text-support font-semibold text-ink-muted">{NOT_AVAILABLE}</span>
              ) : (
                <span className="whitespace-nowrap">
                  <span className={`${figureSize} font-bold tracking-tight text-ink`}>{formatQuantity(value, row.unit)}</span>{' '}
                  <span className={`text-support font-semibold ${isUnverifiedUnit(row.unit) ? 'text-warning' : 'text-ink-muted'}`}>
                    {formatUnit(row.unit)}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </KpiCard>
  );
}
