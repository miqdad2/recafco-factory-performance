import { describe, expect, it } from 'vitest';
import type { ItemRecord } from './contracts';
import { classifyLine, compareRows, normaliseUnit } from './productMapping';

const item = (itemGroup: string, overrides: Partial<ItemRecord> = {}): ItemRecord => ({
  itemCode: 'X',
  description: 'X',
  itemGroup,
  inventoryItem: true,
  finishedGoodsFlag: false,
  nosIsPhysicalCount: false,
  verifiedSubtype: null,
  ...overrides,
});

describe('classifyLine', () => {
  it('maps products by item group, whatever the Finished Goods flag says', () => {
    for (const finishedGoodsFlag of [true, false]) {
      expect(classifyLine(item('HOLLOWCORE', { finishedGoodsFlag }), 'm2', 5)).toMatchObject({ status: 'reported', product: 'hollowcore', unit: 'm2' });
    }
  });

  it('excludes each ineligible group even when flagged Finished Goods', () => {
    const cases = [
      ['RAW-MATERIAL', 'raw-material'],
      ['STEEL-SEMI', 'semi-finished'],
      ['BILLING-ADJ', 'billing-adjustment'],
      ['SERVICE', 'non-physical'],
    ] as const;
    for (const [group, reason] of cases) {
      expect(classifyLine(item(group, { finishedGoodsFlag: true }), 'Nos', 1)).toEqual({ status: 'excluded', reason });
    }
  });

  it('excludes non-inventory items in a product group', () => {
    expect(classifyLine(item('PRECAST', { inventoryItem: false }), 'm3', 1)).toEqual({ status: 'excluded', reason: 'non-physical' });
  });

  it('reports unknown items and unknown groups as unmapped, keeping their unit', () => {
    expect(classifyLine(undefined, 'm2', 5)).toMatchObject({ status: 'reported', product: 'unmapped', unit: 'm2' });
    expect(classifyLine(item('NEW-GROUP', { finishedGoodsFlag: true }), 'm3', 5)).toMatchObject({ status: 'reported', product: 'unmapped', unit: 'm3' });
  });

  it('treats Nos as pieces only for a verified item and a whole quantity', () => {
    const verified = item('PRECAST', { nosIsPhysicalCount: true });
    expect(classifyLine(verified, 'Nos', 3)).toMatchObject({ unit: 'pieces' });
    expect(classifyLine(verified, 'Nos', 2.5)).toMatchObject({ unit: 'nos' });
    expect(classifyLine(item('PRECAST'), 'Nos', 3)).toMatchObject({ unit: 'nos' });
  });
});

describe('normaliseUnit', () => {
  it('accepts spelling variants only', () => {
    expect(['m2', 'M²', ' SQM ', 'sq.m'].map(normaliseUnit)).toEqual(['m2', 'm2', 'm2', 'm2']);
    expect(['m3', 'M³', 'cum'].map(normaliseUnit)).toEqual(['m3', 'm3', 'm3']);
    expect(['Nos', 'NOS', 'No.'].map(normaliseUnit)).toEqual(['nos', 'nos', 'nos']);
  });

  it('keeps anything else as its own raw unit', () => {
    expect(normaliseUnit('LM')).toBe('raw:LM');
    expect(normaliseUnit('')).toBe('raw:');
  });
});

describe('compareRows', () => {
  it('orders by product, then unit, with unmapped and raw units last', () => {
    const rows = [
      { product: 'unmapped', unit: 'm2' },
      { product: 'precast', unit: 'raw:LM' },
      { product: 'precast', unit: 'pieces' },
      { product: 'hollowcore', unit: 'm2' },
      { product: 'precast', unit: 'm3' },
    ] as const;
    expect([...rows].sort(compareRows).map((r) => `${r.product}:${r.unit}`)).toEqual([
      'hollowcore:m2',
      'precast:m3',
      'precast:pieces',
      'precast:raw:LM',
      'unmapped:m2',
    ]);
  });
});
