import type { DashboardSnapshot } from '../../../lib/dashboard/contracts';
import { formatCount, formatVolume } from '../../../lib/format';
import { DELIVERED_UNIT_LABELS, formatSnapshotTime, PERIOD_SCOPES, SNAPSHOT_SCOPE } from '../labels';
import { KpiCard } from './KpiCard';

export function KpiCards({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { orders, output, selectedPeriod } = snapshot;
  const snapshotTime = formatSnapshotTime(orders.asOf);
  const periodScope = PERIOD_SCOPES[selectedPeriod];
  const notes = output.delivered.documentCount;

  return (
    <>
      <KpiCard
        label="Current Sales Orders"
        value={formatCount(orders.openSalesOrders)}
        unit="orders"
        scope={SNAPSHOT_SCOPE}
        scopeKind="snapshot"
        caption={snapshotTime}
      />
      <KpiCard
        label="Active Production Orders"
        value={formatCount(orders.activeProductionOrders)}
        unit="orders"
        scope={SNAPSHOT_SCOPE}
        scopeKind="snapshot"
        caption={snapshotTime}
      />
      <KpiCard
        label="Concrete Produced"
        value={formatVolume(output.concrete.total)}
        unit="m³"
        scope={periodScope}
        scopeKind="period"
      />
      <KpiCard
        label="Delivered Output"
        value={formatCount(output.delivered.total)}
        unit={DELIVERED_UNIT_LABELS[output.delivered.unit]}
        scope={periodScope}
        scopeKind="period"
        caption={`${formatCount(notes)} delivery ${notes === 1 ? 'note' : 'notes'}`}
      />
    </>
  );
}
