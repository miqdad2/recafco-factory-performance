import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot, prepareDataset } from './aggregate';
import { PERIODS, PRODUCT_CATEGORIES } from './contracts';
import { DEMO_REFERENCE_TIME } from './fixtures/catalog';
import { generateDemoDataset } from './fixtures/generate';
import { kuwaitMonthKey, parseInstant } from './periods';
import { fromLitres, toLitres } from './units';
import { parseDemoDataset, parseSnapshot } from './validate';

const raw = generateDemoDataset();
const data = prepareDataset(parseDemoDataset(raw));
const snapshots = Object.fromEntries(PERIODS.map((p) => [p, buildDashboardSnapshot(data, p)])) as Record<
  (typeof PERIODS)[number],
  ReturnType<typeof buildDashboardSnapshot>
>;
const refMs = parseInstant(DEMO_REFERENCE_TIME);

describe('demo dataset', () => {
  it('is reproducible', () => {
    expect(generateDemoDataset()).toEqual(raw);
  });

  it('has no records at or after the reference time', () => {
    expect(raw.elementRecords.every((r) => parseInstant(r.completedAt) < refMs)).toBe(true);
    expect(raw.concreteBatches.every((r) => parseInstant(r.producedAt) < refMs)).toBe(true);
    expect(raw.deliveryNotes.every((n) => parseInstant(n.deliveredAt) < refMs)).toBe(true);
  });

  it('uses fictional identifiers, whole element pieces and concrete volumes with at most three decimals', () => {
    expect(raw.projects.every((p) => p.code.startsWith('DEMO-'))).toBe(true);
    expect(raw.salesOrders.every((o) => o.id.startsWith('DEMO-') && o.customer.startsWith('Demo '))).toBe(true);
    expect(raw.elementRecords.every((r) => r.id.startsWith('DEMO-ELM-') && Number.isInteger(r.pieces) && r.pieces > 0)).toBe(true);
    expect(raw.concreteBatches.every((r) => Math.abs(r.volumeM3 * 1000 - Math.round(r.volumeM3 * 1000)) < 1e-6)).toBe(true);
  });

  it('includes all three product categories, each record in exactly one', () => {
    expect(new Set(raw.elementRecords.map((r) => r.productCategory))).toEqual(new Set(PRODUCT_CATEGORIES));
    expect(new Set(raw.elementRecords.map((r) => r.id)).size).toBe(raw.elementRecords.length);
  });

  it('includes cancelled deliveries to exclude', () => {
    expect(raw.deliveryNotes.some((n) => n.status === 'cancelled')).toBe(true);
  });
});

describe.each(PERIODS)('%s snapshot', (period) => {
  const s = snapshots[period];

  it('passes snapshot validation', () => {
    expect(() => parseSnapshot({ ...s, source: 'demo', fetchedAt: DEMO_REFERENCE_TIME })).not.toThrow();
  });

  it('reconciles trend and product breakdown exactly with Produced Elements', () => {
    const { total, trend, products } = s.output.elements;
    expect(total).toBeGreaterThan(0);
    expect(Number.isInteger(total)).toBe(true);
    expect(trend.reduce((sum, b) => sum + (b.pieces ?? 0), 0)).toBe(total);
    expect(products.reduce((sum, p) => sum + p.pieces, 0)).toBe(total);
    expect(products.map((p) => p.category)).toEqual([...PRODUCT_CATEGORIES]);
  });

  it('keeps delivered pieces separate from the delivery note count', () => {
    expect(s.output.delivered.unit).toBe('pieces');
    expect(s.output.delivered.total).toBeGreaterThan(s.output.delivered.documentCount);
  });

  it('produces at least as many elements as it delivers', () => {
    expect(s.output.elements.total).toBeGreaterThanOrEqual(s.output.delivered.total);
  });
});

describe('across period selections', () => {
  it('keeps order snapshots, capacity and projects unchanged', () => {
    for (const period of PERIODS) {
      expect(snapshots[period].orders).toEqual(snapshots.daily.orders);
      expect(snapshots[period].capacity).toEqual(snapshots.daily.capacity);
      expect(snapshots[period].projects).toEqual(snapshots.daily.projects);
      expect(snapshots[period].sourceDataAsOf).toBe(DEMO_REFERENCE_TIME);
    }
    expect(snapshots.daily.orders.asOf).toBe(DEMO_REFERENCE_TIME);
  });

  it('nests period totals: day ≤ week ≤ month ≤ year', () => {
    const total = (p: (typeof PERIODS)[number]) => snapshots[p].output.elements.total;
    expect(total('daily')).toBeLessThan(total('weekly'));
    expect(total('weekly')).toBeLessThan(total('monthly'));
    expect(total('monthly')).toBeLessThan(total('yearly'));
  });

  it('derives monthly capacity from batching-plant m³ records only', () => {
    const octoberLitres = raw.concreteBatches
      .filter((b) => kuwaitMonthKey(parseInstant(b.producedAt)) === '2026-10')
      .reduce((sum, b) => sum + toLitres(b.volumeM3), 0);
    expect(snapshots.daily.capacity.actualOutput).toBe(fromLitres(octoberLitres));
    expect(snapshots.daily.capacity.unit).toBe('m3');
    expect(snapshots.daily.capacity.month).toBe('2026-10');
    expect(snapshots.daily.capacity.basis).toBe('illustrative-demo');
    // Pieces and m³ are different measures and must not coincide by construction.
    expect(snapshots.monthly.output.elements.total).not.toBe(snapshots.daily.capacity.actualOutput);
  });

  it('shows future intervals as null and has elapsed zero-output intervals', () => {
    const daily = snapshots.daily.output.elements.trend;
    expect(daily.slice(14).every((b) => b.pieces === null)).toBe(true);
    expect(daily.slice(0, 14).every((b) => b.pieces !== null)).toBe(true);
    expect(daily.slice(2, 5).map((b) => b.pieces)).toEqual([0, 0, 0]); // 2–5 AM not scheduled
    const weekly = snapshots.weekly.output.elements.trend; // reference is Wednesday
    expect(weekly.slice(0, 4).every((b) => b.pieces !== null)).toBe(true);
    expect(weekly.slice(4).every((b) => b.pieces === null)).toBe(true);
    const yearly = snapshots.yearly.output.elements.trend;
    expect(yearly.map((b) => b.pieces === null)).toEqual([...Array(10).fill(false), true, true]);
  });
});
