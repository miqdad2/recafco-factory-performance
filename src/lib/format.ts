const volumeFormats = new Map<number, Intl.NumberFormat>();

/** m³ figures: grouped, up to `maxDecimals` decimals (default 1 for display). */
export function formatVolume(value: number, maxDecimals = 1): string {
  let format = volumeFormats.get(maxDecimals);
  if (!format) {
    format = new Intl.NumberFormat('en-GB', { maximumFractionDigits: maxDecimals });
    volumeFormats.set(maxDecimals, format);
  }
  return format.format(value);
}

const countFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
export const formatCount = (value: number) => countFormat.format(value);

const measureFormat = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A quantity in its own unit: pieces are whole; m² and m³ always keep one decimal so columns align. */
export function formatQuantity(value: number, unit: string): string {
  if (unit === 'pieces') return formatCount(value);
  return unit === 'm2' || unit === 'm3' ? measureFormat.format(value) : formatVolume(value);
}

/** Compact chart label: whole numbers, with one decimal only below 10 so small bars stay truthful. */
export const formatBarValue = (value: number, unit: string) =>
  unit === 'pieces' || value >= 10 ? formatCount(value) : formatVolume(value);
