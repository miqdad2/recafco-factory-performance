/**
 * Data contracts shared by every provider (demo now, HTTP/NestJS later).
 * Zod schemas validate data at the provider boundary; TypeScript types are
 * inferred from them. Presentation components only read DashboardSnapshot.
 */
import { z } from 'zod';
import { toLitres } from './units';

export const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type Period = (typeof PERIODS)[number];

export type DataSource = 'demo' | 'sap';
export type BucketGranularity = 'hour' | 'day' | 'month';
export type VolumeUnit = 'm3';
/** Delivered output keeps an explicit unit; different units are never summed. */
export type DeliveredUnit = 'pieces' | 'm3';

const instant = z.iso.datetime({ offset: true });
const id = z.string().min(1);
const volume = z.number().finite().nonnegative();
const count = z.number().int().nonnegative();
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/* ------------------------------------------------------------------ */
/* Source records (synthetic demo dataset; later mapped from SAP)      */
/* ------------------------------------------------------------------ */

export const productionRecordSchema = z.object({
  id,
  producedAt: instant,
  grade: z.string().min(1),
  /** m³, at most three decimals. */
  volumeM3: volume,
  productionOrderId: id,
});

export const deliveryNoteSchema = z.object({
  id,
  deliveredAt: instant,
  status: z.enum(['completed', 'cancelled']),
  projectCode: id,
  lines: z.array(z.object({ itemCode: id, pieces: count })).min(1),
});

export const salesOrderSchema = z.object({
  id,
  postedAt: instant,
  customer: z.string().min(1),
  status: z.enum(['open', 'closed', 'cancelled']),
  lines: z.array(z.object({ orderedPieces: count, deliveredPieces: count })).min(1),
});

export const productionOrderSchema = z.object({
  id,
  createdAt: instant,
  status: z.enum(['planned', 'released', 'closed', 'cancelled']),
  plannedPieces: count,
  completedPieces: count,
});

export const projectSchema = z.object({
  code: id,
  name: z.string().min(1),
  /** Shown on the dashboard (four selected projects). */
  featured: z.boolean(),
  plannedPieces: z.number().int().positive(),
  /** Pieces delivered before the demo dataset starts. */
  openingDeliveredPieces: count,
});

export const capacityPlanSchema = z.object({
  month: monthKey,
  /** null = capacity not configured. */
  plannedCapacityM3: volume.nullable(),
  basis: z.enum(['illustrative-demo', 'configured']),
});

export const demoDatasetSchema = z.object({
  referenceTime: instant,
  productionRecords: z.array(productionRecordSchema),
  deliveryNotes: z.array(deliveryNoteSchema),
  salesOrders: z.array(salesOrderSchema),
  productionOrders: z.array(productionOrderSchema),
  projects: z.array(projectSchema),
  capacityPlans: z.array(capacityPlanSchema),
});

export type ProductionRecord = z.infer<typeof productionRecordSchema>;
export type DeliveryNote = z.infer<typeof deliveryNoteSchema>;
export type SalesOrder = z.infer<typeof salesOrderSchema>;
export type ProductionOrder = z.infer<typeof productionOrderSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CapacityPlan = z.infer<typeof capacityPlanSchema>;
export type DemoDataset = z.infer<typeof demoDatasetSchema>;

/* ------------------------------------------------------------------ */
/* Dashboard snapshot (what the screen renders)                        */
/* ------------------------------------------------------------------ */

const trendBucketSchema = z.object({
  start: instant,
  end: instant,
  /** null = interval not yet reached; 0 = elapsed interval with no production. */
  volume: volume.nullable(),
});

const capacitySchema = z.object({
  month: monthKey,
  plannedCapacity: volume.nullable(),
  actualOutput: volume,
  /** Negative when output exceeds capacity; null when capacity is zero/unknown. */
  remaining: z.number().finite().nullable(),
  /** May exceed 100; null when capacity is zero/unknown. */
  percentUsed: z.number().finite().nonnegative().nullable(),
  unit: z.literal('m3'),
  basis: z.enum(['illustrative-demo', 'configured']),
});

export const dashboardSnapshotSchema = z
  .object({
    source: z.enum(['demo', 'sap']),
    selectedPeriod: z.enum(PERIODS),
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
    /** Current snapshots; unaffected by the selected period. */
    orders: z.object({
      openSalesOrders: count,
      activeProductionOrders: count,
      asOf: instant,
    }),
    /** Activity within the selected period. */
    output: z.object({
      concrete: z.object({
        total: volume,
        unit: z.literal('m3'),
        trend: z.array(trendBucketSchema).min(1),
        grades: z.array(z.object({ grade: z.string().min(1), volume })),
      }),
      delivered: z.object({
        total: count,
        unit: z.enum(['pieces', 'm3']),
        /** Number of delivery documents; a separate measure, never output. */
        documentCount: count,
      }),
    }),
    /** Always the month containing sourceDataAsOf. */
    capacity: capacitySchema,
    projects: z.array(
      z.object({
        code: id,
        name: z.string().min(1),
        percentComplete: z.number().finite().nonnegative(),
        basis: z.string().min(1),
      }),
    ),
  })
  .superRefine((s, ctx) => {
    const totalLitres = toLitres(s.output.concrete.total);
    const trendLitres = s.output.concrete.trend.reduce((sum, b) => sum + toLitres(b.volume ?? 0), 0);
    const gradeLitres = s.output.concrete.grades.reduce((sum, g) => sum + toLitres(g.volume), 0);
    if (trendLitres !== totalLitres) {
      ctx.addIssue({ code: 'custom', path: ['output', 'concrete', 'trend'], message: 'Trend does not add up to the concrete total' });
    }
    if (gradeLitres !== totalLitres) {
      ctx.addIssue({ code: 'custom', path: ['output', 'concrete', 'grades'], message: 'Grades do not add up to the concrete total' });
    }
    const { plannedCapacity, percentUsed, remaining } = s.capacity;
    const capacityKnown = plannedCapacity !== null && plannedCapacity > 0;
    if (!capacityKnown && (percentUsed !== null || remaining !== null)) {
      ctx.addIssue({ code: 'custom', path: ['capacity'], message: 'Percentage given without a known capacity' });
    }
  });

export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;
export type TrendBucket = DashboardSnapshot['output']['concrete']['trend'][number];
export type GradeVolume = DashboardSnapshot['output']['concrete']['grades'][number];
export type MonthlyCapacity = z.infer<typeof capacitySchema>;
export type ProjectProgress = DashboardSnapshot['projects'][number];
