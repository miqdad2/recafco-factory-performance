import { Panel } from '../../../components/ui/Panel';
import type { Period, ProductPieces } from '../../../lib/dashboard/contracts';
import { formatCount } from '../../../lib/format';
import { PERIOD_SCOPES, PRODUCT_LABELS } from '../labels';

interface ProductMixPanelProps {
  products: ProductPieces[];
  total: number;
  period: Period;
}

/**
 * Produced finished elements per product category (whole pieces). Categories are
 * mutually exclusive, so the rows add up to the Produced Elements total.
 */
export function ProductMixPanel({ products, total, period }: ProductMixPanelProps) {
  // Bar lengths are relative to the largest category so differences stay visible.
  const largest = Math.max(0, ...products.map((p) => p.pieces));

  return (
    <Panel title="Production by Product" meta={`${PERIOD_SCOPES[period]} · pieces`}>
      <ul aria-label={`Total ${formatCount(total)} pieces`} className="flex flex-1 flex-col justify-around gap-3">
        {products.map((p) => (
          <li key={p.category} className="grid grid-cols-[9rem_1fr_auto] items-center gap-5">
            <span className="text-label font-semibold text-ink">{PRODUCT_LABELS[p.category]}</span>
            <span className="h-[2rem] overflow-hidden rounded-md bg-raised">
              <span
                className="block h-full rounded-md bg-chart-blue motion-safe:transition-[width] motion-safe:duration-300"
                style={{ width: largest > 0 ? `${(p.pieces / largest) * 100}%` : '0%' }}
              />
            </span>
            {/* Fixed width keeps counts right-aligned across rows, up to Yearly values. */}
            <span className="w-[10rem] text-right text-[1.75rem] leading-none font-bold text-ink">
              {formatCount(p.pieces)} <span className="text-support font-semibold text-ink-muted">pcs</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
