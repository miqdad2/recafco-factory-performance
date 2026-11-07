/**
 * Pure dashboard calculations. Every figure on the screen comes from one snapshot
 * built here from dated records, so cards, chart and table always reconcile.
 * No React, no I/O, no client clock.
 *
 * Proposed rules (NOT confirmed SAP definitions; see docs/data-definitions.md):
 * - Period activity counts records in [period start, as-of). Records use their
 *   business date; a time of day is used only when it falls on that date.
 * - Quantities are grouped by product AND unit, and summed in whole thousandths.
 * - Produced: the transaction quantity of each eligible, uncancelled receipt line.
 *   Cumulative completed quantities on orders are never summed.
 * - Delivered: eligible lines of uncancelled delivery notes, whether Open or Closed.
 *   The note count is separate, and delivery is never derived from production.
 * - Hourly bars need a reliable time on every record for that row on that day.
 *   Otherwise Daily shows the day's total; no hour is inferred.
 * - Current sales order: distinct document with status open, posted before as-of,
 *   and at least one line with ordered − delivered > 0.
 * - Active production order: distinct document with status released, created before
 *   as-of, and planned − completed > 0, so fully completed orders are not active
 *   even while still released.
 * - Project scope uses recorded references only. An order or delivery note spanning
 *   projects counts once in All Projects and once in each project, so project counts
 *   are not additive. Quantities are additive: each line has exactly one project.
 * - Batching-plant concrete has no project reference and is never project-scoped.
 * - Component issues (e.g. concrete issued to a beam order), cumulative order completion
 *   and stock are never read as output.
 */
import type {
  ConcreteBatchRecord,
  ConcreteOutput,
  DashboardSnapshot,
  DeliveryNote,
  DemoDataset,
  ItemRecord,
  Period,
  ProductionOrder,
  ProductionReceiptLine,
  ProductionSeries,
  ProjectOption,
  ProjectSummaryRow,
  QuantityRow,
  SalesOrder,
} from './contracts';
import {
  getBuckets,
  getPeriodWindow,
  isWithin,
  kuwaitDateStart,
  kuwaitMonthKey,
  parseInstant,
  toKuwaitIso,
  type PeriodWindow,
} from './periods';
import { classifyLine, compareRows, EXPECTED_ROWS, rowKey, type RowIdentity } from './productMapping';
import { ALL_PROJECTS, buildProjectOptions, inProjectScope, projectKeyOf } from './projects';
import { fromMilli, toMilli } from './units';

const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Prepared dataset: timestamps parsed once, records sorted by time    */
/* ------------------------------------------------------------------ */

/** A dated integer amount in thousandths of its unit. */
interface TimedAmount {
  atMs: number;
  amount: number;
}

/** One quantity's row, its project and any verified element count. */
interface ScopedLine extends RowIdentity {
  subtype: string | null;
  project: string;
  verifiedElementCount: number | null;
}

export interface PreparedReceipt extends TimedAmount, ScopedLine {
  /** False when no reliable time of day exists; atMs is then the start of the date. */
  hasTime: boolean;
}

export interface PreparedDelivery extends TimedAmount, ScopedLine {
  docEntry: number;
}

export interface PreparedDataset {
  referenceMs: number;
  projectOptions: ProjectOption[];
  receipts: PreparedReceipt[];
  concrete: TimedAmount[] | null;
  deliveries: PreparedDelivery[];
  salesOrders: SalesOrder[];
  productionOrders: ProductionOrder[];
}

const byTime = (a: { atMs: number }, b: { atMs: number }) => a.atMs - b.atMs;
const itemIndex = (items: readonly ItemRecord[]) => new Map(items.map((item) => [item.itemCode, item]));

export function prepareReceipts(lines: readonly ProductionReceiptLine[], items: readonly ItemRecord[]): PreparedReceipt[] {
  const itemsByCode = itemIndex(items);
  const seen = new Set<string>();
  const prepared: PreparedReceipt[] = [];
  for (const line of lines) {
    const identity = `${line.docEntry}:${line.lineNum}`;
    if (line.cancelled || seen.has(identity)) continue;
    seen.add(identity);
    const result = classifyLine(itemsByCode.get(line.itemCode), line.uom, line.quantity);
    if (result.status === 'excluded') continue;
    const dayStart = kuwaitDateStart(line.postingDate);
    const recordedMs = line.recordedAt === null ? null : parseInstant(line.recordedAt);
    const hasTime = recordedMs !== null && isWithin(recordedMs, dayStart, dayStart + DAY_MS);
    prepared.push({
      atMs: hasTime ? recordedMs : dayStart,
      amount: toMilli(line.quantity),
      product: result.product,
      unit: result.unit,
      subtype: result.subtype,
      project: projectKeyOf(line.projectCode),
      verifiedElementCount: line.verifiedElementCount,
      hasTime,
    });
  }
  return prepared.sort(byTime);
}

export function prepareDeliveries(notes: readonly DeliveryNote[], items: readonly ItemRecord[]): PreparedDelivery[] {
  const itemsByCode = itemIndex(items);
  const seen = new Set<number>();
  const prepared: PreparedDelivery[] = [];
  for (const note of notes) {
    if (note.cancelled || seen.has(note.docEntry)) continue;
    seen.add(note.docEntry);
    for (const line of note.lines) {
      const result = classifyLine(itemsByCode.get(line.itemCode), line.uom, line.quantity);
      if (result.status === 'excluded') continue;
      prepared.push({
        atMs: kuwaitDateStart(note.postingDate),
        amount: toMilli(line.quantity),
        product: result.product,
        unit: result.unit,
        subtype: result.subtype,
        project: projectKeyOf(line.projectCode),
        verifiedElementCount: line.verifiedElementCount,
        docEntry: note.docEntry,
      });
    }
  }
  return prepared.sort(byTime);
}

export function prepareConcrete(records: readonly ConcreteBatchRecord[]): TimedAmount[] {
  return records.map((r) => ({ atMs: parseInstant(r.producedAt), amount: toMilli(r.volumeM3) })).sort(byTime);
}

export function prepareDataset(dataset: DemoDataset): PreparedDataset {
  const receipts = prepareReceipts(dataset.productionReceipts, dataset.items);
  const deliveries = prepareDeliveries(dataset.deliveryNotes, dataset.items);
  const recordedProjects = [
    ...receipts.map((r) => r.project),
    ...deliveries.map((d) => d.project),
    ...dataset.salesOrders.flatMap((o) => o.lines.map((l) => projectKeyOf(l.projectCode))),
    ...dataset.productionOrders.map((o) => projectKeyOf(o.projectCode)),
  ];
  return {
    referenceMs: parseInstant(dataset.referenceTime),
    projectOptions: buildProjectOptions(dataset.projects, recordedProjects),
    receipts,
    concrete: dataset.concreteBatches && prepareConcrete(dataset.concreteBatches),
    deliveries,
    salesOrders: dataset.salesOrders,
    productionOrders: dataset.productionOrders,
  };
}

/* ------------------------------------------------------------------ */
/* Period activity                                                     */
/* ------------------------------------------------------------------ */

export interface BucketedTotal {
  /** Integer total in thousandths. */
  total: number;
  /** One entry per bucket; null = bucket starts at or after as-of (not yet reached). */
  buckets: { startMs: number; endMs: number; amount: number | null }[];
}

/**
 * Integer amounts within [window.start, min(window.end, as-of)), grouped into the
 * window's buckets. Integers keep every breakdown exactly equal to the total.
 */
export function aggregateByBuckets(records: readonly TimedAmount[], window: PeriodWindow, asOfMs: number): BucketedTotal {
  const buckets = getBuckets(window).map((b) => ({ ...b, amount: b.startMs < asOfMs ? 0 : null }));
  const limit = Math.min(window.endMs, asOfMs);
  let total = 0;
  let cursor = 0;

  for (const record of records) {
    if (!isWithin(record.atMs, window.startMs, limit)) continue;
    while (cursor < buckets.length - 1 && record.atMs >= buckets[cursor]!.endMs) cursor++;
    // Records are time-sorted and the bucket starts before as-of, so amount is a number here.
    const bucket = buckets[cursor]!;
    bucket.amount = (bucket.amount ?? 0) + record.amount;
    total += record.amount;
  }
  return { total, buckets };
}

function groupByRow<T extends RowIdentity>(records: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = rowKey(record.product, record.unit, record.subtype);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  return groups;
}

/** Chart series for one row. A Daily view uses hours only if every record has a reliable time. */
function buildSeries(row: RowIdentity, receipts: readonly PreparedReceipt[], window: PeriodWindow, asOfMs: number): ProductionSeries {
  const isDaily = window.granularity === 'hour';
  const hourly = isDaily && receipts.length > 0 && receipts.every((r) => r.hasTime);
  const granularity = isDaily && !hourly ? 'day' : window.granularity;
  const { total, buckets } = aggregateByBuckets(receipts, { ...window, granularity }, asOfMs);
  return {
    key: rowKey(row.product, row.unit, row.subtype),
    product: row.product,
    unit: row.unit,
    subtype: row.subtype ?? null,
    granularity,
    hourlyDetail: !isDaily ? 'not-applicable' : hourly ? 'available' : 'unavailable',
    total: fromMilli(total),
    trend: buckets.map((b) => ({
      start: toKuwaitIso(b.startMs),
      end: toKuwaitIso(b.endMs),
      quantity: b.amount === null ? null : fromMilli(b.amount),
    })),
  };
}

/** A verified total only when every record has a verified count; never derived. */
function verifiedElementTotal(lines: readonly ScopedLine[]): number | null {
  if (lines.length === 0 || lines.some((l) => l.verifiedElementCount === null)) return null;
  return lines.reduce((sum, l) => sum + l.verifiedElementCount!, 0);
}

const sumAmounts = (records: readonly TimedAmount[]) => records.reduce((sum, r) => sum + r.amount, 0);

/** Rows for the selected scope: every expected row, plus any row with records. */
function orderedRows(...groups: Map<string, ScopedLine[]>[]): RowIdentity[] {
  const rows = new Map<string, RowIdentity>(EXPECTED_ROWS.map((r) => [rowKey(r.product, r.unit), r]));
  for (const group of groups) {
    for (const [key, records] of group) rows.set(key, records[0]!);
  }
  return [...rows.values()].sort(compareRows);
}

/** Period activity by project, product and unit, in project-option order. */
function buildProjectSummary(
  receipts: readonly PreparedReceipt[],
  deliveries: readonly PreparedDelivery[],
  options: readonly ProjectOption[],
): ProjectSummaryRow[] {
  const summary: ProjectSummaryRow[] = [];
  for (const { key: projectKey } of options) {
    const inProject = (r: ScopedLine) => r.project === projectKey;
    const produced = groupByRow(receipts.filter(inProject));
    const delivered = groupByRow(deliveries.filter(inProject));
    const keys = new Set([...produced.keys(), ...delivered.keys()]);
    const rows = [...keys].map((key) => ({ key, line: (produced.get(key) ?? delivered.get(key))![0]! }));
    for (const { key, line } of rows.sort((a, b) => compareRows(a.line, b.line))) {
      summary.push({
        projectKey,
        rowKey: key,
        product: line.product,
        unit: line.unit,
        subtype: line.subtype,
        produced: fromMilli(sumAmounts(produced.get(key) ?? [])),
        delivered: fromMilli(sumAmounts(delivered.get(key) ?? [])),
      });
    }
  }
  return summary;
}

export function aggregateOutput(
  data: Pick<PreparedDataset, 'receipts' | 'deliveries' | 'projectOptions'>,
  window: PeriodWindow,
  asOfMs: number,
  project: string = ALL_PROJECTS,
) {
  const limit = Math.min(window.endMs, asOfMs);
  const selected = (r: { atMs: number; project: string }) => isWithin(r.atMs, window.startMs, limit) && inProjectScope(project, r.project);
  const receipts = data.receipts.filter(selected);
  const deliveries = data.deliveries.filter(selected);
  const produced = groupByRow(receipts);
  const delivered = groupByRow(deliveries);

  const ordered = orderedRows(produced, delivered);
  const productionSeries = ordered.map((row) => buildSeries(row, produced.get(rowKey(row.product, row.unit, row.subtype)) ?? [], window, asOfMs));
  const rows: QuantityRow[] = ordered.map((row, i) => {
    const series = productionSeries[i]!;
    const deliveredLines = delivered.get(series.key) ?? [];
    return {
      key: series.key,
      product: row.product,
      unit: row.unit,
      subtype: series.subtype,
      produced: series.total,
      delivered: fromMilli(sumAmounts(deliveredLines)),
      producedElementCount: verifiedElementTotal(produced.get(series.key) ?? []),
      deliveredElementCount: verifiedElementTotal(deliveredLines),
    };
  });
  return {
    output: { rows, productionSeries, deliveryDocumentCount: new Set(deliveries.map((d) => d.docEntry)).size },
    projectSummary: buildProjectSummary(receipts, deliveries, data.projectOptions),
  };
}

/* ------------------------------------------------------------------ */
/* Current snapshots                                                   */
/* ------------------------------------------------------------------ */

/**
 * Distinct orders with remaining quantity in scope. Within a project only that
 * project's lines decide, so one order can count under several projects.
 */
export function countOpenSalesOrders(orders: readonly SalesOrder[], asOfMs: number, project: string = ALL_PROJECTS): number {
  const open = new Set<number>();
  for (const order of orders) {
    if (order.status !== 'open' || parseInstant(order.postedAt) >= asOfMs) continue;
    const remaining = (l: SalesOrder['lines'][number]) =>
      inProjectScope(project, projectKeyOf(l.projectCode)) && toMilli(l.orderedQuantity) > toMilli(l.deliveredQuantity);
    if (order.lines.some(remaining)) open.add(order.docEntry);
  }
  return open.size;
}

export function countActiveProductionOrders(orders: readonly ProductionOrder[], asOfMs: number, project: string = ALL_PROJECTS): number {
  const active = new Set<number>();
  for (const order of orders) {
    if (order.status !== 'released' || parseInstant(order.createdAt) >= asOfMs) continue;
    if (!inProjectScope(project, projectKeyOf(order.projectCode))) continue;
    if (toMilli(order.plannedQuantity) > toMilli(order.completedQuantity)) active.add(order.docEntry);
  }
  return active.size;
}

/** Selected-period and month-to-date plant output; always All Projects, as batches name no project. */
export function concreteOutput(concrete: PreparedDataset['concrete'], window: PeriodWindow, asOfMs: number): ConcreteOutput {
  const sum = (w: PeriodWindow) => (concrete === null ? null : fromMilli(aggregateByBuckets(concrete, w, asOfMs).total));
  return {
    scope: 'all-projects',
    periodOutput: sum(window),
    month: kuwaitMonthKey(asOfMs),
    monthToDate: sum(getPeriodWindow('monthly', asOfMs)),
    monthToDateThrough: toKuwaitIso(asOfMs),
    unit: 'm3',
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

export type SnapshotCore = Omit<DashboardSnapshot, 'source' | 'fetchedAt'>;

/** Builds the coherent snapshot for one period and project at the dataset's reference time. */
export function buildDashboardSnapshot(data: PreparedDataset, period: Period, project: string = ALL_PROJECTS): SnapshotCore {
  const selectedProject = data.projectOptions.find((o) => o.key === project);
  if (!selectedProject) throw new RangeError(`Unknown project: ${project}`);
  const asOfMs = data.referenceMs;
  const asOf = toKuwaitIso(asOfMs);
  const window = getPeriodWindow(period, asOfMs);

  return {
    selectedPeriod: period,
    selectedProject,
    projectOptions: data.projectOptions,
    range: {
      start: toKuwaitIso(window.startMs),
      end: toKuwaitIso(window.endMs),
      timeZone: 'Asia/Kuwait',
      granularity: window.granularity,
    },
    sourceDataAsOf: asOf,
    orders: {
      openSalesOrders: countOpenSalesOrders(data.salesOrders, asOfMs, project),
      activeProductionOrders: countActiveProductionOrders(data.productionOrders, asOfMs, project),
      asOf,
    },
    ...aggregateOutput(data, window, asOfMs, project),
    concrete: concreteOutput(data.concrete, window, asOfMs),
  };
}
