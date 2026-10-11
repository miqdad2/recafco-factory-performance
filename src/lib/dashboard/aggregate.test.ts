import { describe, expect, it } from 'vitest';
import {
  aggregateDeliveries,
  aggregateProduction,
  buildDashboardSnapshot,
  capacityUsage,
  countActiveProductionOrders,
  countOpenSalesOrders,
  groupGrades,
  prepareDataset,
  prepareDeliveries,
  prepareProduction,
  sumVolumes,
} from './aggregate';
import type { DemoDataset, ProductionOrder, SalesOrder } from './contracts';
import { getPeriodWindow, parseInstant } from './periods';

const REF = '2026-10-14T14:00:00+03:00';
const refMs = parseInstant(REF);

function dataset(overrides: Partial<DemoDataset> = {}): DemoDataset {
  return {
    referenceTime: REF,
    productionRecords: [],
    deliveryNotes: [],
    salesOrders: [],
    productionOrders: [],
    projects: [],
    capacityPlans: [{ month: '2026-10', plannedCapacityM3: 1000, basis: 'illustrative-demo' }],
    ...overrides,
  };
}

const production = (id: string, producedAt: string, volumeM3: number, grade = 'C40') => ({
  id, producedAt, grade, volumeM3, productionOrderId: 'PO-1',
});

describe('range boundaries', () => {
  const day = getPeriodWindow('daily', refMs);
  const farFuture = parseInstant('2030-01-01T00:00:00+03:00');

  it('includes a record exactly at the range start and excludes one exactly at the range end', () => {
    const records = prepareProduction([
      production('start', '2026-10-14T00:00:00+03:00', 1),
      production('end', '2026-10-15T00:00:00+03:00', 2),
      production('before', '2026-10-13T23:59:59+03:00', 4),
    ]);
    const result = aggregateProduction(records, day, farFuture);
    expect(result.totalLitres).toBe(1000);
    expect(result.buckets[0]!.litres).toBe(1000);
  });

  it('excludes records at or after the as-of time', () => {
    const records = prepareProduction([
      production('just-before', '2026-10-14T13:59:59+03:00', 1.5),
      production('at-as-of', '2026-10-14T14:00:00+03:00', 3),
    ]);
    expect(aggregateProduction(records, day, refMs).totalLitres).toBe(1500);
  });

  it('applies the same boundaries to deliveries', () => {
    const notes = prepareDeliveries([
      { id: 'DN-1', deliveredAt: '2026-10-14T00:00:00+03:00', status: 'completed', projectCode: 'P', lines: [{ itemCode: 'X', pieces: 4 }] },
      { id: 'DN-2', deliveredAt: '2026-10-15T00:00:00+03:00', status: 'completed', projectCode: 'P', lines: [{ itemCode: 'X', pieces: 9 }] },
    ]);
    expect(aggregateDeliveries(notes, day, farFuture)).toEqual({ pieces: 4, documentCount: 1 });
  });
});

describe('future intervals versus elapsed zero output', () => {
  it('marks buckets from the as-of hour onward as null and elapsed empty hours as 0', () => {
    const records = prepareProduction([production('a', '2026-10-14T09:10:00+03:00', 5)]);
    const { buckets } = aggregateProduction(records, getPeriodWindow('daily', refMs), refMs);
    expect(buckets[3]!.litres).toBe(0); // 03:00 elapsed, nothing produced
    expect(buckets[9]!.litres).toBe(5000);
    expect(buckets[13]!.litres).toBe(0); // 13:00–14:00 elapsed
    expect(buckets.slice(14).every((b) => b.litres === null)).toBe(true);
  });

  it('keeps the partly elapsed bucket as a number in longer periods', () => {
    const { buckets } = aggregateProduction([], getPeriodWindow('yearly', refMs), refMs);
    expect(buckets[9]!.litres).toBe(0); // October, in progress
    expect(buckets[10]!.litres).toBeNull(); // November
  });
});

describe('reconciliation and precision', () => {
  it('sums in whole litres so trend and grades equal the total exactly', () => {
    const records = prepareProduction([
      production('a', '2026-10-14T08:05:00+03:00', 0.1, 'C40'),
      production('b', '2026-10-14T08:15:00+03:00', 0.2, 'C50'),
      production('c', '2026-10-14T09:00:00+03:00', 0.7, 'C40'),
    ]);
    const result = aggregateProduction(records, getPeriodWindow('daily', refMs), refMs);
    expect(result.totalLitres).toBe(1000); // 0.1 + 0.2 + 0.7 = 1.000 exactly
    expect(result.buckets.reduce((s, b) => s + (b.litres ?? 0), 0)).toBe(1000);
    expect([...result.grades.values()].reduce((s, l) => s + l, 0)).toBe(1000);
    expect(sumVolumes([0.1, 0.2, null])).toBe(0.3);
  });

  it('groups grades beyond five rows into "Other grades" without losing volume', () => {
    const grades = new Map([['A', 6000], ['B', 5000], ['C', 4000], ['D', 3000], ['E', 2000], ['F', 1000]]);
    const rows = groupGrades(grades);
    expect(rows.map((r) => r.grade)).toEqual(['A', 'B', 'C', 'D', 'Other grades']);
    expect(rows.at(-1)!.volume).toBe(3);
    expect(groupGrades(new Map([['A', 1], ['B', 0]]))).toEqual([{ grade: 'A', volume: 0.001 }]);
  });
});

describe('deliveries: pieces versus document counts', () => {
  it('sums pieces across lines, counts documents separately and ignores cancelled notes', () => {
    const notes = prepareDeliveries([
      { id: 'DN-1', deliveredAt: '2026-10-14T08:00:00+03:00', status: 'completed', projectCode: 'P', lines: [{ itemCode: 'A', pieces: 6 }, { itemCode: 'B', pieces: 4 }] },
      { id: 'DN-2', deliveredAt: '2026-10-14T09:00:00+03:00', status: 'completed', projectCode: 'P', lines: [{ itemCode: 'A', pieces: 7 }] },
      { id: 'DN-3', deliveredAt: '2026-10-14T10:00:00+03:00', status: 'cancelled', projectCode: 'P', lines: [{ itemCode: 'A', pieces: 50 }] },
      { id: 'DN-1', deliveredAt: '2026-10-14T08:00:00+03:00', status: 'completed', projectCode: 'P', lines: [{ itemCode: 'A', pieces: 6 }, { itemCode: 'B', pieces: 4 }] },
    ]);
    expect(aggregateDeliveries(notes, getPeriodWindow('daily', refMs), refMs)).toEqual({ pieces: 17, documentCount: 2 });
  });
});

describe('order snapshot rules', () => {
  const posted = '2026-10-01T10:00:00+03:00';

  it('counts open sales orders with remaining pieces only', () => {
    const orders: SalesOrder[] = [
      { id: 'SO-1', postedAt: posted, customer: 'Demo', status: 'open', lines: [{ orderedPieces: 10, deliveredPieces: 4 }] },
      { id: 'SO-2', postedAt: posted, customer: 'Demo', status: 'open', lines: [{ orderedPieces: 10, deliveredPieces: 10 }] },
      { id: 'SO-3', postedAt: posted, customer: 'Demo', status: 'cancelled', lines: [{ orderedPieces: 10, deliveredPieces: 0 }] },
      { id: 'SO-4', postedAt: posted, customer: 'Demo', status: 'closed', lines: [{ orderedPieces: 10, deliveredPieces: 10 }] },
      { id: 'SO-5', postedAt: REF, customer: 'Demo', status: 'open', lines: [{ orderedPieces: 10, deliveredPieces: 0 }] },
      { id: 'SO-1', postedAt: posted, customer: 'Demo', status: 'open', lines: [{ orderedPieces: 10, deliveredPieces: 4 }] },
    ];
    expect(countOpenSalesOrders(orders, refMs)).toBe(1);
  });

  it('counts released production orders with remaining pieces only', () => {
    const orders: ProductionOrder[] = [
      { id: 'PO-1', createdAt: posted, status: 'released', plannedPieces: 20, completedPieces: 5 },
      { id: 'PO-2', createdAt: posted, status: 'released', plannedPieces: 20, completedPieces: 20 },
      { id: 'PO-3', createdAt: posted, status: 'planned', plannedPieces: 20, completedPieces: 0 },
      { id: 'PO-4', createdAt: posted, status: 'closed', plannedPieces: 20, completedPieces: 20 },
      { id: 'PO-5', createdAt: posted, status: 'cancelled', plannedPieces: 20, completedPieces: 0 },
    ];
    expect(countActiveProductionOrders(orders, refMs)).toBe(1);
  });
});

describe('monthly capacity', () => {
  const base = { month: '2026-10', unit: 'm3', basis: 'illustrative-demo' } as const;

  it('computes month-to-date share and remaining volume', () => {
    const result = capacityUsage({ ...base, plannedCapacity: 9000, actualOutput: 2250 });
    expect(result.percentUsed).toBe(25);
    expect(result.remaining).toBe(6750);
  });

  it('returns null for zero or unknown capacity', () => {
    for (const plannedCapacity of [0, null]) {
      const result = capacityUsage({ ...base, plannedCapacity, actualOutput: 100 });
      expect(result.percentUsed).toBeNull();
      expect(result.remaining).toBeNull();
    }
  });

  it('preserves over-capacity values', () => {
    const result = capacityUsage({ ...base, plannedCapacity: 1000, actualOutput: 1200.5 });
    expect(result.percentUsed).toBeCloseTo(120.05, 10);
    expect(result.remaining).toBe(-200.5);
  });

  it('reports unknown capacity when no plan exists for the reference month', () => {
    const snapshot = buildDashboardSnapshot(prepareDataset(dataset({ capacityPlans: [] })), 'daily');
    expect(snapshot.capacity.plannedCapacity).toBeNull();
    expect(snapshot.capacity.percentUsed).toBeNull();
  });

  it('uses the month containing the reference time, whatever the period', () => {
    const data = prepareDataset(
      dataset({
        productionRecords: [
          production('sep', '2026-09-30T23:59:00+03:00', 50),
          production('oct', '2026-10-01T00:00:00+03:00', 20),
          production('today', '2026-10-14T08:00:00+03:00', 5),
        ],
      }),
    );
    for (const period of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      const s = buildDashboardSnapshot(data, period);
      expect(s.capacity.month).toBe('2026-10');
      expect(s.capacity.actualOutput).toBe(25);
    }
    expect(buildDashboardSnapshot(data, 'yearly').output.concrete.total).toBe(75);
  });
});
