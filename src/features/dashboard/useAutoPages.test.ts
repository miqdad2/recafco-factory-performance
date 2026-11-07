// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_PAGE_MS, useAutoPages } from './useAutoPages';

let visibility: DocumentVisibilityState = 'visible';
function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function usePager(initial: { enabled: boolean; paused?: boolean; pageCount?: number }) {
  const [options, setOptions] = useState({ paused: false, pageCount: 3, ...initial });
  const [page, setPage] = useState(0);
  const running = useAutoPages({ ...options, setPage });
  return { page, running, setOptions };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useAutoPages', () => {
  it('does nothing while switched off', () => {
    const { result } = renderHook(() => usePager({ enabled: false }));
    advance(AUTO_PAGE_MS * 3);
    expect(result.current.page).toBe(0);
    expect(result.current.running).toBe(false);
  });

  it('advances every 15 seconds and loops to the first page', () => {
    const { result } = renderHook(() => usePager({ enabled: true }));
    expect(result.current.running).toBe(true);
    advance(AUTO_PAGE_MS - 1);
    expect(result.current.page).toBe(0);
    advance(1);
    expect(result.current.page).toBe(1);
    advance(AUTO_PAGE_MS);
    expect(result.current.page).toBe(2);
    advance(AUTO_PAGE_MS);
    expect(result.current.page).toBe(0);
  });

  it('holds still while paused, then restarts with a fresh interval', () => {
    const { result } = renderHook(() => usePager({ enabled: true }));
    advance(10_000);
    act(() => result.current.setOptions((o) => ({ ...o, paused: true })));
    advance(AUTO_PAGE_MS * 4);
    expect(result.current.page).toBe(0);
    act(() => result.current.setOptions((o) => ({ ...o, paused: false })));
    advance(AUTO_PAGE_MS - 1);
    expect(result.current.page).toBe(0); // the earlier 10 s do not carry over
    advance(1);
    expect(result.current.page).toBe(1);
  });

  it('never runs with fewer than two pages', () => {
    const { result } = renderHook(() => usePager({ enabled: true, pageCount: 1 }));
    advance(AUTO_PAGE_MS * 3);
    expect(result.current.running).toBe(false);
    expect(result.current.page).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('suspends while the tab is hidden and resumes without skipping missed pages', () => {
    const { result } = renderHook(() => usePager({ enabled: true }));
    advance(10_000);
    act(() => setVisibility('hidden'));
    expect(result.current.running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    advance(AUTO_PAGE_MS * 10); // a long time away
    act(() => setVisibility('visible'));
    expect(result.current.page).toBe(0);
    advance(AUTO_PAGE_MS - 1);
    expect(result.current.page).toBe(0);
    advance(1);
    expect(result.current.page).toBe(1); // one step, not ten
  });

  it('clears its timer and visibility listener on unmount', () => {
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => usePager({ enabled: true }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
