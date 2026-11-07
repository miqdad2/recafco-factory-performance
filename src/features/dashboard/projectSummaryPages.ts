/** Row indexes split into pages of at most `size` rows. */
export function chunkPages(count: number, size: number): number[][] {
  const pages: number[][] = [];
  for (let start = 0; start < count; start += size) {
    pages.push(Array.from({ length: Math.min(size, count - start) }, (_, i) => start + i));
  }
  return pages;
}

/**
 * Row indexes split into pages whose measured heights fit `available` pixels.
 * A row taller than the space still gets a page of its own, so nothing is lost.
 * Returns null when nothing can be measured (no layout yet), so callers fall back.
 */
export function fitPages(heights: readonly number[], available: number): number[][] | null {
  if (available <= 0 || heights.length === 0 || heights.some((h) => h <= 0)) return null;
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  heights.forEach((height, index) => {
    if (page.length > 0 && used + height > available) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(index);
    used += height;
  });
  pages.push(page);
  return pages;
}

const projects = (n: number) => `${n} ${n === 1 ? 'project' : 'projects'}`;

/**
 * "Showing 1–3 of 5 projects · Page 1 of 2". A single page reads "Showing 3 projects"
 * or "Showing 1 project"; a page holding one row reads "Showing 5 of 5 projects"; an
 * empty list gives no text, as the panel shows its own empty message.
 */
export function describePage(pages: readonly (readonly number[])[], page: number, total: number): string | null {
  if (total === 0 || pages.length === 0) return null;
  if (pages.length === 1) return `Showing ${projects(total)}`;
  const rows = pages[page] ?? [];
  const first = (rows[0] ?? 0) + 1;
  const last = (rows.at(-1) ?? 0) + 1;
  const range = first === last ? `${first}` : `${first}–${last}`;
  return `Showing ${range} of ${projects(total)} · Page ${page + 1} of ${pages.length}`;
}
