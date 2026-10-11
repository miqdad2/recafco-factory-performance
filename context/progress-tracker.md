# Progress Tracker

Last updated: 11 October 2026 (Asia/Kuwait).

## Current phase
Unit 3 (working period controls) complete. Ready for Unit 4.

## Current goal
Standalone RECAFCO Factory Performance demo with a modern, readable single-screen overview.

## Completed
### Specification (before Unit 1)
- Adapted root CLAUDE.md and six context templates for this project.
- Recorded management audience, 24/7 display intent and demo-first integration plan.
- Reviewed five SAP screenshots and three visual inspiration images.
- Recorded SAP Business One 9.3 for SAP HANA, PL05 from the About screenshot.
- Defined initial four KPI cards, production trend, monthly capacity, grade mix and project panels.
- Separated current order snapshots from selected-period production/delivery totals.
- Recorded unresolved report/query meanings and demo assumptions.

### Unit 1: scaffold and static layout (11 Oct 2026)
- Scaffolded React 19 + TypeScript 6 (strict) + Vite 8 + Tailwind CSS 4 + ECharts 6 with npm; package-lock.json committed. Node 24.17 used; engines `>=22.12`.
- Scripts: `dev` (port 5180), `build`, `preview` (port 5181, local check only), `lint`, `typecheck`, `test` (Vitest).
- Theme tokens from ui-context.md as CSS variables (`src/styles/index.css`); Inter bundled locally via @fontsource-variable/inter (no CDN).
- Display scaling: root font = 16px at 1920×1080, 32px at 3840×2160, scaling by the tighter of width/height, never below 13px.
- Static composition: header (RECAFCO text wordmark, title, period controls, sample date, Demo data badge, live Kuwait clock), four KPI cards, production trend chart (ECharts), monthly capacity semicircle gauge (SVG) with actual/capacity/remaining, grade mix bars, four project progress bars, footer with demo status and last demo update.
- Snapshot cards marked "NOW · As of 14:00"; period cards marked "TODAY". Capacity panel labelled October 2026, illustrative.
- Future hours in the trend shown as a "Not yet reached" band, distinct from real zero bars (02:00–04:00 show 0).
- Data layer separated: snapshot types, pure calculations, a static sample fixture and a replaceable `DashboardDataProvider` interface. (The static sample was replaced in Unit 2.)
- ECharts wrapper creates/disposes the instance, ResizeObserver and animation frame; redraws after web font load. Clock interval and resize listener cleaned up on unmount.
- Weekly/Monthly/Yearly buttons are visibly disabled with a footer note ("next demo step"); no filter or refresh behaviour is implied.

### Unit 2: demo records, period calculations, async demo data (11 Oct 2026)
Acceptance criteria used: the tracker defined Unit 2 only as a scope line. The user's Unit 2 brief plus the code-standards verification list were applied, and all of them pass (see Verification status).
- Added `@tanstack/react-query` 5 and `zod` 4 (no other dependencies).
- `lib/dashboard/periods.ts`: Asia/Kuwait windows using a fixed UTC+03:00 offset, cross-checked against Intl in tests. It never uses local-time Date methods.
  - Daily: [Kuwait midnight, next midnight), hourly buckets.
  - Weekly: [Sunday 00:00, next Sunday), daily buckets.
  - Monthly: calendar month, daily buckets.
  - Yearly: calendar year, monthly buckets.
- `lib/dashboard/contracts.ts`: Zod schemas for the source records (production batches, delivery notes, sales orders, production orders, projects, capacity plans) and for the snapshot. Types are inferred from the schemas. Snapshot validation also checks that the trend and grade sums equal the total, and rejects a percentage given without a known capacity.
- `lib/dashboard/aggregate.ts`: pure calculations from the records. Volumes are summed in whole litres so the trend, grade breakdown and total match exactly. Beyond five grades, the smallest are grouped as "Other grades".
- `lib/dashboard/fixtures/`: seeded, reproducible dataset from 1 Jan 2026 to the reference time (8,807 production batches and 1,341 delivery notes). Assumptions and status rules are documented in `fixtures/README.md`.
- `lib/dashboard/errors.ts` / `validate.ts`: `DashboardDataError` with codes `invalid-response`, `invalid-source-data`, `aborted` and `unavailable`. Validation findings are short and safe to display.
- `lib/dashboard/providers/demo.ts`: async provider with a 450 ms simulated delay and AbortSignal support. It validates its source records once and validates every snapshot it returns. `fetchedAt` is the real load time; `sourceDataAsOf` is the fixed reference time.
- TanStack Query hook loading the Daily view (replaced in Unit 3 by `usePeriodSelection`).
  - No polling, no refetch on window focus or reconnect.
  - Invalid data is never retried; other failures are retried twice.
- UI:
  - The loaded, loading and initial-error states share the same layout (`DashboardLayout`). Loading shows solid placeholder blocks, never zeros.
  - The error state offers "Try again".
  - The Delivered Output card shows the delivery note count as a separate caption.
  - Project percentages are rounded to whole numbers for display.
  - Trend axis labels adapt to hours, days or months, ready for Unit 3.
- Fixed a Unit 1 CSS bug: the `compact` variant's height condition was being dropped by Tailwind. It is now written in block form.
- Removed the Unit 1 static sample fixture and provider.

### Unit 3: working period controls (11 Oct 2026)
**Acceptance criteria.** All pass; evidence is under Verification status.
1. Daily, Weekly, Monthly and Yearly are enabled. Each selection updates the range, Concrete Produced, Delivered Output, delivery note count, trend, grade breakdown and period labels.
2. These stay identical across selections: Open Sales Orders, Active Production Orders, Monthly Batch Plant Capacity, project progress, and the demo reference timestamp.
3. While another period loads, the last successful view stays visible with its own labels, and "Loading <Period>…" is shown.
4. Figures, range and labels change together, and only after the new snapshot passes validation. Old figures never appear under a new label.
5. Rapid selections: only the latest request can be displayed. Obsolete requests are cancelled, and late responses do not replace newer selections.
6. A failed selection keeps the last successful view with correct labels, names the failed period and offers Try again. The error clears after a successful retry or a different successful selection.
7. Query keys are distinct per data scope (demo reference timestamp) and period. There is no polling and no refetch on focus or reconnect.
8. All four charts are readable at 1920×1080 with no scrolling, clipping or overlapping labels. The Monthly chart avoids crowded value labels without shrinking text.
9. The trend reconciles with Concrete Produced, and elapsed zero intervals stay distinct from future intervals.
10. Accessibility:
    - Semantic buttons with selected (aria-pressed), pending and failed states; selection does not rely on colour alone.
    - Tab reaches every control; Enter and Space activate them.
    - Status is announced through a polite live region; the clock is outside any live region.
    - Focus is stable when data changes.
11. Over-capacity and unknown-capacity displays are checked on screen using temporary fixtures, then restored.
12. Type check, lint, tests and build pass. The bundle-warning limit is not raised further.

**Changes**
- `features/dashboard/usePeriodSelection.ts`: keeps the requested period and the displayed period separate. A request is committed during render once its validated snapshot exists, so no frame mixes old figures with new labels. The hook returns `loading`, `error`, or `ready` together with `pending` or `failure` details.
- `features/dashboard/snapshotQuery.ts`:
  - Query key: `['dashboard', 'snapshot', { scope, period }]`.
  - `queryFn` passes the AbortSignal, so TanStack Query cancels requests that nobody is waiting for any more.
  - Shared `QueryClient` defaults: `staleTime: Infinity`, no focus or reconnect refetch, invalid data never retried, other failures retried twice.
- `DashboardDataProvider.scope`: the demo provider uses `demo@<reference time>`. `features/dashboard/dataProvider.ts` lets tests inject a controllable provider.
- Period buttons:
  - Requested and shown: solid red.
  - Requested but loading: red outline with "…".
  - Requested but failed: red outline with "!".
  - Still shown while another period loads: raised fill.
  - All states use `aria-pressed`. Buttons are never disabled during loading, so focus stays where it is.
- Status line (`PeriodStatus`, a polite live region): "Showing <range>", "· Loading Monthly…", or "· Yearly did not load" with a Try again button. When Try again starts a retry, focus moves to the requested period button.
- The header is a 1fr | auto | 1fr grid, so the buttons stay centred while the status line changes length.
- Range formats: "Wed 14 Oct 2026", "Sun 11 – Sat 17 Oct 2026" (cross-month and cross-year forms tested), "October 2026", "2026". The reference timestamp moved to the footer as "Demo data as of Wed 14 Oct 2026, 14:00".
- Trend chart:
  - The panel header shows the total.
  - Value labels on every bar for Daily, Weekly and Yearly.
  - Monthly: only "0" on zero-output days. The highest day (teal) and today (violet) are coloured and described in a sentence under the chart.
  - Axis labels: every other hour or day for Daily and Monthly, all labels for Weekly and Yearly.
  - Hover tooltip for extra detail only.
- Capacity panel: an unknown value shows "Not set" with no unit, and the caption becomes "no capacity set for this month". Over-capacity percentages are drawn smaller so they clear the arc.
- Grade panel columns widened for "Other grades" and Yearly figures. The focus ring is now a 4 px white outline outside Tailwind's layers.
- Compact screens (1366×768) now grow in height and scroll instead of squeezing the lower panels; before this, the lower panels' content spilled.
- Bundle: removed the Unit 2 limit raise (900 kB) and restored Vite's default 500 kB. Libraries now go into separate chunks (echarts, react, data). See Verification status for sizes.
- Dev dependencies added for component tests: @testing-library/react, @testing-library/dom, @testing-library/user-event, jsdom.

### Presentation polish for the first management presentation (11 Oct 2026, separate from Unit 4)
No calculations, records, provider, period logic or request handling changed. No new KPIs.
- **Demo date wording:** the fixed demo date (Wed 14 Oct 2026) differs from the live Kuwait date, so no label may suggest sample figures describe the real day.
  - Period chips read "Selected day / week / month / year".
  - Order cards read "Demo snapshot" plus "Wed 14 Oct, 14:00".
  - Trend and grade notes say "selected day/week/…".
  - The Monthly summary says "Selected day, to 14:00: …".
  - A component test asserts no "today", "now" or "this week/month/year" appears in any period.
- **Readability:**
  - Chart axes and bar values raised from 20 to 22 px; the status line is 22 px.
  - The trend total is bold at 22 px.
  - Card chips are sentence case, so chip and caption fit on one line at 1080p.
  - The lower row is rebalanced to 5/7 columns so "Selected month · m³" fits beside the grade title.
  - Project codes moved onto their own line.
  - The Daily y-axis has about 3 gridlines instead of 7 crowded labels.
- **Capacity panel:**
  - Title "Monthly Plant Capacity", the month on the right, and the subtitle "Concrete batch plant · illustrative".
  - On full screens (new `wall` variant) the figures sit in a column beside the gauge, so the gauge and percentage grow (about 60 px at 1080p). 1366×768 keeps the stacked layout.
  - The unknown-state caption is shortened to "capacity not set" so it stays inside the arc.
- **Projects:**
  - Panel note "Delivery progress · demo".
  - The calculation basis is kept as screen-reader text linked to the list, and in `fixtures/README.md`.
  - Bars use the production blue.
- **Chart clutter:**
  - "0" labels removed. Zero-output intervals are drawn as grey baseline marks with a "No production" legend, distinct from the "Not yet reached" area.
  - Productive-bar labels, the total and the Monthly highlights are kept.
- **Footer:** "Demo data · SAP not connected" · "Demo reference time: Wed 14 Oct 2026, 14:00" · "Last successful demo load: <real load time>". The duplicate "illustrative" note was removed; the panels carry it.
- RECAFCO logo kept. Screenshot of the polished Daily view: `docs/screenshots/daily-1920x1080.png`.
- Validation:
  - Type check and lint pass. Tests: 77 pass (2 added: one for chart label rules, one for date wording; existing tests updated for the new wording).
  - Build passes with no chunk warning: 282.8 kB compressed JavaScript; the ECharts chunk is unchanged at 497.1 kB minified.
  - Browser (headless Edge via DevTools protocol):
    - All four periods at 1920×1080: no scroll, no horizontal overflow, no spill. Screenshots reviewed with no overlapping labels.
    - All four periods at 1366×768: no horizontal overflow; vertical scroll only.
    - Keyboard: Tab, Enter and Space work and focus stays put.
    - Temporary over-capacity (3,000 m³) and unknown-capacity fixtures checked in the new gauge layout, then restored (no TEMP markers; rebuilt).

## In progress
None.

## Next up
- **Unit 4:** display resilience.
  - Fullscreen control with fallback.
  - 60-second refresh that keeps the last valid data and its timestamp after a failure.
  - Delayed/stale state after an earlier success, and recovery.
  - Empty-period message.
  - Account for background-tab throttling.
- **Unit 5:** review. Long-session resource checks, real-screen and viewing-distance check, management review package.

## Pending behaviours (not built yet; do not demo as working)
- Automatic refresh and simulated new records. Data loads once per period per page load.
- Fullscreen control.
- Empty-period message ("No production recorded for this period") and the delayed/stale state after an earlier success.

## Unit 3 limitations
- The ECharts chunk is 497 kB minified, only 3 kB under Vite's 500 kB warning. Any further ECharts feature will trigger the warning; the remedy would be lazy-loading the chart rather than raising the limit.
- The yearly axis shows "Sept" because that is the en-GB short-month form from Intl.
- At 1366×768 the Delivered Output caption and some project names wrap onto two lines. This is readable and the page scrolls vertically as allowed.
- Not yet checked: screen-reader output with real assistive technology (only the ARIA roles and attributes were checked), mobile width, long sessions.

## Unit 2 demo assumptions (illustrative, not SAP definitions)
- Reference timestamp: **Wed 14 Oct 2026, 14:00 Asia/Kuwait** (`fixtures/catalog.ts`). It is separate from the live clock and from `fetchedAt`.
- Records are fictional, prefixed `DEMO-` / "Demo Customer". Seed `20261014`.
- Factory pattern:
  - Production Sunday–Thursday about 05:00–23:00 plus 00:00–02:00 night batches; Saturday morning only; Friday off.
  - 02:00–05:00 is never scheduled, and about 5% of hours are random stoppages.
  - Output varies by season.
- Order rules:
  - Open sales order = status open + posted before the reference time + some line with ordered − delivered > 0.
  - Active production order = status released + created before the reference time + planned − completed > 0.
- Delivered Output = pieces on completed delivery notes (cancelled excluded). The note count is a separate measure.
- Project completion = (opening delivered + delivered to the reference time) ÷ planned pieces.
- Capacity: illustrative 9,000 m³ per month. Actual output is the reference month's production from the same records.
- Figures at the reference time:
  - Daily: 152.3 m³ and 21 pieces on 3 notes.
  - Weekly: 1,142.6 m³. Monthly: 3,406.8 m³ (capacity 37.9%). Yearly: 66,197.9 m³.
  - 43 open sales orders and 25 active production orders.
  - Projects: 80%, 48%, 27%, 83%.
- Trend bar labels show whole m³; totals show one decimal.
- The header uses the supplied RECAFCO logo (`recafco-logo.png`), cropped and resized to `public/brand/recafco-logo.png` (480×373). It sits on a white tile so the dark-grey Arabic wordmark stays readable on the navy theme (11 Oct 2026).

## Proposed choices awaiting review
- Screen title: RECAFCO Factory Performance.
- Navy theme with red brand accent.
- Initial selection: Daily.
- Four headline cards, with capacity in its own large panel.
- Sunday-start week; calendar months/years; Kuwait midnight boundaries.
- 60-second refresh.
- Delivered output measured in precast pieces for initial demo.
These can be changed without implying prior management approval.

## Open questions
### Display and design
- Actual screen size, native resolution, browser/OS scaling and viewing distance?
- Is the supplied logo the approved version, and is a white tile acceptable on the dark theme (or is there a light/reversed variant)? Exact brand colours?
- Final title and management's preferred panel priority?

### Business definitions
- What do Day T.VOL and Day P.VOL mean? Which is the official concrete output measure?
- How are existing cockpit card values calculated and filtered?
- Which sales order lines/statuses constitute outstanding factory demand?
- Which SAP production statuses and remaining-quantity rules define active orders?
- Should deliveries show pieces, m³, document count, or separately labelled quantities?
- One batching plant or several? What is each planned monthly capacity?
- Does capacity use scheduled shifts/hours, rated throughput and downtime?
- Factory week start, shift-day cutoff and fiscal/calendar year?
- Basis of project completion; which four projects should be selected?
- Are targets and meaningful prior-period comparisons required?

### Later integration and access
- Is Service Layer installed and usable on the actual SAP environment?
- Consultant-approved read-only source for each metric and any custom fields/queries?
- Who authorizes the display, and what restricted session model suits 24/7 viewing?
- Which internal host, process manager, ports and browser kiosk setup?
- Required freshness and acceptable SAP collection load?
- Is historical storage necessary, or can SAP supply all periods?

## Architecture decisions
- Standalone project prevents changes to working RECAFCO systems.
- React/TypeScript/Vite/Tailwind/ECharts/TanStack Query are the selected demo stack following the user's requested package update.
- No database or API service required initially; queries call an asynchronous in-browser demo provider.
- Demo provider uses a shared validated snapshot contract; a future HTTP provider calls NestJS.
- Replaced the earlier Next.js specification with React + Vite because this is a single interactive internal display with a separate future integration backend.
- Production frontend is static dist/ served by an internal web server; Vite preview is local verification only.
- NestJS collector and SAP connector are future work after approval.
- Real SAP credentials never reach the display browser.
- Monthly capacity stays explicit; period changes do not redefine current snapshots.
- Unit 1: TanStack Query and Zod deferred to Unit 2 (added in Unit 2).
- Unit 2: Kuwait period maths uses a fixed UTC+03:00 offset (Kuwait has no daylight saving), verified against Intl. Display formatting uses Intl with Asia/Kuwait.
- Unit 2: volumes are summed in whole litres (0.001 m³) for exact reconciliation; m³ is converted only after summing.
- Unit 2: query freshness for this unit: `staleTime: Infinity`, no polling or focus/reconnect refetch. Unit 4 sets the 60-second refresh.
- Unit 3: requested and displayed periods are separate state. The displayed snapshot carries its own period and range, so labels are always derived from the figures they describe.
- Unit 3: query keys include the provider's data scope, so cached snapshots from different sources or reference times never mix.
- Unit 3: Monthly value labels use highlight sentences under the chart instead of text over 31 narrow bars.
- Polish: zero-output intervals are grey baseline marks (ECharts `barMinHeight`) plus a legend, replacing "0" labels.
- Polish: demo wording uses "Selected …" and "Demo snapshot" because the fixed demo date is not the live date.
- Unit 3: the bundle-size warning is handled by splitting chunks, not by raising the limit.
- Unit 1: monthly capacity gauge is an inline SVG semicircle (scales without clipping, crisp text); ECharts is used for the production trend. Grade mix and project bars are HTML/CSS for legible text.
- Unit 1: no shadcn/ui or Lucide added yet; plain semantic buttons suffice. Revisit if fullscreen/icon controls need them.

## Verification status
- Documentation consistency review: completed. No remaining Next.js directive found; only historical references to its replacement.
- Unit 1 (11 Oct 2026): `npm run typecheck` pass; `npm run lint` pass; `npm test` pass (6 tests: sum skips future buckets, capacity %, zero/unknown capacity → null, over-capacity preserved, sample totals reconcile with trend and grade sums, units distinct); `npm run build` pass (JS 709 kB / 234 kB gzip, mostly ECharts).
- Unit 1 browser check (headless Edge screenshots of `vite preview`): 1920×1080 fits with no scrolling, no clipping; 3840×2160 identical layout at 2× scale, no scrolling; 1366×768 one header row, no horizontal overflow, scrolls vertically to show grade/projects/footer (allowed). Trend and gauge size to their panels. Real-screen/viewing-distance check still pending.
- Unit 2 (11 Oct 2026):
  - `npm run typecheck` pass; `npm run lint` pass; `npm run build` pass (JS 843 kB / 273 kB gzip; warning limit raised to 900 kB).
  - `npm test`: 59 tests pass in 4 files, running under TZ=America/Los_Angeles to prove local time-zone independence.
  - Coverage:
    - Kuwait midnight, including 23:59:59.999 versus 00:00.
    - Sunday-start weeks, including a week crossing 2025/2026.
    - Month and year rollover, leap February 2028 (29 buckets) and leap-day boundaries.
    - Records exactly at the range start (included), range end (excluded) and as-of time (excluded).
    - Trend and grade totals equal Concrete Produced for all four periods.
    - Pieces versus delivery note count, with cancelled and duplicate notes.
    - Order status and remaining-quantity rules.
    - Order snapshots, capacity and projects identical across periods.
    - Capacity stays tied to the reference month and equals the Monthly total.
    - Zero, unknown and over-capacity.
    - Future (null) versus elapsed zero intervals.
    - Reproducibility and no records after the reference time.
    - Invalid provider responses: missing fields, NaN/negative/fractional counts, unreconciled totals, percentage without capacity, unknown source.
    - Invalid source records, and cancellation.
- Unit 2 browser check (headless Edge, `vite preview`):
  - Loaded Daily view fits 1920×1080 with no scrolling or clipping. 3840×2160 shows the same layout. 1366×768 scrolls vertically only.
  - Loading state (captured mid-delay) and initial-error state (via a temporary broken-data build, since reverted) keep the full layout without overflow and show no zeros.
- Unit 3 (11 Oct 2026):
  - `npm run typecheck` pass; `npm run lint` pass.
  - `npm test`: 75 tests pass in 6 files. 16 are new:
    - 4 chart-label tests.
    - 12 component tests (jsdom) with a controllable provider, covering:
      - Initial loading and initial-failure recovery.
      - Switching across all four periods, with old figures and labels kept during loading.
      - Figures and labels committing together.
      - Snapshot and monthly panels unchanged.
      - Rapid switching with obsolete requests aborted and late responses ignored.
      - An out-of-order response after returning to the shown period.
      - A failed selection keeping the last view, then retry recovery with focus handoff.
      - The error clearing after a different successful selection, and invalid data reported as failing checks.
      - Tab, Enter and Space with focus stability.
      - aria-pressed, a polite live region, and the clock outside it.
  - `npm run build` pass with Vite's default 500 kB chunk warning and no warning emitted.
  - Bundle, two measures:
    - Vite's chunk warning measures each minified, uncompressed file: echarts 497.1 kB, react 218.8 kB, data (TanStack Query + Zod) 117.9 kB, app 36.6 kB, runtime 0.7 kB.
    - Compressed transfer: 167.8 + 68.3 + 33.5 + 12.7 + 0.4 = **282.7 kB of JavaScript**, plus 5.1 kB of CSS and the Inter web font.
    - Unit 2's single file was 843 kB minified / 273 kB compressed. The increase comes from the chart tooltip and the chunk-split overhead.
- Unit 3 browser check (headless Edge driven over the DevTools protocol against `vite preview`):
  - 1920×1080, all four periods: no page scroll, no horizontal overflow, no section or card spilling its box. Screenshots reviewed with no overlapping labels.
  - Pending states read "Showing <old range> · Loading <Period>…".
  - 1366×768, all four periods: no horizontal overflow, no spill; vertical scroll only.
  - Keyboard: Tab reaches Daily → Weekly → Monthly → Yearly. Enter selected Weekly and Space selected Monthly; focus stayed on the activated button after the data changed. The clock is not inside a live region, and the focus ring is visible.
  - Temporary fixtures, all restored afterwards (verified no TEMP markers remain, then rebuilt):
    - Capacity 3,000 m³: shows 113.6% "over monthly capacity", full arc, "Above capacity 406.8 m³".
    - Capacity unknown: shows "Not available", "no capacity set for this month", "Not set" with no unit.
    - Failing Yearly provider: "Showing Wed 14 Oct 2026 · Yearly did not load" with Try again; layout intact.
- Not yet checked: screen-reader output with real assistive technology, mobile width, long-session resource growth.
- Screen/viewing-distance validation: pending.
- 24/7 endurance validation: pending.
- SAP connectivity/data reconciliation: not attempted.
- Management design/functionality approval: pending.
- Deployment: not attempted.

## Session notes
The user requested project-specific versions of seven generic Markdown templates.
The supporting screenshots are references, not validated data mappings.
Historical production figures refer to 25 June 2026; do not present them as current data.
Work can proceed on the demo while SAP questions are unresolved.
The starter package now uses React + Vite throughout. Do not follow the earlier Next.js scaffolding prompt.
11 Oct 2026: presentation polish completed (wording, readability, capacity, projects, chart clutter, footer); recorded separately from Unit 4.
11 Oct 2026: Unit 3 built. All four period controls work; explicit acceptance criteria were recorded above, and all pass.
11 Oct 2026: Unit 2 built. Demo data now comes from seeded records via the async demo provider and TanStack Query. The tracker's Unit 2 scope line had no formal acceptance list; the user's brief served as the criteria.
11 Oct 2026: Unit 1 built. Run `npm install`, then `npm run dev` and open http://localhost:5180. Official logo not supplied; text placeholder used.
