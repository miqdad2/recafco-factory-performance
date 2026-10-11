import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot, prepareDataset } from './aggregate';
import { PERIODS } from './contracts';
import { DEMO_REFERENCE_TIME } from './fixtures/catalog';
import { generateDemoDataset } from './fixtures/generate';
import { parseInstant } from './periods';
import { toLitres } from './units';
import { parseDemoDataset, parseSnapshot } from './validate';

const raw = generateDemoDataset();
const data = prepareDataset(parseDemoDataset(raw));
const snapshots = Object.fromEntries(PERIODS.map((p) => [p, buildDashboardSnapshot(data, p)])) as Record<
  (typeof PERIODS)[number],
  ReturnType<typeof buildDashboardSnapshot>
>;
const litres = (values: ReadonlyArray<number | null>) => values.reduce<number>((s, v) => s + toLitres(v ?? 0), 0);

describe('demo dataset', () => {
  it('is reproducible', () => {
    expect(generateDemoDataset()).toEqual(raw);
  });

  it('has no records at or after the reference time', () => {
    const refMs = parseInstant(DEMO_REFERENCE_TIME);
    expect(raw.productionRecords.every((r) => parseInstant(r.producedAt) < refMs)).toBe(true);
    expect(raw.deliveryNotes.every((n) => parseInstant(n.deliveredAt) < refMs)).toBe(true);
  });

  it('uses only fictional identifiers and volumes with at most three decimals', () => {
    expect(raw.projects.every((p) => p.code.startsWith('DEMO-'))).toBe(true);
    expect(raw.salesOrders.every((o) => o.id.startsWith('DEMO-') && o.customer.startsWith('Demo '))).toBe(true);
    expect(raw.productionRecords.every((r) => Math.abs(r.volumeM3 * 1000 - Math.round(r.volumeM3 * 1000)) < 1e-6)).toBe(true);
  });

  it('includes several concrete grades and cancelled deliveries to exclude', () => {
    expect(new Set(raw.productionRecords.map((r) => r.grade)).size).toBeGreaterThanOrEqual(5);
    expect(raw.deliveryNotes.some((n) => n.status === 'cancelled')).toBe(true);
  });
});

describe.each(PERIODS)('%s snapshot', (period) => {
  const s = snapshots[period];

  it('passes snapshot validation', () => {
    expect(() => parseSnapshot({ ...s, source: 'demo', fetchedAt: DEMO_REFERENCE_TIME })).not.toThrow();
  });

  it('reconciles trend and grade breakdown exactly with Concrete Produced', () => {
    const total = toLitres(s.output.concrete.total);
    expect(total).toBeGreaterThan(0);
    expect(litres(s.output.concrete.trend.map((b) => b.volume))).toBe(total);
    expect(litres(s.output.concrete.grades.map((g) => g.volume))).toBe(total);
  });

  it('keeps delivered pieces separate from the delivery note count', () => {
    expect(s.output.delivered.unit).toBe('pieces');
    expect(s.output.delivered.total).toBeGreaterThan(s.output.delivered.documentCount);
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
    const total = (p: (typeof PERIODS)[number]) => snapshots[p].output.concrete.total;
    expect(total('daily')).toBeLessThan(total('weekly'));
    expect(total('weekly')).toBeLessThan(total('monthly'));
    expect(total('monthly')).toBeLessThan(total('yearly'));
  });

  it('derives monthly capacity actual output from the same records as the Monthly total', () => {
    expect(snapshots.daily.capacity.actualOutput).toBe(snapshots.monthly.output.concrete.total);
    expect(snapshots.daily.capacity.month).toBe('2026-10');
    expect(snapshots.daily.capacity.basis).toBe('illustrative-demo');
  });

  it('shows future intervals as null and has elapsed zero-output intervals', () => {
    const daily = snapshots.daily.output.concrete.trend;
    expect(daily.slice(14).every((b) => b.volume === null)).toBe(true);
    expect(daily.slice(0, 14).every((b) => b.volume !== null)).toBe(true);
    expect(daily.slice(2, 5).map((b) => b.volume)).toEqual([0, 0, 0]); // 02:00–05:00 not scheduled
    const weekly = snapshots.weekly.output.concrete.trend; // reference is Wednesday
    expect(weekly.slice(0, 4).every((b) => b.volume !== null)).toBe(true);
    expect(weekly.slice(4).every((b) => b.volume === null)).toBe(true);
    const yearly = snapshots.yearly.output.concrete.trend;
    expect(yearly.map((b) => b.volume === null)).toEqual([...Array(10).fill(false), true, true]);
  });
});
