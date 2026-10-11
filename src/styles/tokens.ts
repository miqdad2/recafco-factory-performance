/** Reads a CSS custom property so ECharts uses the same tokens as the components. */
export function cssVar(name: `--${string}`): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
