import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  header: ReactNode;
  cards: ReactNode;
  trend: ReactNode;
  capacity: ReactNode;
  products: ReactNode;
  projects: ReactNode;
  footer: ReactNode;
  busy?: boolean;
}

/**
 * Shared screen grid for the loaded, loading and error states, so the layout
 * never jumps. On large displays the page is exactly one viewport high and the
 * trend/capacity row takes the remaining height. Below the rem minimum
 * (e.g. 1366×768, the `compact` variant) the page grows to its content and
 * scrolls vertically instead of squeezing panels; narrow screens stack panels.
 */
export function DashboardLayout({ header, cards, trend, capacity, products, projects, footer, busy }: DashboardLayoutProps) {
  return (
    <main
      aria-busy={busy || undefined}
      className="flex min-h-dvh flex-col gap-5 p-6 lg:grid lg:h-dvh lg:min-h-[66rem] lg:compact:h-auto lg:grid-rows-[auto_auto_minmax(20rem,1fr)_auto_auto] lg:compact:grid-rows-[auto_auto_minmax(27rem,1fr)_auto_auto]"
    >
      {header}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>

      <div className="grid min-h-0 grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex min-h-0 min-w-0 flex-col lg:col-span-8">{trend}</div>
        <div className="flex min-h-0 min-w-0 flex-col lg:col-span-4">{capacity}</div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex min-h-0 min-w-0 flex-col lg:col-span-5">{products}</div>
        <div className="flex min-h-0 min-w-0 flex-col lg:col-span-7">{projects}</div>
      </div>

      {footer}
    </main>
  );
}
