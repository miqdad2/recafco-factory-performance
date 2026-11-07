/**
 * Data contracts shared by every provider (demo now, HTTP/NestJS later).
 * Zod schemas validate data at the provider boundary; TypeScript types are
 * inferred from them. Presentation components only read DashboardSnapshot.
 *
 * Quantities are always grouped by product AND unit. Unlike units are never added,
 * converted or relabelled. Batching-plant concrete (m³) is a separate measure that
 * drives Concrete Output only. Field meanings and open SAP questions are documented
 * in docs/data-definitions.md.
 */
import { z } from 'zod';
import { rowKey } from './productMapping';
import { toMilli } from './units';

export const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type Period = (typeof PERIODS)[number];

/** Demo product categories. The SAP item-to-category mapping is still to be confirmed. */
export const PRODUCT_CATEGORIES = ['hollowcore', 'precast', 'grc'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** "unmapped" keeps quantities visible when an item has no agreed product. */
export type ReportProduct = ProductCategory | 'unmapped';
const REPORT_PRODUCTS = [...PRODUCT_CATEGORIES, 'unmapped'] as const;

/**
 * m2, m3; pieces = Nos verified as a physical count; nos = Nos not verified;
 * raw:<text> = a source unit nobody has mapped yet (shown as it is, never summed with others).
 */
export type QuantityUnit = 'm2' | 'm3' | 'pieces' | 'nos' | `raw:${string}`;

export type DataSource = 'demo' | 'sap';
export type BucketGranularity = 'hour' | 'day' | 'month';

const instant = z.iso.datetime({ offset: true });
/** Business date in Asia/Kuwait, without a time of day. */
const businessDate = z.iso.date();
const id = z.string().min(1);
/** Internal document identity. The displayed document number alone is not unique. */
const docEntry = z.number().int().positive();
const docNum = z.number().int().positive();
const quantity = z.number().finite().nonnegative();
const positiveQuantity = z.number().finite().positive();
const count = z.number().int().nonnegative();
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
/** Project code as recorded on the source document; null = none recorded. */
const projectCode = z.string().nullable();
/** A count supplied by a verified source; never calculated from volume or line counts. */
const verifiedElementCount = count.nullable();
const quantityUnit = z.custom<QuantityUnit>((v) => typeof v === 'string' && /^(m2|m3|pieces|nos|raw:.*)$/.test(v));

/* ------------------------------------------------------------------ */
/* Source records (synthetic demo dataset; later mapped from SAP)      */
/* ------------------------------------------------------------------ */

/** Item master row. Mapping rules live in productMapping.ts. */
export const itemRecordSchema = z.object({
  itemCode: id,
  description: z.string().min(1),
  itemGroup: id,
  inventoryItem: z.boolean(),
  /** Present in SAP examples but inconsistent, so eligibility never depends on it. */
  finishedGoodsFlag: z.boolean(),
  /** True only where Nos on this item is a verified count of physical items. */
  nosIsPhysicalCount: z.boolean(),
  /** Verified product subtype. Stays null until an item mapping confirms it. */
  verifiedSubtype: z.string().min(1).nullable(),
});

/** Project master row. */
export const projectRecordSchema = z.object({ code: id, name: z.string().min(1) });

/** One receipt-from-production line. `quantity` is what this transaction received. */
export const productionReceiptLineSchema = z.object({
  docEntry,
  docNum,
  lineNum: count,
  postingDate: businessDate,
  /** Actual completion time; null = date-only record, no hour may be inferred. */
  recordedAt: instant.nullable(),
  cancelled: z.boolean(),
  itemCode: id,
  quantity: positiveQuantity,
  uom: z.string(),
  productionOrderEntry: docEntry,
  /** Running total as repeated on order rows. Never summed. */
  orderCumulativeCompleted: quantity,
  projectCode,
  verifiedElementCount,
});

/**
 * A component issued to a production order, such as concrete issued to a beam order.
 * It is consumption, not finished output, so no figure on the screen reads it.
 */
export const componentIssueLineSchema = z.object({
  docEntry,
  lineNum: count,
  postingDate: businessDate,
  itemCode: id,
  quantity: positiveQuantity,
  uom: z.string(),
  productionOrderEntry: docEntry,
  projectCode,
});

/** Batching-plant concrete output (m³, at most three decimals). */
export const concreteBatchRecordSchema = z.object({
  id,
  producedAt: instant,
  grade: z.string().min(1),
  volumeM3: quantity,
  productionOrderId: id,
});

export const deliveryNoteSchema = z.object({
  docEntry,
  docNum,
  postingDate: businessDate,
  /** Open is a normal state for a delivered note; only cancellation removes it. */
  documentStatus: z.enum(['open', 'closed']),
  cancelled: z.boolean(),
  lines: z
    .array(z.object({ lineNum: count, itemCode: id, quantity: positiveQuantity, uom: z.string(), projectCode, verifiedElementCount }))
    .min(1),
});

export const salesOrderSchema = z.object({
  docEntry,
  docNum,
  postedAt: instant,
  customer: z.string().min(1),
  status: z.enum(['open', 'closed', 'cancelled']),
  /** Lines may name different projects; see countOpenSalesOrders. */
  lines: z.array(z.object({ orderedQuantity: quantity, deliveredQuantity: quantity, projectCode })).min(1),
});

export const productionOrderSchema = z.object({
  docEntry,
  docNum,
  createdAt: instant,
  status: z.enum(['planned', 'released', 'closed', 'cancelled']),
  plannedQuantity: quantity,
  /** Cumulative completed quantity; used only to decide whether work remains. */
  completedQuantity: quantity,
  projectCode,
});

export const demoDatasetSchema = z.object({
  referenceTime: instant,
  items: z.array(itemRecordSchema),
  projects: z.array(projectRecordSchema),
  productionReceipts: z.array(productionReceiptLineSchema),
  /** Consumption only; kept so it can be shown never to count as output. */
  componentIssues: z.array(componentIssueLineSchema),
  /** null = no concrete source is available (shown as Not available, not zero). */
  concreteBatches: z.array(concreteBatchRecordSchema).nullable(),
  deliveryNotes: z.array(deliveryNoteSchema),
  salesOrders: z.array(salesOrderSchema),
  productionOrders: z.array(productionOrderSchema),
});

export type ItemRecord = z.infer<typeof itemRecordSchema>;
export type ProjectRecord = z.infer<typeof projectRecordSchema>;
export type ProductionReceiptLine = z.infer<typeof productionReceiptLineSchema>;
export type ComponentIssueLine = z.infer<typeof componentIssueLineSchema>;
export type ConcreteBatchRecord = z.infer<typeof concreteBatchRecordSchema>;
export type DeliveryNote = z.infer<typeof deliveryNoteSchema>;
export type SalesOrder = z.infer<typeof salesOrderSchema>;
export type ProductionOrder = z.infer<typeof productionOrderSchema>;
export type DemoDataset = z.infer<typeof demoDatasetSchema>;

/* ------------------------------------------------------------------ */
/* Dashboard snapshot (what the screen renders)                        */
/* ------------------------------------------------------------------ */

const trendBucketSchema = z.object({
  start: instant,
  end: instant,
  /** null = interval not yet reached; 0 = elapsed with no production. */
  quantity: quantity.nullable(),
});

/** Single aggregate behind the Produced card, Delivered card and comparison table. */
const productUnit = {
  product: z.enum(REPORT_PRODUCTS),
  unit: quantityUnit,
  /** Verified subtype only; null shows the unit-separated product. */
  subtype: z.string().min(1).nullable(),
};

const quantityRowSchema = z.object({
  key: id,
  ...productUnit,
  /** null = unknown for this row; 0 = known to be nothing. */
  produced: quantity.nullable(),
  delivered: quantity.nullable(),
  /** Physical elements, only if every record carries a verified count. Otherwise null. */
  producedElementCount: count.nullable(),
  deliveredElementCount: count.nullable(),
});

/** Chart data for one product-and-unit row. */
const productionSeriesSchema = z.object({
  key: id,
  ...productUnit,
  /** Bucket size actually used; "day" on Daily means hours are not reliable. */
  granularity: z.enum(['hour', 'day', 'month']),
  hourlyDetail: z.enum(['available', 'unavailable', 'not-applicable']),
  total: quantity,
  trend: z.array(trendBucketSchema).min(1),
});

const projectOptionSchema = z.object({
  key: id,
  /** Code from the project master; null for All Projects and Unassigned. */
  code: z.string().nullable(),
  name: z.string().min(1),
});

/** Activity in the selected period for one project, product and unit. Not completion. */
const projectSummaryRowSchema = z.object({
  projectKey: id,
  rowKey: id,
  ...productUnit,
  produced: quantity,
  delivered: quantity,
});

const sumMilli = (values: number[]) => values.reduce((sum, v) => sum + toMilli(v), 0);

export const dashboardSnapshotSchema = z
  .object({
    source: z.enum(['demo', 'sap']),
    selectedPeriod: z.enum(PERIODS),
    /** Project scope of the orders, quantities, chart and summary below. */
    selectedProject: projectOptionSchema,
    projectOptions: z.array(projectOptionSchema).min(1),
    /** Full calendar period [start, end); data runs only to sourceDataAsOf. */
    range: z.object({
      start: instant,
      end: instant,
      timeZone: z.literal('Asia/Kuwait'),
      granularity: z.enum(['hour', 'day', 'month']),
    }),
    /** Time the underlying (demo or SAP) records refer to. */
    sourceDataAsOf: instant,
    /** Time the display last obtained this snapshot successfully. */
    fetchedAt: instant,
    /** Current snapshots; unaffected by the selected period. null = unknown. */
    orders: z.object({
      openSalesOrders: count.nullable(),
      activeProductionOrders: count.nullable(),
      asOf: instant,
    }),
    /** Activity within the selected period. */
    output: z.object({
      rows: z.array(quantityRowSchema),
      productionSeries: z.array(productionSeriesSchema),
      /** Delivery documents with eligible lines; a separate measure, never output. */
      deliveryDocumentCount: count.nullable(),
    }),
    projectSummary: z.array(projectSummaryRowSchema),
    /** Batching-plant concrete. Has no project attribution, so it is never project-scoped. */
    concrete: z.object({
      scope: z.literal('all-projects'),
      periodOutput: quantity.nullable(),
      /** Month containing sourceDataAsOf, up to sourceDataAsOf. */
      month: monthKey,
      monthToDate: quantity.nullable(),
      /** The cutoff monthToDate was calculated to (the source as-of time), never the live clock. */
      monthToDateThrough: instant,
      unit: z.literal('m3'),
    }),
  })
  .superRefine((s, ctx) => {
    const { rows, productionSeries } = s.output;
    const issue = (message: string, ...path: string[]) => ctx.addIssue({ code: 'custom', path: ['output', ...path], message });

    const keys = rows.map((r) => r.key);
    if (new Set(keys).size !== keys.length) issue('Each product and unit must appear exactly once', 'rows');
    for (const row of rows) {
      if (row.key !== rowKey(row.product, row.unit, row.subtype)) issue(`Row key does not match its product and unit: ${row.key}`, 'rows');
      for (const value of [row.produced, row.delivered]) {
        if (row.unit === 'pieces' && value !== null && !Number.isInteger(value)) issue(`Fractional pieces on ${row.key}`, 'rows');
      }
      const series = productionSeries.filter((p) => p.key === row.key);
      if (row.produced === null) {
        if (series.length > 0) issue(`Series given for unknown production: ${row.key}`, 'productionSeries');
        continue;
      }
      if (series.length !== 1 || series[0]!.product !== row.product || series[0]!.unit !== row.unit) {
        issue(`Row needs exactly one matching series: ${row.key}`, 'productionSeries');
        continue;
      }
      const { total, trend } = series[0]!;
      if (toMilli(total) !== toMilli(row.produced)) issue(`Series total does not match the row: ${row.key}`, 'productionSeries');
      if (sumMilli(trend.map((b) => b.quantity ?? 0)) !== toMilli(total)) issue(`Trend does not add up: ${row.key}`, 'productionSeries');
    }
    if (productionSeries.some((p) => !keys.includes(p.key))) issue('Series has no matching row', 'productionSeries');

    const optionKeys = new Set(s.projectOptions.map((o) => o.key));
    if (!optionKeys.has(s.selectedProject.key)) ctx.addIssue({ code: 'custom', path: ['selectedProject'], message: 'Selected project is not an option' });
    for (const row of s.projectSummary) {
      if (!optionKeys.has(row.projectKey)) ctx.addIssue({ code: 'custom', path: ['projectSummary'], message: `Unknown project: ${row.projectKey}` });
    }
    for (const row of rows) {
      const parts = s.projectSummary.filter((p) => p.rowKey === row.key);
      if (row.produced !== null && sumMilli(parts.map((p) => p.produced)) !== toMilli(row.produced)) {
        ctx.addIssue({ code: 'custom', path: ['projectSummary'], message: `Project summary does not add up: ${row.key}` });
      }
      if (row.delivered !== null && sumMilli(parts.map((p) => p.delivered)) !== toMilli(row.delivered)) {
        ctx.addIssue({ code: 'custom', path: ['projectSummary'], message: `Project summary does not add up: ${row.key}` });
      }
    }
  });

export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;
export type QuantityRow = DashboardSnapshot['output']['rows'][number];
export type ProductionSeries = DashboardSnapshot['output']['productionSeries'][number];
export type TrendBucket = ProductionSeries['trend'][number];
export type ConcreteOutput = DashboardSnapshot['concrete'];
export type ProjectOption = z.infer<typeof projectOptionSchema>;
export type ProjectSummaryRow = DashboardSnapshot['projectSummary'][number];
