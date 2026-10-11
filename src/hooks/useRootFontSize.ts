import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

function getSnapshot() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/**
 * Current root font size in px. Charts multiply rem values by this so canvas
 * text scales with the rest of the display (16px at 1080p, 32px at 4K).
 */
export function useRootFontSize(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}
