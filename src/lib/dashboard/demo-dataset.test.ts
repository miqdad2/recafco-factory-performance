import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot, prepareDataset } from './aggregate';
import { PERIODS } from './contracts';
import { DEMO_REFERENCE_TIME } from './fixtures/catalog';
import { generateDemoDataset } from './fixtures/generate';
import { kuwaitDateStart, kuwaitMonthKey, parseInstant } from './periods';
import { fromMilli, toMilli } from './units';
import { parseDemoDataset, parseSnapshot } from './validate';

const raw = generateDemoDataset();
const data = prepareDataset(parseDemoDataset(raw));
const snapshots = Object.fromEntries(PERIODS.map((p) => [p, buildDashboardSnapshot(data, p)])) as Record<
  (typeof PERIODS)[number],
  ReturnType<typeof buildDashboardSnapshot>
>;
const refMs = parseInstant(DEMO_REFERENCE_TIME);
const seriesOf = (period: (typeof PERIODS)[number], key: string) => snapshots[period].output.productionSeries.find((s) => s.key === key)!;
const concrete = raw.concreteBatches!;

describe('demo dataset', () => {
  it('is reproducible', () => {
    expect(generateDemoDataset()).toEqual(raw);
  });

  it('has no records after the reference time', () => {
    expect(raw.productionReceipts.every((r) => r.recordedAt === null || parseInstant(r.recordedAt) < refMs)).toBe(true);
    expect(raw.productionReceipts.every((r) => kuwaitDateStart(r.postingDate) < refMs)).toBe(true);
    expect(concrete.every((r) => parseInstant(r.producedAt) < refMs)).toBe(true);
    expect(raw.deliveryNotes.every((n) => kuwaitDateStart(n.postingDate) < refMs)).toBe(true);
  });

  it('uses fictional identifiers and volumes with at most three decimals', () => {
    expect(raw.items.every((i) => i.itemCode.startsWith('DEMO-'))).toBe(true);
    expect(raw.salesOrders.every((o) => o.customer.startsWith('Demo '))).toBe(true);
    expect(raw.productionReceipts.every((r) => Math.abs(r.quantity * 1000 - toMilli(r.quantity)) < 1e-6)).toBe(true);
    expect(concrete.every((r) => Math.abs(r.volumeM3 * 1000 - toMilli(r.volumeM3)) < 1e-6)).toBe(true);
  });

  it('contains the awkward records the rules must handle', () => {
    expect(raw.deliveryNotes.some((n) => n.cancelled)).toBe(true);
    expect(raw.deliveryNotes.some((n) => n.documentStatus === 'open' && !n.cancelled)).toBe(true);
    expect(raw.deliveryNotes.some((n) => n.lines.some((l) => l.itemCode === 'DEMO-BILL-ADJ'))).toBe(true);
    expect(raw.productionReceipts.some((r) => r.cancelled)).toBe(true);
    expect(raw.productionReceipts.some((r) => r.itemCode === 'DEMO-STEEL-CAGE')).toBe(true);
    expect(raw.productionReceipts.some((r) => r.recordedAt === null)).toBe(true);
    expect(raw.salesOrders.some((o) => o.lines.length > 1)).toBe(true);
    expect(raw.productionOrders.some((o) => o.status === 'released' && o.completedQuantity >= o.plannedQuantity)).toBe(true);
  });

  it('has inconsistent Finished Goods flags, so eligibility cannot depend on them', () => {
    expect(raw.items.some((i) => i.itemGroup === 'HOLLOWCORE' && !i.finishedGoodsFlag)).toBe(true);
    expect(raw.items.some((i) => i.itemGroup === 'RAW-MATERIAL' && i.finishedGoodsFlag)).toBe(true);
  });

  it('shows the same four rows in the expected order in every period', () => {
    for (const period of PERIODS) {
      expect(snapshots[period].output.rows.map((r) => r.key)).toEqual(['hollowcore:m2', 'precast:m3', 'precast:pieces', 'grc:m2']);
    }
  });
});

describe.each(PERIODS)('%s snapshot', (period) => {
  const s = snapshots[period];

  it('passes snapshot validation', () => {
    expect(() => parseSnapshot({ ...s, source: 'demo', fetchedAt: DEMO_REFERENCE_TIME })).not.toThrow();
  });

  it('has output and reconciles every series with its row exactly', () => {
    for (const row of s.output.rows) {
      const series = seriesOf(period, row.key);
      expect(row.produced).toBeGreaterThan(0);
      expect(series.total).toBe(row.produced);
      expect(series.trend.reduce((sum, b) => sum + toMilli(b.quantity ?? 0), 0)).toBe(toMilli(row.produced!));
    }
  });

  it('keeps pieces whole and delivery notes separate from quantities', () => {
    const pieces = s.output.rows.find((r) => r.unit === 'pieces')!;
    expect(Number.isInteger(pieces.produced)).toBe(true);
    expect(Number.isInteger(pieces.delivered)).toBe(true);
    expect(s.output.deliveryDocumentCount).toBeGreaterThan(0);
  });
});

describe('across period selections', () => {
  it('keeps order snapshots and month-to-date concrete unchanged', () => {
    for (const period of PERIODS) {
      expect(snapshots[period].orders).toEqual(snapshots.daily.orders);
      expect(snapshots[period].concrete.monthToDate).toBe(snapshots.daily.concrete.monthToDate);
      expect(snapshots[period].sourceDataAsOf).toBe(DEMO_REFERENCE_TIME);
    }
    expect(snapshots.daily.orders.asOf).toBe(DEMO_REFERENCE_TIME);
  });

  it('nests period totals: day ≤ week ≤ month ≤ year', () => {
    const total = (p: (typeof PERIODS)[number]) => snapshots[p].output.rows[0]!.produced!;
    expect(total('daily')).toBeLessThan(total('weekly'));
    expect(total('weekly')).toBeLessThan(total('monthly'));
    expect(total('monthly')).toBeLessThan(total('yearly'));
  });

  it('derives Concrete Output from batching-plant records only', () => {
    const octoberLitres = concrete
      .filter((b) => kuwaitMonthKey(parseInstant(b.producedAt)) === '2026-10')
      .reduce((sum, b) => sum + toMilli(b.volumeM3), 0);
    expect(snapshots.daily.concrete.monthToDate).toBe(fromMilli(octoberLitres));
    expect(snapshots.monthly.concrete.periodOutput).toBe(fromMilli(octoberLitres));
    expect(snapshots.monthly.output.rows.find((r) => r.key === 'precast:m3')!.produced).not.toBe(fromMilli(octoberLitres));
  });

  it('shows hours for timestamped rows and one day total for date-only GRC', () => {
    expect(seriesOf('daily', 'hollowcore:m2')).toMatchObject({ hourlyDetail: 'available', granularity: 'hour' });
    expect(seriesOf('daily', 'grc:m2')).toMatchObject({ hourlyDetail: 'unavailable', granularity: 'day' });
    expect(seriesOf('daily', 'grc:m2').trend).toHaveLength(1);
    expect(seriesOf('weekly', 'grc:m2')).toMatchObject({ hourlyDetail: 'not-applicable', granularity: 'day' });
  });

  it('shows future intervals as null and has elapsed zero-output intervals', () => {
    const daily = seriesOf('daily', 'hollowcore:m2').trend;
    expect(daily.slice(14).every((b) => b.quantity === null)).toBe(true);
    expect(daily.slice(0, 14).every((b) => b.quantity !== null)).toBe(true);
    expect(daily.slice(2, 5).map((b) => b.quantity)).toEqual([0, 0, 0]); // 2–5 AM not scheduled
    const weekly = seriesOf('weekly', 'hollowcore:m2').trend; // reference is Wednesday
    expect(weekly.slice(0, 4).every((b) => b.quantity !== null)).toBe(true);
    expect(weekly.slice(4).every((b) => b.quantity === null)).toBe(true);
    const yearly = seriesOf('yearly', 'hollowcore:m2').trend;
    expect(yearly.map((b) => b.quantity === null)).toEqual([...Array(10).fill(false), true, true]);
  });
});
