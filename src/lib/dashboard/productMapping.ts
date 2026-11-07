/**
 * Which item lines count as finished physical output, and under which product and
 * unit. Proposed demo rules, NOT confirmed SAP definitions; see docs/data-definitions.md.
 *
 * The Finished Goods flag is deliberately not used: SAP examples show it set
 * inconsistently, so item group and inventory status decide instead.
 */
import type { ItemRecord, ProductCategory, QuantityUnit, ReportProduct } from './contracts';

export const PRODUCT_BY_ITEM_GROUP: Readonly<Record<string, ProductCategory>> = {
  HOLLOWCORE: 'hollowcore',
  PRECAST: 'precast',
  GRC: 'grc',
};

export type ExclusionReason = 'raw-material' | 'semi-finished' | 'billing-adjustment' | 'non-physical';

export const EXCLUDED_ITEM_GROUPS: Readonly<Record<string, ExclusionReason>> = {
  'RAW-MATERIAL': 'raw-material',
  'STEEL-SEMI': 'semi-finished',
  'BILLING-ADJ': 'billing-adjustment',
  SERVICE: 'non-physical',
};

export type LineClassification =
  | { status: 'reported'; product: ReportProduct; unit: QuantityUnit; subtype: string | null }
  | { status: 'excluded'; reason: ExclusionReason };

/** Spelling variants only. Never converts one measure into another. */
export function normaliseUnit(uom: string): QuantityUnit {
  const text = uom.trim();
  const plain = text.toLowerCase().replace(/[\s.]/g, '');
  if (plain === 'm2' || plain === 'm²' || plain === 'sqm') return 'm2';
  if (plain === 'm3' || plain === 'm³' || plain === 'cum') return 'm3';
  if (plain === 'nos' || plain === 'no') return 'nos';
  return `raw:${text}`;
}

/**
 * Rules, first match wins:
 * 1. Excluded item group: raw material, semi-finished steel, billing adjustment, service.
 * 2. Non-inventory item: not physical output.
 * 3. Mapped item group: its product.
 * 4. Anything else, including an unknown item: reported as unmapped, never dropped.
 * Nos becomes "pieces" only for a whole quantity on a verified item.
 */
export function classifyLine(item: ItemRecord | undefined, uom: string, quantity: number): LineClassification {
  const excludedReason = item && EXCLUDED_ITEM_GROUPS[item.itemGroup];
  if (excludedReason) return { status: 'excluded', reason: excludedReason };
  if (item && !item.inventoryItem) return { status: 'excluded', reason: 'non-physical' };

  const unit = normaliseUnit(uom);
  const verifiedPieces = unit === 'nos' && item?.nosIsPhysicalCount === true && Number.isInteger(quantity);
  return {
    status: 'reported',
    product: (item && PRODUCT_BY_ITEM_GROUP[item.itemGroup]) ?? 'unmapped',
    unit: verifiedPieces ? 'pieces' : unit,
    subtype: item?.verifiedSubtype ?? null,
  };
}

/** A verified subtype becomes its own row; until then a product is split by unit alone. */
export const rowKey = (product: ReportProduct, unit: QuantityUnit, subtype: string | null = null) =>
  `${product}${subtype === null ? '' : `/${subtype}`}:${unit}`;

/** Rows always listed, including at zero, so the screen stays stable between periods. */
export const EXPECTED_ROWS: readonly RowIdentity[] = [
  { product: 'hollowcore', unit: 'm2' },
  { product: 'precast', unit: 'm3' },
  { product: 'precast', unit: 'pieces' },
  { product: 'grc', unit: 'm2' },
];

const PRODUCT_ORDER: readonly ReportProduct[] = ['hollowcore', 'precast', 'grc', 'unmapped'];
const UNIT_ORDER: readonly QuantityUnit[] = ['m2', 'm3', 'pieces', 'nos'];
const unitRank = (unit: QuantityUnit) => (UNIT_ORDER.includes(unit) ? UNIT_ORDER.indexOf(unit) : UNIT_ORDER.length);

export interface RowIdentity {
  product: ReportProduct;
  unit: QuantityUnit;
  subtype?: string | null;
}

/** Fixed display order shared by the cards, comparison table and chart selector. */
export function compareRows(a: RowIdentity, b: RowIdentity): number {
  return (
    PRODUCT_ORDER.indexOf(a.product) - PRODUCT_ORDER.indexOf(b.product) ||
    (a.subtype ?? '').localeCompare(b.subtype ?? '') ||
    unitRank(a.unit) - unitRank(b.unit) ||
    a.unit.localeCompare(b.unit)
  );
}
