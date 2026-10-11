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

const percentFormat = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export const formatPercent = (value: number) => `${percentFormat.format(value)}%`;

/** Whole-number percentage for compact progress figures, e.g. "80%". */
export const formatWholePercent = (value: number) => `${countFormat.format(value)}%`;
