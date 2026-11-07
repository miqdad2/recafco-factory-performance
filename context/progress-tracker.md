# Progress Tracker

Last updated: 1 November 2026 (Asia/Kuwait).

## Current phase
Wording refinement complete, awaiting review. Unit 4 is next. Live SAP integration has not started. Earlier entries below are history: panels and rules they mention may since have been replaced.

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
2. These stay identical across selections: Current Sales Orders, Active Production Orders, Monthly Batch Plant Capacity, project progress, and the demo reference timestamp.
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

### Management presentation design (11 Oct 2026, separate from Unit 4)
No calculations, records, provider, period switching, loading or error behaviour changed. No new metrics.
- **Header:**
  - Logo proportions kept on a white tile, plus a divider and the title "Factory Performance" at 40 px extra-bold.
  - Amber-tinted Demo data badge.
  - Clock labelled "Current time", 12-hour with uppercase AM/PM, plus the date; the word "Kuwait" removed. Asia/Kuwait is still used internally.
- **12-hour time everywhere visible:** `formatKuwaitTime` now builds "1:05 PM" from Kuwait civil time (midnight "12:00 AM", noon "12:00 PM"); `formatKuwaitHour` gives axis labels like "6 AM". This applies to snapshot, footer and legend times.
- **KPI cards:**
  - 76 px figures, 64 px for values longer than 6 characters, with bottom-aligned figure rows and 28 px units.
  - Slate strip for demo snapshots, blue for period output; "Volume produced" caption removed.
  - Panel depth via `--shadow-panel`.
- **Trend:**
  - Lighter-blue emphasis on the interval containing the demo reference time (Weekly selected day, Monthly selected day, Yearly current month), with a legend.
  - Monthly prints only the highest bar's value; the selected-day and highest-day sentences sit under the chart.
  - Grey zero marks kept. Wider bars, more top spacing, softer gridlines.
- **Capacity:** figures back beneath the gauge in three aligned columns; thinner arc and larger percentage text that clears the arc; over-capacity caption shortened to "over capacity". Turquoise stays neutral. The unused `wall` CSS variant was removed.
- **Lower panels:** grade bars switched from turquoise to production blue; project percentage 32 px and progress bar 16 px.
- **Card title:** "Current Sales Orders" — this rename was applied across code, tests and context docs, apparently by the user, and was kept as is.
- **Motion:** ECharts, control and progress transitions only, all respecting reduced motion. A KPI fade-in was tried and removed because headless rendering left it at low opacity.
- **Tests:** 83 pass (6 new):
  - 4 for 12-hour formatting, including midnight, noon, timezone independence and axis hours.
  - Chart label rules rewritten for emphasis and the legend (7 tests).
  - Existing tests updated for "2:00 PM" times.
- Type check, lint and build pass with no chunk warning (282.9 kB compressed JS).
- **Browser checks** (headless Edge via DevTools protocol):
  - 1920×1080, all four periods: no scroll, no horizontal overflow, no spill, no overlapping or truncated labels in reviewed screenshots.
  - 3840×2160 matches 1080p at 2× scale.
  - 1366×768, all four periods: no horizontal overflow (vertical scroll only; the title wraps to two lines there).
  - Loading, pending, failed selection, unknown capacity and over-capacity (temporary fixtures, restored) all keep the layout.
  - Keyboard: Tab, Enter and Space work, focus stays put, and the focus ring is visible.
- **Screenshots:** `docs/screenshots/before/` (pre-change) and `docs/screenshots/after/` (final; 12 images), plus `docs/screenshots/daily-1920x1080.png` (updated).

### Element production and product categories (12 Oct 2026, separate from Unit 4)
The KPIs now count finished elements instead of concrete volume. Design, period controls, async provider, loading/error behaviour and the 12-hour clock are unchanged.
- **Revised KPI definitions** (demo; SAP mapping pending):
  - **Produced Elements:** whole pieces on completed element-production records in the selected period. Not derived from concrete volume; the previous 152.3 m³ was not relabelled.
  - **Delivered Element:** pieces on completed delivery notes (unchanged source), with the delivery-note count shown separately.
  - **Production Trend:** produced pieces per hour, day or month (same grouping as before). Future intervals and elapsed zero-production intervals stay distinct.
  - **Production by Product:** pieces per demo category: Hollowcore, Precast and GRC. Categories are mutually exclusive and every category is always listed exactly once. Concrete grades were removed from the screen.
  - **Monthly Plant Capacity:** batching-plant concrete m³ against the illustrative 9,000 m³ plan (unchanged values), labelled "Batching plant · concrete m³ · illustrative".
- **Contracts** (`contracts.ts`):
  - New `elementRecords` (category plus positive integer pieces) and renamed `concreteBatches` (m³).
  - Snapshot `output.elements` (integer total, `pieces` trend, `products`) replaces `output.concrete`.
  - Validation rejects fractional counts, totals that don't reconcile, and duplicate or missing categories.
- **Calculations** (`aggregate.ts`): one integer bucketing function serves pieces and litres. `piecesByProduct` always returns all three categories. Grade grouping was removed.
- **Fixtures:**
  - Element records come from a separate seed (`DEMO_ELEMENT_SEED`), so deliveries, orders, projects and capacity are unchanged.
  - Rates were tuned so production exceeds deliveries in every period.
  - Assumptions and pending SAP questions are in `fixtures/README.md`.
- **Figures at the reference time:**

  | Period | Produced | Hollowcore / Precast / GRC | Delivered |
  |---|---|---|---|
  | Daily | 50 | 27 / 17 / 6 | 21 |
  | Weekly | 308 | 175 / 94 / 39 | 207 |
  | Monthly | 881 | 513 / 271 / 97 | 723 |
  | Yearly | 17,269 | 9,849 / 5,594 / 1,826 | 15,491 |

  Capacity: 3,406.8 m³ (37.9%).
- **UI:**
  - `ProductMixPanel` replaces `GradeMixPanel` (removed).
  - The trend panel uses a "pieces" axis with whole-number ticks, piece tooltips and legend, and a total in pieces.
  - Placeholder titles updated.
- **Tests:** 96 pass (13 new), covering:
  - Element totals matching the trend and product totals in all periods.
  - Category exclusivity, including a duplicated category being rejected.
  - Pieces kept separate from batching-plant m³, and no elements inferred from concrete.
  - Deliveries not derived from production.
  - Fractional, zero and uncategorised element records, and fractional snapshot counts, being rejected.
  - Production ≥ deliveries in the dataset.
  - All existing boundary, switching, cancellation and recovery tests still pass.
- Type check, lint and build pass with no chunk warning.
- **Browser** (headless Edge, `vite preview`): all four periods at 1920×1080 show no scroll, overflow or spill, with integer counts, readable product labels, and m³ only in the capacity panel. At 1366×768 there is no horizontal overflow. Keyboard walkthrough passes.
- **Screenshots:** `docs/screenshots/elements/` and the updated `docs/screenshots/daily-1920x1080.png`.

### Management overview update (1 Nov 2026, separate from Unit 4)
Management wants four things clearly visible, without another SAP screen. Definitions and open questions: `docs/data-definitions.md`. Not deployed; the production server was not touched.

**Replaced or removed**
- Monthly Plant Capacity became Concrete Output: selected-period m³, month-to-date labelled with its month, "Batch plant" caption. Illustrative capacity, percentage, remaining and gauge removed.
- Active Projects percentages removed. Production by Product removed. A Production & Delivery table (Product | Unit | Produced | Delivered) replaces them.
- The single mixed "pieces" total is gone. "Delivered Element" is now "Delivered Elements".
- Order cards are labelled "Current" with "as of …" (previously "Demo snapshot").

**Contracts and calculations**
- New source records: item master, receipt lines, delivery notes with Open/Closed status and a cancelled flag, and orders identified by internal `docEntry` plus displayed `docNum`.
- `productMapping.ts`: explicit eligibility, product and unit rules, independent of the Finished Goods flag. Unmapped items and unknown units stay visible as their own rows.
- `output.rows` is the one aggregate behind both quantity cards and the table. `output.productionSeries` has one chart series per row. Validation rejects any series that does not equal its row. Sums use whole thousandths.
- Production sums receipt transaction quantities only, never cumulative order quantities.
- Open delivery notes count; only cancelled notes are excluded. Billing and transport lines are excluded.
- Date-only records: Daily shows one day total with "Hourly detail unavailable"; hours appear only if every record for that row has a time on its business date.
- Unknown figures are null and show "Not available".

**UI**
- The Production Trend keeps its blue bars, printed values, future and zero marks, and gains a "Product and unit" selector. It now has full height beside a right column of Concrete Output and Production & Delivery.
- m² and m³ always show one decimal so right-aligned columns line up.
- Blue means production and teal means delivery, always with text labels. Amber is limited to the demo label and status messages.
- Beyond four rows, cards and table tighten (table text 20 px) so six rows still fit 1080p.

**Demo figures at the reference time** (date-only GRC; Precast delivered can exceed Precast produced because delivery is independent of production in a period)

| Period | Produced: Hollowcore m² / Precast m³ / Precast pieces / GRC m² | Delivered: same order | Notes | Concrete m³ |
|---|---|---|---|---|
| Daily | 346.1 / 24.1 / 4 / 88.9 | 163.2 / 18.0 / 2 / 0.0 | 3 | 152.3 |
| Weekly | 2,318.2 / 186.3 / 43 / 252.6 | 851.5 / 120.9 / 33 / 148.0 | 25 | 1,142.6 |
| Monthly | 6,158.0 / 493.4 / 92 / 688.1 | 2,754.7 / 259.4 / 95 / 578.2 | 70 | 3,406.8 |
| Yearly | 119,879.9 / 9,368.5 / 1,581 / 15,127.7 | 65,489.2 / 4,680.0 / 1,795 / 13,748.5 | 1,316 | 66,197.9 |

Current Sales Orders 50; Active Production Orders 21.

**Validation**: see Verification status. Screenshots: `docs/screenshots/management-overview/`.

### Project view refinement (1 Nov 2026, separate from Unit 4)
Managers can now pick a project and read its orders, quantities and trend. Definitions: `docs/data-definitions.md`. Not deployed; production services untouched.

- **Project selector** beside the period buttons: searchable by name or code, default All Projects, with Unassigned last.
- **Project scope** applies to both order counts, produced and delivered quantities, the trend and Project Summary. Concrete Output stays "All Projects" because batches have no project reference.
- **Attribution** uses recorded references only (`projects.ts`). Sales order and delivery note lines each name a project, so a document can span projects: it counts once in All Projects and once in each project, so project order counts are not additive. Quantities are additive.
- **Project Summary** replaces Production & Delivery. Rows are project, product and unit, with units beside every quantity. Activity only, no percentages. Row choice applies the project. Pages are height-aware, because a wrapped project name needs more room than a product row.
- **Precast labels** are "Precast · m³" and "Precast · pieces" on cards, chart controls and Project Summary. The label form applies to all products.
- **Prepared, unused:** `verifiedSubtype` on items and `verifiedElementCount` on lines. Rows report an element count only if every record has a verified count.
- **Selection:** `useDashboardSelection` replaces `usePeriodSelection`. Query keys include source and reference time, period and project. Figures, chart, project name and range commit together; obsolete requests are cancelled; failures name the selection and offer Retry ("Try again" renamed).
- **Chart:** the chosen product persists across projects and periods. With no records, the chart area says so instead of switching product. The chart is three fifths of the width (was two thirds), to give Project Summary its four columns; its height is unchanged. Yearly bar labels are 20 px. Where the shaded future area is too narrow for its label, the key names it.
- **Demo data:** All Projects quantities and concrete are unchanged, because attribution has its own seed. Order counts at All Projects are also unchanged: 50 and 21.

**SAP evidence still needed** (the display stays unit-separated until then; this blocks nothing):
1. One precast production example recorded in m³.
2. One precast production example recorded in Nos/pieces.
3. Project codes, names and their transaction references.
4. Any reliable physical element-count field.

**Validation:** see Verification status. Screenshots: `docs/screenshots/project-view/`.

### SAP-findings refinement (5 Nov 2026, separate from Unit 4)
Applies four SAP screenshot examples and simplifies the right-hand panels. Not deployed or pushed; no SAP records or production services touched. DEMO DATA and "SAP not connected" remain.

- **Labels:** "Precast · m³" is now "Precast volume" and "Precast · pieces" is now "Precast pieces". Cards drop redundant units from Hollowcore and GRC, since the quantity carries its unit. Chart buttons and the summary heading keep the unit ("Precast volume · m³"). The groups are never combined or converted.
- **SAP examples A–D** are regression tests (`sapExamples.test.ts`, 12 tests), kept out of the demo dataset. The reference date is unchanged. Each test marks what the screenshot shows and what is assumed. They confirm:
  - receipts count by transaction quantity and posting date (1 piece, not 5);
  - order totals and component issues (3.88 m³ concrete) are never output;
  - steel receipts in Nos are not elements;
  - unknown items stay visible as Unmapped.
- **Data model:** a `componentIssues` record type exists only to prove issues never count; the demo has none. Unverified Nos now reads "Nos (unverified)" in amber, as a data-quality flag.
- **Project Summary** follows the chart's product and unit: Project | Produced | Delivered, one row per project with activity, name then code, alphabetical with Unassigned last. Row choice applies the project; a filtered view stays filtered with an explicit empty message. Pages are cut from measured row heights, which fixes the earlier 12 px overflow at its cause (rowspan cells are gone and rows never exceed the measured space). The page resets on any change of period, project or product.
- **Concrete Output** is a compact band with "Selected <period>" and "Month to date · <month>", always "All Projects", and "not filtered by project" while a project is selected. The band freed about 53 px, so the summary shows 2–3 projects per page at 1080p (was 2).
- **Status lines:** two lines are always reserved under the controls, so loading and failure never move the dashboard. The header is 137 px at 1080p in loading, ready and failed states (was 109–138, varying). The chart is about 28 px shorter as a result. Long names end in an ellipsis on these lines only; the full name stays in the announced text, the selector list and Project Summary.
- **Lint:** `npm run lint` failed on 92 problems, all under the untracked `.agents/skills` folder. `.agents` is now in the existing `globalIgnores` call. `.agents`, `skills-lock.json` and all application rules are unchanged.

### Readability refinement (5 Nov 2026, separate from Unit 4)
A focused UI refinement; no SAP definitions or integration changed. Not committed, pushed or deployed. DEMO DATA and "SAP not connected" remain.

- **Selected product highlight:** the chart's product-and-unit row is marked in both quantity cards (raised background, thin blue edge, `aria-current`) at the same row height. Precast volume and Precast pieces are marked separately. Nothing is filtered: every row and both order counts stay.
- **Project Summary total:** "All projects · Produced … · Delivered …", or the selected project's name. It sums every matching project across all pages, Unassigned included, in whole thousandths. Tests show it equals the headline rows and the chart total for every period and product.
- **Pagination wording:** "Showing 1–3 of 5 projects · Page 1 of 2", with singular, single-page and empty forms (`describePage`). Previous and Next became ◀ ▶ buttons named "Previous page" and "Next page".
- **Auto pages** (`useAutoPages`): off by default; Start, then Pause or Resume; 15-second loop.
  - Holds still for pointer or focus in the summary, the open project list, and loading or failure.
  - Suspends while the tab is hidden and restarts with a fresh interval, so no pages are skipped.
  - Manual paging stops it. A new dataset or view resets to page 1.
  - The choice is kept across views. Automatic changes are not announced.
- **Business meaning:** delivered above produced is shown neutrally (yearly Precast pieces: 1,581 produced, 1,795 delivered). No ratio, percentage or red/green judgement.
- **Layout cost:** the total line and the two reserved footer lines (paging, Auto pages) take height from summary rows. At 1080p the summary shows 2–3 projects per page, unchanged from before but now with the total and controls; with long names or six product rows, 1–2.

### Project selector and pagination refinement (5 Nov 2026, separate from Unit 4)
UI only: no SAP attribution rules, data or definitions changed. Not committed, pushed or deployed.

- **Ordering** (`projectSearch.ts`): All Projects pinned above a separately scrolling list, which stays visible while searching. Projects are alphabetical by displayed name, with the code as tie-breaker. Unassigned, not being a project, stays last, matching Project Summary.
- **Search:** name or code; partial; case-insensitive; surrounding spaces ignored. Typing moves the keyboard to the first match, so Enter picks what was searched for. This fixed a bug found during the work, where Enter picked the pinned All Projects. With no results it reads "No matching projects"; All Projects stays.
- **Options:**
  - The name sits above the exact code; long names and codes wrap.
  - Only the selected option has a check mark (with a blue edge); the keyboard option has a blue outline; hover is a quiet background.
  - Targets are at least 64 px at 1080p.
- **Behaviour:** the list stays within the viewport and scrolls vertically only. Closing in any way clears the search. Focus returns to the button after a choice or Escape. Home and End were added to the arrow keys. The closed button keeps its width; a long name ends in "…", with the full name in its accessible name and tooltip.
- **Pagination:** labelled Previous and Next buttons replace ◀ ▶. The range and page count have their own line ("Showing 1–2 of 7 projects · Page 1 of 3"), with Auto pages and Previous and Next on the line below. Text sizes are unchanged, and Auto pages behaves as before.

### Wording refinement (7 Nov 2026, separate from Unit 4)
Two label changes; no data calculation, project filtering, SAP rule or loading and error behaviour changed. Not committed, pushed or deployed.

- **Later hours:** the shaded future part of the Daily chart now reads "Later hours" (`FUTURE_LABELS` in `labels.ts`). Weekly, Monthly and Yearly keep "Not yet reached", since their future intervals are days or months. The chart tooltip, key and text alternative use the same wording. Future intervals still come from the snapshot's reference time (buckets after it are `null`), not the header clock. Elapsed zero hours remain grey "No production" marks. Unknown data, failed loads and completed periods contain no future intervals, so they never show it.
- **Month-to-date cutoff:** the label reads "Month to date · through 14 Oct 2026". The date is generated from a new `concrete.monthToDateThrough` field, set from the same as-of time the quantity is summed to (`aggregate.ts`), so label and number cannot disagree and the live clock is never used. The selected-period figure keeps its own label ("Selected week" and so on), and the panel still reads "All Projects · batch plant". A full-period total is never labelled month to date.
- **Layout cost:** the longer label did not fit beside the title, so the Concrete band is now two lines: the title and scope, then the two figures. Text sizes are unchanged. The band is about 17 px taller than before, so the summary shows 2 projects per page at 1080p, not 2–3.
- **Tests:** 7 new (243 in total): month-to-date label in all four periods, cutoff taken from the data rather than the clock, unknown figure kept, "Later hours" Daily only, future wording on the chart key, and no future wording when no interval remains.

## In progress
None.

## Next up
- **Unit 4:** display resilience.
  - Fullscreen control with fallback.
  - 60-second refresh that keeps the last valid data and its timestamp after a failure.
  - Delayed/stale state after an earlier success, and recovery.
  - Empty-period message.
  - Account for background-tab throttling.
- **Management review** of the proposed definitions, then reconciliation with real SAP data (`docs/data-definitions.md`). Service Layer access is not yet available.
- **Unit 5:** review. Long-session resource checks, real-screen and viewing-distance check, management review package.

## Pending behaviours (not built yet; do not demo as working)
- Automatic refresh and simulated new records. Data loads once per period per page load.
- Fullscreen control.
- Empty-period message ("No production recorded for this period") and the delayed/stale state after an earlier success.

## Unit 3 limitations
- The ECharts chunk is 497 kB minified, only 3 kB under Vite's 500 kB warning. Any further ECharts feature will trigger the warning; the remedy would be lazy-loading the chart rather than raising the limit.
- The yearly axis shows "Sept" because that is the en-GB short-month form from Intl.
- At 1366×768 the card chip and caption stack onto two lines. This is readable and the page scrolls vertically as allowed.
- Not yet checked: screen-reader output with real assistive technology (only the ARIA roles and attributes were checked), mobile width, long sessions.

## Demo assumptions (illustrative, not SAP definitions)
- Reference timestamp: **Wed 14 Oct 2026, 14:00 Asia/Kuwait** (`fixtures/catalog.ts`). It is separate from the live clock and from `fetchedAt`.
- Records are fictional. Seed `20261014`. Generation details: `src/lib/dashboard/fixtures/README.md`.
- Trend bar labels show whole numbers, with one decimal below 10; totals show one decimal.
- The header uses the supplied RECAFCO logo (`recafco-logo.png`), cropped and resized to `public/brand/recafco-logo.png` (480×373). It sits on a white tile so the dark-grey Arabic wordmark stays readable on the navy theme (11 Oct 2026).

## Proposed choices awaiting review
- Screen title: RECAFCO Factory Performance.
- Navy theme with red brand accent.
- Initial selection: Daily.
- Four headline cards, trend at three fifths, Concrete Output above Project Summary at two fifths.
- Project order counts: a document counts once in each project it touches.
- A sales order counts in a project only if that project's lines have remaining quantity.
- Sunday-start week; calendar months/years; Kuwait midnight boundaries.
- 60-second refresh.
- Active Production Orders definition: released with quantity remaining (pending SAP reconciliation).
- GRC date-only in the demo, to show the Hourly detail unavailable state.
These can be changed without implying prior management approval.

## Open questions
### Display and design
- Actual screen size, native resolution, browser/OS scaling and viewing distance?
- Is the supplied logo the approved version, and is a white tile acceptable on the dark theme (or is there a light/reversed variant)? Exact brand colours?
- Final title and management's preferred panel priority?

### Business definitions
- What do Day T.VOL and Day P.VOL mean? Which is the official batching-plant concrete output measure?
- Which SAP item groups, item codes or UDFs map items to Hollowcore, Precast and GRC? Can any item belong to more than one category?
- Which SAP document marks a finished element as completed (receipt from production, production order completion or a custom report), and which timestamp should be used?
- Should produced-element counts include rejected or reworked pieces?
- How are existing cockpit card values calculated and filtered?
- Which sales order lines/statuses constitute outstanding factory demand?
- Which SAP production statuses and remaining-quantity rules define active orders?
- Factory week start, shift-day cutoff and fiscal/calendar year?
- SAP field and rule questions are listed in `docs/data-definitions.md`.
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
- Period changes do not redefine current snapshots.
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
- Wording refinement (7 Nov 2026):
  - Full `npm run lint`, `npm run typecheck` and `npm run build`: see the final run recorded in the report; `npm test`: 243 tests pass in 14 files.
  - Browser (headless Edge over the DevTools protocol, `vite preview`): every period, product and summary page, project, Unassigned, empty states, loading and Auto pages. 48, 48 and 47 states at 1920×1080, 3840×2160 and 1366×768: no page scroll at 1080p or 4K, no horizontal overflow, nothing outside or cut off in a panel.
  - The first attempt put the longer label in a single-row band. The existing overflow check caught it clipping at 1366×768, and at 1080p the title wrapped onto two lines. Both led to the two-line layout.
  - Stress run with a temporary provider (80-character name, SAP-style code, unmapped rows, failing project), restored afterwards (no TEMP markers): no violations; the header is identical while loading, ready and failed.
  - Not checked: a physical display, a real screen reader, and the label against a live clock after midnight (the demo reference date is fixed).
- Project selector and pagination refinement (5 Nov 2026):
  - Full `npm run lint`: exit 0. `npm run typecheck`: pass. `npm run build`: pass, no chunk warning.
  - `npm test`: 236 tests pass in 14 files (12 new):
    - 11 selector tests: ordering and tie-break, pinned All Projects, partial and code search with spaces, no results, single check mark, keyboard with hover kept separate, Enter, Escape and focus return, search cleared on reopen and on outside click, full long name in the accessible name.
    - 1 dashboard test: choosing All Projects returns every figure to All Projects.
    - All earlier switching, cancellation, failure and Auto pages tests still pass.
  - Browser (headless Edge over the DevTools protocol, `vite preview`), with a temporary provider for an 80-character name and an SAP-style code, restored afterwards. At 1920×1080, 3840×2160 and 1366×768:
    - The list is inside the viewport and scrolls vertically, with no sideways scroll and no option overflow; the smallest target is 64 / 129 / 52 px.
    - The code search "80067" found the SAP-style code. "zzz" showed "No matching projects", with All Projects still listed.
    - Escape closed the list and returned focus to the button, and reopening showed an empty search.
    - A keyboard choice updated the button and status line, and choosing All Projects restored "Showing All Projects".
    - No page overflow at 1080p or 4K.
  - Full dashboard regression with the new pager: 41, 40 and 31 states at the three sizes, with no page scroll at 1080p or 4K, no horizontal overflow, and nothing outside or cut off in a panel.
  - Not checked: a real screen reader, touch screens, a physical display.
- Readability refinement (5 Nov 2026):
  - Full `npm run lint`: exit 0, no problems. `.agents` is still in `globalIgnores`; the folder, `skills-lock.json` and all application rules are unchanged.
  - `npm run typecheck`: pass. `npm run build`: pass, no chunk warning.
  - `npm test`: 224 tests pass in 13 files (28 new): highlight, totals across pages and reconciliation, pagination wording, Auto pages (default off, 15 s loop, pause and resume, pointer, focus, held by the screen, manual stop, no announcements), hidden tab, timer and listener cleanup. All earlier switching, cancellation and failure tests still pass.
  - Browser (headless Edge over the DevTools protocol, `vite preview`): every period, every product, every summary page, a project, Unassigned, no-production and empty states, loading, and Auto pages on. 41, 40 and 31 states at 1920×1080, 3840×2160 and 1366×768. No page scroll at 1080p or 4K, no horizontal overflow, nothing outside its panel. A new check also covers text cut off with an ellipsis inside panels. It found the selected project's name cut in the total line, which was fixed so the name wraps.
  - Stress run with a temporary provider (80-character name, SAP-style code, unmapped and unverified rows, failing project), restored afterwards: no violations. The header is identical while loading, ready and failed at all three sizes.
  - The rotation's 15-second timing, pauses and hidden-tab rule are verified by fake-timer tests. In the browser, only the running state and its indicator were observed; a full 15-second turn was not watched.
  - Not checked: real SAP data, real assistive technology, a physical screen, long sessions with Auto pages running.
- SAP-findings refinement (5 Nov 2026):
  - `npm run lint` (full `eslint .`): exit 0, no problems (was 92). `npm run typecheck`: pass. `npm test`: 196 tests pass in 11 files. `npm run build`: pass, no chunk warning.
  - Browser (headless Edge over the DevTools protocol, `vite preview`). Every period, every chart series and every Project Summary page were checked, plus a project at Yearly, the no-production and empty-summary states, and loading. No page scroll at 1920×1080 or 3840×2160, no horizontal overflow at any size, and no visible content beyond its panel. Tables were included in the check, which was not relaxed: 39, 38 and 45 states at 1920×1080, 3840×2160 and 1366×768.
  - The header is the same height while loading and ready at all three sizes.
  - Temporary stress provider, restored afterwards (no TEMP markers, rebuilt): an 80-character project name, an SAP-style code missing from the master, unmapped and unverified-unit rows, and a failing project. No violations, and the header is identical while loading, ready and failed. With six product rows the summary fits 1–2 projects per page at 1080p.
  - Not checked: real SAP data (no Service Layer access), real assistive technology, a physical screen, long sessions.
- Project view refinement (1 Nov 2026):
  - `npm test`: 177 tests pass in 10 files. Type check and build pass, with no chunk warning.
  - Tests cover project attribution, distinct order counts and non-additive project counts, mixed units, unassigned records, unlisted project codes, project and period switching, cancellation of rapid selections, failure and Retry, no-production, pagination, empty state, and reconciliation of cards, chart and Project Summary for every project and period.
  - Lint: `npx eslint src vite.config.ts vitest.config.ts eslint.config.js` passes. `npm run lint` (`eslint .`) exits 1, and all 92 reported lines are in `.agents/skills/stageshow/`, an untracked skill folder that appeared during this session. It was left alone, and neither it nor the ESLint config was changed. Add `.agents` to the ESLint ignores, or remove the folder, to clear it.
  - Browser (headless Edge over the DevTools protocol against `vite preview`): all four periods, plus a project at Yearly and Daily, with every Project Summary page stepped through.
    - 1920×1080 and 3840×2160: no page scroll, no horizontal overflow, nothing outside its panel. One page per period reports a table scroll height about 12 px over its box from a wrapped project name; the screenshot shows nothing clipped or colliding.
    - 1366×768: vertical scroll only, no horizontal overflow. Some labels wrap onto two lines.
    - Selector search, Escape and focus return work. The no-production message shows and the chart keeps its product.
  - Temporary provider, restored afterwards (no TEMP markers, rebuilt): six product rows with an unmapped item and an unverified unit, a failing project and loading, at 1920×1080 and 3840×2160. All fit. The failure message wraps to two lines, moving the page down about 26 px at 1080p until resolved.
  - Not checked: real SAP data (no access), real assistive technology, a physical screen, long sessions.
- Management overview update (1 Nov 2026):
  - `npm test`: 130 tests pass in 8 files. `npm run typecheck`, `npm run lint` and `npm run build` pass, with no chunk warning.
  - Tests cover separation of units; chart, table and card reconciliation; transaction versus cumulative quantities; order versus line counts and internal identity; fully produced but released orders; Open delivery documents; date-only versus timestamped records; unmapped items, unknown units and unverified Nos; unknown versus zero; period switching, cancellation and failure.
  - Browser (headless Edge over the DevTools protocol against `vite preview`), all four periods, measured and screenshots reviewed:
    - 1920×1080 and 3840×2160: no scroll, no horizontal overflow, no spill.
    - 1366×768: vertical scroll only, no horizontal overflow.
    - GRC Daily shows one bar and "Hourly detail unavailable". Keyboard Tab and Enter work on the selector, with focus kept.
  - Temporary provider, restored afterwards (no TEMP markers, rebuilt): six rows with an unmapped item and an unverified unit (Daily and Yearly, the widest figures), a failed selection and loading, at 1920×1080 and 3840×2160. All fit without scroll or spill. More than six rows would need a further layout decision.
  - Not checked: real SAP data (no access), real assistive technology, a physical screen, long sessions.
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
7 Nov 2026: wording refinement (Later hours, explicit month-to-date cutoff) built locally. Not committed, pushed or deployed.
5 Nov 2026: project selector and pagination refinement built locally. Not committed, pushed or deployed.
5 Nov 2026: readability refinement (highlight, totals, paging wording, Auto pages) built locally. Not committed, pushed or deployed.
5 Nov 2026: SAP-findings refinement built locally from four screenshot examples. Not committed, pushed or deployed. Live SAP integration not started; the examples confirm specific rules only, and general mappings remain proposed.
1 Nov 2026: project view refinement built locally. Not committed, pushed or deployed. Attribution rules are proposed; no SAP evidence has been received.
1 Nov 2026: management overview update built locally. Not committed, pushed or deployed. Definitions are proposed, pending SAP reconciliation.
The user requested project-specific versions of seven generic Markdown templates.
The supporting screenshots are references, not validated data mappings.
Historical production figures refer to 25 June 2026; do not present them as current data.
Work can proceed on the demo while SAP questions are unresolved.
The starter package now uses React + Vite throughout. Do not follow the earlier Next.js scaffolding prompt.
11 Oct 2026: management presentation design completed (12-hour clock, header, KPI hierarchy, trend emphasis, capacity layout, colour roles); not pushed or deployed, awaiting user review.
11 Oct 2026: presentation polish completed (wording, readability, capacity, projects, chart clutter, footer); recorded separately from Unit 4.
11 Oct 2026: Unit 3 built. All four period controls work; explicit acceptance criteria were recorded above, and all pass.
11 Oct 2026: Unit 2 built. Demo data now comes from seeded records via the async demo provider and TanStack Query. The tracker's Unit 2 scope line had no formal acceptance list; the user's brief served as the criteria.
11 Oct 2026: Unit 1 built. Run `npm install`, then `npm run dev` and open http://localhost:5180. Official logo not supplied; text placeholder used.
