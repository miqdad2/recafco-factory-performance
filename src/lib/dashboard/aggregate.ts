/**
 * Pure dashboard calculations. Every figure on the screen comes from one
 * snapshot built here from dated records, so totals, trend and product
 * breakdown always reconcile. No React, no I/O, no client clock.
 *
 * Demo rules (assumptions, NOT confirmed SAP definitions):
 * - Period activity counts records with timestamp in [period start, as-of).
 * - Produced elements: whole pieces on completed element-production records. Each
 *   record has exactly one product category (Hollowcore, Precast or GRC), so the
 *   category totals add up to the total without double-counting.
 * - Batching-plant concrete (m³) is a separate record set used only for monthly
 *   capacity. It never enters a piece total, and pieces are never derived from it.
 * - Open sales order: status "open", posted before as-of, and at least one
 *   line with remaining pieces (ordered − delivered > 0). Closed/cancelled excluded.
 * - Active production order: status "released", created before as-of and
 *   remaining pieces (planned − completed > 0). Planned/closed/cancelled excluded.
 * - Delivered output: pieces on completed delivery notes; cancelled notes excluded.
 *   Delivery note count is reported separately and never used as output.
 * - Project completion: (opening delivered pieces + delivered pieces to as-of) ÷ planned pieces.
 */
import {
  PRODUCT_CATEGORIES,
  type CapacityPlan,
  type ConcreteBatchRecord,
  type DashboardSnapshot,
  type DeliveryNote,
  type DemoDataset,
  type ElementProductionRecord,
  type MonthlyCapacity,
  type Period,
  type ProductCategory,
  type ProductionOrder,
  type Project,
  type SalesOrder,
  type VolumeUnit,
} from './contracts';
import {
  getBuckets,
  getPeriodWindow,
  isWithin,
  kuwaitMonthKey,
  parseInstant,
  toKuwaitIso,
  type PeriodWindow,
} from './periods';
import { fromLitres, toLitres } from './units';

export const PROJECT_COMPLETION_BASIS = 'Delivered pieces ÷ planned pieces (demo)';

/* ------------------------------------------------------------------ */
/* Prepared dataset: timestamps parsed once, records sorted by time    */
/* ------------------------------------------------------------------ */

/** A dated integer amount: pieces for elements, whole litres for concrete. */
interface TimedAmount {
  atMs: number;
  amount: number;
}

export interface PreparedElement extends TimedAmount {
  category: ProductCategory;
}

export type PreparedConcrete = TimedAmount;

export interface PreparedDelivery {
  atMs: number;
  id: string;
  status: DeliveryNote['status'];
  projectCode: string;
  pieces: number;
}

export interface PreparedDataset {
  referenceMs: number;
  elements: PreparedElement[];
  concrete: PreparedConcrete[];
  deliveries: PreparedDelivery[];
  salesOrders: SalesOrder[];
  productionOrders: ProductionOrder[];
  projects: Project[];
  capacityPlans: CapacityPlan[];
}

const byTime = (a: { atMs: number }, b: { atMs: number }) => a.atMs - b.atMs;

export function prepareElements(records: readonly ElementProductionRecord[]): PreparedElement[] {
  return records
    .map((r) => ({ atMs: parseInstant(r.completedAt), amount: r.pieces, category: r.productCategory }))
    .sort(byTime);
}

export function prepareConcrete(records: readonly ConcreteBatchRecord[]): PreparedConcrete[] {
  return records.map((r) => ({ atMs: parseInstant(r.producedAt), amount: toLitres(r.volumeM3) })).sort(byTime);
}

export function prepareDeliveries(notes: readonly DeliveryNote[]): PreparedDelivery[] {
  return notes
    .map((n) => ({
      atMs: parseInstant(n.deliveredAt),
      id: n.id,
      status: n.status,
      projectCode: n.projectCode,
      pieces: n.lines.reduce((sum, line) => sum + line.pieces, 0),
    }))
    .sort(byTime);
}

export function prepareDataset(dataset: DemoDataset): PreparedDataset {
  return {
    referenceMs: parseInstant(dataset.referenceTime),
    elements: prepareElements(dataset.elementRecords),
    concrete: prepareConcrete(dataset.concreteBatches),
    deliveries: prepareDeliveries(dataset.deliveryNotes),
    salesOrders: dataset.salesOrders,
    productionOrders: dataset.productionOrders,
    projects: dataset.projects,
    capacityPlans: dataset.capacityPlans,
  };
}

/* ------------------------------------------------------------------ */
/* Capacity helper                                                     */
/* ------------------------------------------------------------------ */

/**
 * Month-to-date share of full-month planned capacity.
 * Zero or unknown capacity yields null rather than dividing by zero.
 * Over-capacity is preserved (percent > 100, remaining < 0).
 */
export function capacityUsage(input: {
  month: string;
  plannedCapacity: number | null;
  actualOutput: number;
  unit: VolumeUnit;
  basis: MonthlyCapacity['basis'];
}): MonthlyCapacity {
  const { plannedCapacity, actualOutput } = input;
  const known = plannedCapacity !== null && plannedCapacity > 0;
  return {
    ...input,
    remaining: known ? fromLitres(toLitres(plannedCapacity) - toLitres(actualOutput)) : null,
    percentUsed: known ? (actualOutput / plannedCapacity) * 100 : null,
  };
}

/* ------------------------------------------------------------------ */
/* Period activity                                                     */
/* ------------------------------------------------------------------ */

export interface BucketedTotal<R extends TimedAmount> {
  /** Integer total (pieces or litres). */
  total: number;
  /** One entry per bucket; null = bucket starts at or after as-of (not yet reached). */
  buckets: { startMs: number; endMs: number; amount: number | null }[];
  /** Records that fell inside the period, for further breakdowns. */
  included: R[];
}

/**
 * Integer amounts within [window.start, min(window.end, as-of)), grouped into the
 * window's buckets. Integers keep every breakdown exactly equal to the total.
 */
export function aggregateByBuckets<R extends TimedAmount>(
  records: readonly R[],
  window: PeriodWindow,
  asOfMs: number,
): BucketedTotal<R> {
  const buckets = getBuckets(window).map((b) => ({ ...b, amount: b.startMs < asOfMs ? 0 : null }));
  const limit = Math.min(window.endMs, asOfMs);
  const included: R[] = [];
  let total = 0;
  let cursor = 0;

  for (const record of records) {
    if (!isWithin(record.atMs, window.startMs, limit)) continue;
    while (cursor < buckets.length - 1 && record.atMs >= buckets[cursor]!.endMs) cursor++;
    // Records are time-sorted and the bucket starts before as-of, so amount is a number here.
    const bucket = buckets[cursor]!;
    bucket.amount = (bucket.amount ?? 0) + record.amount;
    total += record.amount;
    included.push(record);
  }
  return { total, buckets, included };
}

/** Pieces per product category, every category exactly once in a fixed order. */
export function piecesByProduct(elements: readonly PreparedElement[]) {
  const totals = new Map<ProductCategory, number>(PRODUCT_CATEGORIES.map((c) => [c, 0]));
  for (const e of elements) totals.set(e.category, totals.get(e.category)! + e.amount);
  return PRODUCT_CATEGORIES.map((category) => ({ category, pieces: totals.get(category)! }));
}

export interface DeliveryAggregate {
  pieces: number;
  documentCount: number;
}

/** Completed delivery notes within [start, min(end, as-of)); pieces and documents stay separate. */
export function aggregateDeliveries(
  deliveries: readonly PreparedDelivery[],
  window: Pick<PeriodWindow, 'startMs' | 'endMs'>,
  asOfMs: number,
): DeliveryAggregate {
  const limit = Math.min(window.endMs, asOfMs);
  const documents = new Set<string>();
  let pieces = 0;
  for (const note of deliveries) {
    if (note.status !== 'completed' || !isWithin(note.atMs, window.startMs, limit)) continue;
    if (documents.has(note.id)) continue; // a document is counted once
    documents.add(note.id);
    pieces += note.pieces;
  }
  return { pieces, documentCount: documents.size };
}

/* ------------------------------------------------------------------ */
/* Current snapshots                                                   */
/* ------------------------------------------------------------------ */

export function countOpenSalesOrders(orders: readonly SalesOrder[], asOfMs: number): number {
  const open = new Set<string>();
  for (const order of orders) {
    if (order.status !== 'open' || parseInstant(order.postedAt) >= asOfMs) continue;
    const hasRemaining = order.lines.some((l) => l.orderedPieces - l.deliveredPieces > 0);
    if (hasRemaining) open.add(order.id);
  }
  return open.size;
}

export function countActiveProductionOrders(orders: readonly ProductionOrder[], asOfMs: number): number {
  const active = new Set<string>();
  for (const order of orders) {
    if (order.status !== 'released' || parseInstant(order.createdAt) >= asOfMs) continue;
    if (order.plannedPieces - order.completedPieces > 0) active.add(order.id);
  }
  return active.size;
}

export function projectProgress(projects: readonly Project[], deliveries: readonly PreparedDelivery[], asOfMs: number) {
  const deliveredByProject = new Map<string, number>();
  const seen = new Set<string>();
  for (const note of deliveries) {
    if (note.status !== 'completed' || note.atMs >= asOfMs || seen.has(note.id)) continue;
    seen.add(note.id);
    deliveredByProject.set(note.projectCode, (deliveredByProject.get(note.projectCode) ?? 0) + note.pieces);
  }
  return projects
    .filter((p) => p.featured)
    .map((p) => ({
      code: p.code,
      name: p.name,
      percentComplete: ((p.openingDeliveredPieces + (deliveredByProject.get(p.code) ?? 0)) / p.plannedPieces) * 100,
      basis: PROJECT_COMPLETION_BASIS,
    }));
}

/** Batching-plant concrete for the month containing as-of, against its m³ plan. */
export function monthlyCapacity(data: PreparedDataset, asOfMs: number): MonthlyCapacity {
  const month = kuwaitMonthKey(asOfMs);
  const monthWindow = getPeriodWindow('monthly', asOfMs);
  const plan = data.capacityPlans.find((p) => p.month === month);
  const { total: litres } = aggregateByBuckets(data.concrete, monthWindow, asOfMs);
  return capacityUsage({
    month,
    plannedCapacity: plan?.plannedCapacityM3 ?? null,
    actualOutput: fromLitres(litres),
    unit: 'm3',
    basis: plan?.basis ?? 'illustrative-demo',
  });
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

export type SnapshotCore = Omit<DashboardSnapshot, 'source' | 'fetchedAt'>;

/** Builds the coherent snapshot for one period at the dataset's reference time. */
export function buildDashboardSnapshot(data: PreparedDataset, period: Period): SnapshotCore {
  const asOfMs = data.referenceMs;
  const asOf = toKuwaitIso(asOfMs);
  const window = getPeriodWindow(period, asOfMs);
  const elements = aggregateByBuckets(data.elements, window, asOfMs);
  const delivered = aggregateDeliveries(data.deliveries, window, asOfMs);

  return {
    selectedPeriod: period,
    range: {
      start: toKuwaitIso(window.startMs),
      end: toKuwaitIso(window.endMs),
      timeZone: 'Asia/Kuwait',
      granularity: window.granularity,
    },
    sourceDataAsOf: asOf,
    orders: {
      openSalesOrders: countOpenSalesOrders(data.salesOrders, asOfMs),
      activeProductionOrders: countActiveProductionOrders(data.productionOrders, asOfMs),
      asOf,
    },
    output: {
      elements: {
        total: elements.total,
        unit: 'pieces',
        trend: elements.buckets.map((b) => ({
          start: toKuwaitIso(b.startMs),
          end: toKuwaitIso(b.endMs),
          pieces: b.amount,
        })),
        products: piecesByProduct(elements.included),
      },
      delivered: { total: delivered.pieces, unit: 'pieces', documentCount: delivered.documentCount },
    },
    capacity: monthlyCapacity(data, asOfMs),
    projects: projectProgress(data.projects, data.deliveries, asOfMs),
  };
}
