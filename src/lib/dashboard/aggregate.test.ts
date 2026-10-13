import { describe, expect, it } from 'vitest';
import {
  aggregateByBuckets,
  aggregateDeliveries,
  buildDashboardSnapshot,
  capacityUsage,
  countActiveProductionOrders,
  countOpenSalesOrders,
  piecesByProduct,
  prepareConcrete,
  prepareDataset,
  prepareDeliveries,
  prepareElements,
} from './aggregate';
import type { DemoDataset, ProductCategory, ProductionOrder, SalesOrder } from './contracts';
import { getPeriodWindow, parseInstant } from './periods';

const REF = '2026-10-14T14:00:00+03:00';
const refMs = parseInstant(REF);

function dataset(overrides: Partial<DemoDataset> = {}): DemoDataset {
  return {
    referenceTime: REF,
    elementRecords: [],
    concreteBatches: [],
    deliveryNotes: [],
    salesOrders: [],
    productionOrders: [],
    projects: [],
    capacityPlans: [{ month: '2026-10', plannedCapacityM3: 1000, basis: 'illustrative-demo' }],
    ...overrides,
  };
}

const element = (id: string, completedAt: string, pieces: number, productCategory: ProductCategory = 'hollowcore') => ({
  id, completedAt, productCategory, pieces, productionOrderId: 'PO-1',
});
const batch = (id: string, producedAt: string, volumeM3: number) => ({
  id, producedAt, grade: 'C40', volumeM3, productionOrderId: 'PO-1',
});

describe('range boundaries', () => {
  const day = getPeriodWindow('daily', refMs);
  const farFuture = parseInstant('2030-01-01T00:00:00+03:00');

  it('includes an element exactly at the range start and excludes one exactly at the range end', () => {
    const records = prepareElements([
      element('start', '2026-10-14T00:00:00+03:00', 2),
      element('end', '2026-10-15T00:00:00+03:00', 5),
      element('before', '2026-10-13T23:59:59+03:00', 7),
    ]);
    const result = aggregateByBuckets(records, day, farFuture);
    expect(result.total).toBe(2);
    expect(result.buckets[0]!.amount).toBe(2);
  });

  it('excludes elements at or after the as-of time', () => {
    const records = prepareElements([
      element('just-before', '2026-10-14T13:59:59+03:00', 3),
      element('at-as-of', '2026-10-14T14:00:00+03:00', 4),
    ]);
    expect(aggregateByBuckets(records, day, refMs).total).toBe(3);
  });

  it('applies the same boundaries to deliveries', () => {
    const notes = prepareDeliveries([
      { id: 'DN-1', deliveredAt: '2026-10-14T00:00:00+03:00', status: 'completed', projectCode: 'P', lines: [{ itemCode: 'X', pieces: 4 }] },
      { id: 'DN-2', deliveredAt: '2026-10-15T00:00:00+03:00', status: 'completed', projectCode: 'P', lines: [{ itemCode: 'X', pieces: 9 }] },
    ]);
    expect(aggregateDeliveries(notes, day, farFuture)).toEqual({ pieces: 4, documentCount: 1 });
  });
});

describe('future intervals versus elapsed zero production', () => {
  it('marks buckets from the as-of hour onward as null and elapsed empty hours as 0', () => {
    const records = prepareElements([element('a', '2026-10-14T09:10:00+03:00', 5)]);
    const { buckets } = aggregateByBuckets(records, getPeriodWindow('daily', refMs), refMs);
    expect(buckets[3]!.amount).toBe(0); // 3 AM elapsed, nothing completed
    expect(buckets[9]!.amount).toBe(5);
    expect(buckets[13]!.amount).toBe(0); // 1–2 PM elapsed
    expect(buckets.slice(14).every((b) => b.amount === null)).toBe(true);
  });

  it('keeps the partly elapsed bucket as a number in longer periods', () => {
    const { buckets } = aggregateByBuckets([], getPeriodWindow('yearly', refMs), refMs);
    expect(buckets[9]!.amount).toBe(0); // October, in progress
    expect(buckets[10]!.amount).toBeNull(); // November
  });
});

describe('produced elements', () => {
  const records = [
    element('h1', '2026-10-14T08:05:00+03:00', 3, 'hollowcore'),
    element('p1', '2026-10-14T08:15:00+03:00', 2, 'precast'),
    element('g1', '2026-10-14T09:00:00+03:00', 1, 'grc'),
    element('h2', '2026-10-14T10:30:00+03:00', 4, 'hollowcore'),
  ];

  it('reconciles trend and product totals exactly with the produced-elements total', () => {
    const s = buildDashboardSnapshot(prepareDataset(dataset({ elementRecords: records })), 'daily');
    const { total, trend, products } = s.output.elements;
    expect(total).toBe(10);
    expect(trend.reduce((sum, b) => sum + (b.pieces ?? 0), 0)).toBe(10);
    expect(products.reduce((sum, p) => sum + p.pieces, 0)).toBe(10);
  });

  it('lists every category exactly once, so no element is counted twice', () => {
    const products = piecesByProduct(prepareElements(records));
    expect(products).toEqual([
      { category: 'hollowcore', pieces: 7 },
      { category: 'precast', pieces: 2 },
      { category: 'grc', pieces: 1 },
    ]);
    expect(piecesByProduct([])).toEqual([
      { category: 'hollowcore', pieces: 0 },
      { category: 'precast', pieces: 0 },
      { category: 'grc', pieces: 0 },
    ]);
  });

  it('keeps batching-plant m³ out of element pieces, and elements out of capacity', () => {
    const data = prepareDataset(
      dataset({
        elementRecords: [element('h', '2026-10-14T08:00:00+03:00', 6)],
        concreteBatches: [batch('b', '2026-10-14T08:00:00+03:00', 25.5)],
      }),
    );
    const s = buildDashboardSnapshot(data, 'daily');
    expect(s.output.elements.total).toBe(6);
    expect(s.output.elements.unit).toBe('pieces');
    expect(s.capacity.actualOutput).toBe(25.5);
    expect(s.capacity.unit).toBe('m3');
  });

  it('does not infer elements from concrete volume when no element records exist', () => {
    const s = buildDashboardSnapshot(prepareDataset(dataset({ concreteBatches: [batch('b', '2026-10-14T08:00:00+03:00', 300)] })), 'daily');
    expect(s.output.elements.total).toBe(0);
    expect(s.capacity.actualOutput).toBe(300);
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

  it('derives deliveries from delivery notes, not from production records', () => {
    const s = buildDashboardSnapshot(prepareDataset(dataset({ elementRecords: [element('h', '2026-10-14T08:00:00+03:00', 9)] })), 'daily');
    expect(s.output.delivered).toEqual({ total: 0, unit: 'pieces', documentCount: 0 });
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

describe('monthly batching-plant capacity', () => {
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

  it('sums concrete in whole litres so three-decimal volumes stay exact', () => {
    const litres = aggregateByBuckets(
      prepareConcrete([batch('a', '2026-10-01T08:00:00+03:00', 0.1), batch('b', '2026-10-01T09:00:00+03:00', 0.2)]),
      getPeriodWindow('monthly', refMs),
      refMs,
    ).total;
    expect(litres).toBe(300);
  });

  it('reports unknown capacity when no plan exists for the reference month', () => {
    const snapshot = buildDashboardSnapshot(prepareDataset(dataset({ capacityPlans: [] })), 'daily');
    expect(snapshot.capacity.plannedCapacity).toBeNull();
    expect(snapshot.capacity.percentUsed).toBeNull();
  });

  it('uses the month containing the reference time, whatever the period', () => {
    const data = prepareDataset(
      dataset({
        concreteBatches: [
          batch('sep', '2026-09-30T23:59:00+03:00', 50),
          batch('oct', '2026-10-01T00:00:00+03:00', 20),
          batch('today', '2026-10-14T08:00:00+03:00', 5),
        ],
      }),
    );
    for (const period of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      const s = buildDashboardSnapshot(data, period);
      expect(s.capacity.month).toBe('2026-10');
      expect(s.capacity.actualOutput).toBe(25);
    }
  });
});
