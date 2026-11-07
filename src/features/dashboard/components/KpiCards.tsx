import type { DashboardSnapshot } from '../../../lib/dashboard/contracts';
import { formatCount } from '../../../lib/format';
import { formatSnapshotTime, PERIOD_SCOPES, SNAPSHOT_SCOPE } from '../labels';
import { CountCard, QuantityCard } from './KpiCard';

const countText = (value: number | null) => (value === null ? null : formatCount(value));

/** `selectedKey` marks the row shown in Production Trend; every row stays visible. */
export function KpiCards({ snapshot, selectedKey }: { snapshot: DashboardSnapshot; selectedKey?: string }) {
  const { orders, output, selectedPeriod } = snapshot;
  const snapshotTime = `as of ${formatSnapshotTime(orders.asOf)}`;
  const periodScope = PERIOD_SCOPES[selectedPeriod];
  const notes = output.deliveryDocumentCount;

  return (
    <>
      <CountCard
        label="Current Sales Orders"
        value={countText(orders.openSalesOrders)}
        unit="orders"
        scope={SNAPSHOT_SCOPE}
        caption={snapshotTime}
      />
      <CountCard
        label="Active Production Orders"
        value={countText(orders.activeProductionOrders)}
        unit="orders"
        scope={SNAPSHOT_SCOPE}
        caption={snapshotTime}
      />
      <QuantityCard label="Produced Elements" rows={output.rows} field="produced" selectedKey={selectedKey} scope={periodScope} stripeClass="bg-chart-blue" />
      <QuantityCard
        label="Delivered Elements"
        rows={output.rows}
        field="delivered"
        selectedKey={selectedKey}
        scope={periodScope}
        stripeClass="bg-chart-teal"
        caption={notes === null ? undefined : `${formatCount(notes)} delivery ${notes === 1 ? 'note' : 'notes'}`}
      />
    </>
  );
}
