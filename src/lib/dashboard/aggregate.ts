/**
 * Pure dashboard calculations. Every figure on the screen comes from one
 * snapshot built here from dated records, so totals, trend and grade
 * breakdown always reconcile. No React, no I/O, no client clock.
 *
 * Demo rules (assumptions, NOT confirmed SAP definitions):
 * - Period activity counts records with timestamp in [period start, as-of).
 * - Open sales order: status "open", posted before as-of, and at least one
 *   line with remaining pieces (ordered − delivered > 0). Closed/cancelled excluded.
 * - Active production order: status "released", created before as-of and
 *   remaining pieces (planned − completed > 0). Planned/closed/cancelled excluded.
 * - Delivered output: pieces on completed delivery notes; cancelled notes excluded.
 *   Delivery note count is reported separately and never used as output.
 * - Project completion: (opening delivered pieces + delivered pieces to as-of) ÷ planned pieces.
 */
import type {
  CapacityPlan,
  DashboardSnapshot,
  DeliveryNote,
  DemoDataset,
  MonthlyCapacity,
  Period,
  ProductionOrder,
  ProductionRecord,
  Project,
  SalesOrder,
  VolumeUnit,
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
export const MAX_GRADE_ROWS = 5;
export const OTHER_GRADES_LABEL = 'Other grades';

/* ------------------------------------------------------------------ */
/* Prepared dataset: timestamps parsed once, records sorted by time    */
/* ------------------------------------------------------------------ */

export interface PreparedProduction {
  atMs: number;
  grade: string;
  litres: number;
}

export interface PreparedDelivery {
  atMs: number;
  id: string;
  status: DeliveryNote['status'];
  projectCode: string;
  pieces: number;
}

export interface PreparedDataset {
  referenceMs: number;
  production: PreparedProduction[];
  deliveries: PreparedDelivery[];
  salesOrders: SalesOrder[];
  productionOrders: ProductionOrder[];
  projects: Project[];
  capacityPlans: CapacityPlan[];
}

export function prepareProduction(records: readonly ProductionRecord[]): PreparedProduction[] {
  return records
    .map((r) => ({ atMs: parseInstant(r.producedAt), grade: r.grade, litres: toLitres(r.volumeM3) }))
    .sort((a, b) => a.atMs - b.atMs);
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
    .sort((a, b) => a.atMs - b.atMs);
}

export function prepareDataset(dataset: DemoDataset): PreparedDataset {
  return {
    referenceMs: parseInstant(dataset.referenceTime),
    production: prepareProduction(dataset.productionRecords),
    deliveries: prepareDeliveries(dataset.deliveryNotes),
    salesOrders: dataset.salesOrders,
    productionOrders: dataset.productionOrders,
    projects: dataset.projects,
    capacityPlans: dataset.capacityPlans,
  };
}

/* ------------------------------------------------------------------ */
/* Basic helpers                                                       */
/* ------------------------------------------------------------------ */

/** Sums m³ values via whole litres; null (future/unavailable) values are skipped. */
export function sumVolumes(values: ReadonlyArray<number | null>): number {
  let litres = 0;
  for (const value of values) {
    if (value !== null) litres += toLitres(value);
  }
  return fromLitres(litres);
}

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

export interface ProductionAggregate {
  totalLitres: number;
  /** One entry per bucket; null = bucket starts at or after as-of (not yet reached). */
  buckets: { startMs: number; endMs: number; litres: number | null }[];
  grades: Map<string, number>;
}

/** Production within [window.start, min(window.end, as-of)), grouped into the window's buckets. */
export function aggregateProduction(
  records: readonly PreparedProduction[],
  window: PeriodWindow,
  asOfMs: number,
): ProductionAggregate {
  const bucketWindows = getBuckets(window);
  const buckets = bucketWindows.map((b) => ({ ...b, litres: b.startMs < asOfMs ? 0 : null }));
  const grades = new Map<string, number>();
  const limit = Math.min(window.endMs, asOfMs);
  let totalLitres = 0;
  let cursor = 0;

  for (const record of records) {
    if (!isWithin(record.atMs, window.startMs, limit)) continue;
    while (cursor < buckets.length - 1 && record.atMs >= buckets[cursor]!.endMs) cursor++;
    // Records are time-sorted and the bucket starts before as-of, so litres is a number here.
    const bucket = buckets[cursor]!;
    bucket.litres = (bucket.litres ?? 0) + record.litres;
    grades.set(record.grade, (grades.get(record.grade) ?? 0) + record.litres);
    totalLitres += record.litres;
  }
  return { totalLitres, buckets, grades };
}

/** Largest grades first; beyond `maxRows`, the smallest are combined into "Other grades". */
export function groupGrades(grades: Map<string, number>, maxRows = MAX_GRADE_ROWS) {
  const rows = [...grades.entries()]
    .filter(([, litres]) => litres > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = rows.length > maxRows ? rows.slice(0, maxRows - 1) : rows;
  const rest = rows.length > maxRows ? rows.slice(maxRows - 1) : [];
  const result = shown.map(([grade, litres]) => ({ grade, volume: fromLitres(litres) }));
  if (rest.length > 0) {
    result.push({ grade: OTHER_GRADES_LABEL, volume: fromLitres(rest.reduce((sum, [, l]) => sum + l, 0)) });
  }
  return result;
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

export function monthlyCapacity(data: PreparedDataset, asOfMs: number): MonthlyCapacity {
  const month = kuwaitMonthKey(asOfMs);
  const monthWindow = getPeriodWindow('monthly', asOfMs);
  const plan = data.capacityPlans.find((p) => p.month === month);
  const { totalLitres } = aggregateProduction(data.production, monthWindow, asOfMs);
  return capacityUsage({
    month,
    plannedCapacity: plan?.plannedCapacityM3 ?? null,
    actualOutput: fromLitres(totalLitres),
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
  const production = aggregateProduction(data.production, window, asOfMs);
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
      concrete: {
        total: fromLitres(production.totalLitres),
        unit: 'm3',
        trend: production.buckets.map((b) => ({
          start: toKuwaitIso(b.startMs),
          end: toKuwaitIso(b.endMs),
          volume: b.litres === null ? null : fromLitres(b.litres),
        })),
        grades: groupGrades(production.grades),
      },
      delivered: { total: delivered.pieces, unit: 'pieces', documentCount: delivered.documentCount },
    },
    capacity: monthlyCapacity(data, asOfMs),
    projects: projectProgress(data.projects, data.deliveries, asOfMs),
  };
}
