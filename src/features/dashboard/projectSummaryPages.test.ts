import { describe, expect, it } from 'vitest';
import { chunkPages, describePage, fitPages } from './projectSummaryPages';

describe('fitPages', () => {
  it('fills each page up to the measured space', () => {
    expect(fitPages([60, 60, 60, 60, 60], 190)).toEqual([[0, 1, 2], [3, 4]]);
  });

  it('gives a wrapped, taller row less company', () => {
    expect(fitPages([60, 90, 60, 60], 190)).toEqual([[0, 1], [2, 3]]);
  });

  it('keeps every row exactly once, even one taller than the space', () => {
    expect(fitPages([300, 60], 190)).toEqual([[0], [1]]);
  });

  it('declines to guess when nothing has been laid out', () => {
    expect(fitPages([0, 0], 190)).toBeNull();
    expect(fitPages([60], 0)).toBeNull();
    expect(fitPages([], 190)).toBeNull();
  });
});

describe('chunkPages', () => {
  it('splits a count into fixed pages', () => {
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(chunkPages(0, 4)).toEqual([]);
  });
});

describe('describePage', () => {
  const pages = [[0, 1, 2], [3, 4]];

  it('names the range, total and page', () => {
    expect(describePage(pages, 0, 5)).toBe('Showing 1–3 of 5 projects · Page 1 of 2');
    expect(describePage(pages, 1, 5)).toBe('Showing 4–5 of 5 projects · Page 2 of 2');
  });

  it('shows a single row on a page without a range', () => {
    expect(describePage([[0, 1], [2]], 1, 3)).toBe('Showing 3 of 3 projects · Page 2 of 2');
  });

  it('drops the page count when everything fits, with the singular for one', () => {
    expect(describePage([[0, 1, 2]], 0, 3)).toBe('Showing 3 projects');
    expect(describePage([[0]], 0, 1)).toBe('Showing 1 project');
  });

  it('says nothing for an empty list', () => {
    expect(describePage([], 0, 0)).toBeNull();
  });
});
