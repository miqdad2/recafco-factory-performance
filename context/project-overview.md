# RECAFCO Factory Performance

## Overview
A standalone, one-page factory performance display for RECAFCO top management.
It will remain visible 24/7 on a large screen and present customer demand, production workload, concrete output, batch plant capacity, deliveries and selected project progress.
Build an interactive demo first; integrate SAP after management approves the design and functionality.

## Goals
1. Make the key factory figures understandable at a glance from the intended viewing distance.
2. Keep one complete overview visible without scrolling on the target landscape display.
3. Make all four period controls functional using internally consistent sample records.
4. Prepare a replaceable data contract so SAP integration does not require rebuilding the visual layout.
5. Retain the last valid data and visibly communicate refresh failures.

## Demo implementation
Use React + TypeScript with Vite, Tailwind CSS, Apache ECharts and TanStack Query.
The initial data source is an asynchronous browser demo provider with synthetic fixtures, not a server endpoint.
Build static frontend assets; add a separate internal NestJS API only for later SAP integration.

## Project identity and deployment
- Working title: RECAFCO Factory Performance; management confirmation pending.
- Alternative longer title: RECAFCO Factory Performance Dashboard.
- New standalone project, not a module or modification of existing RECAFCO systems.
- Final hosting target: company internal server / LAN.
- Application dependencies should be open-source; no required paid SaaS or cloud-only services.
- The existing SAP system remains the source for later integration.

## Source evidence
The five supplied SAP screenshots show:
- SAP Business One 9.3 for SAP HANA, build 9.30.150, PL05, 64-bit.
- Cockpit cards for daily sales orders, daily production orders, sales order details, receipt from production and delivery notes.
- Project codes with completion percentages.
- A production order with status, planned quantity, dates, project and component/resource lines.
- A daily concrete production report with concrete grades, day/month/year volumes and material fields.

Historical report dated 25 June 2026:
- Day production summary: 295.900 m³.
- Month production summary: 5,592.900 m³.
- Year production summary: 46,276.362 m³.
- Day T.VOL: 289.982; Day P.VOL: 295.900.
These are reference observations, not current factory readings.
T.VOL and P.VOL meanings and cockpit query definitions remain unverified.

Three visual references were provided: green card dashboard; black/gold dashboard; manufacturing dashboard.
Use the manufacturing composition, green reference's clarity and black/gold reference's typographic hierarchy.

## Core user flow
1. Open the overview; Daily is the proposed initial selection.
2. Read four large headline cards and the selected date range.
3. Select Weekly, Monthly or Yearly; period totals and charts update together.
4. Read current order snapshots separately from period activity.
5. Review monthly capacity, concrete mix and selected project progress.
6. Enter fullscreen if supported; automatic refresh continues.
7. If refresh fails, keep previous figures and display their age and delayed status.

## Core metrics
| Metric | Definition for demo | Time behaviour |
| --- | --- | --- |
| Current Sales Orders | Distinct non-cancelled orders with an unfulfilled quantity; fixture status rules documented | Current snapshot |
| Active Production Orders | Distinct released, not closed/cancelled orders with remaining work | Current snapshot |
| Concrete Produced | Sum of fixture concrete output in m³ | Selected period |
| Delivered Output | Sum of delivered precast pieces for the first demo; always labelled pieces | Selected period |
| Monthly Batch Plant Capacity | Planned available output in m³ for current month | Fixed current-month panel |
| Capacity Used | Month-to-date concrete output / full-month planned capacity × 100 | Current month |
| Concrete Grade Mix | Output grouped by concrete grade, in m³ | Selected period |
| Project Progress | Demo completion percentage with fixture basis declared | Current snapshot |

Actual SAP production status mapping and quantity definitions must be confirmed later.
Do not sum quantities with different units. Count of delivery notes is not delivered output.
Capacity used is a month-to-date share of full-month capacity, not a judgement about pace or efficiency.
If available capacity is zero or unknown, show Not available; do not divide by zero.
Capacity can exceed 100%; preserve the true value and explain over-capacity visually.

## Date and comparison rules
- Use Asia/Kuwait for period boundaries and displayed times.
- Proposed week boundary: Sunday 00:00 through the following Sunday, pending factory confirmation.
- Daily: today; hourly output buckets.
- Weekly: current week to now; daily buckets.
- Monthly: current month to now; daily buckets.
- Yearly: current calendar year to now; monthly buckets.
- Display the exact selected date range.
- Future buckets remain empty, not actual zero production.
- If comparisons are included, compare equivalent elapsed spans in the preceding period.
- Orders remain current snapshots for every selected period, labelled As of.
- The capacity panel remains labelled with its month when another period is selected.
- Factory shift-day cutoffs and fiscal-year rules are later business decisions.

## Demo behaviour
Use deterministic sample transactions and dated order/project fixtures.
Drive cards and charts from the same aggregate result.
Optional simulated updates must add coherent transactions, not independently randomise cards.
All demo views show Demo data; simulated refresh must never imply a SAP connection.
A clock is real time; historical/fixture data freshness is separately labelled.

## Scope
In scope: one overview page, four period controls, four KPI cards, production trend, monthly capacity panel, concrete grade breakdown, four selected projects, fullscreen control, Kuwait clock and refresh/error states.
Out of scope for this phase: live SAP access, SAP writes, order entry, finance/HR/maintenance modules, user administration, database persistence, OEE, quality and scrap calculations, public hosting of real operational data.
Targets and delay indicators require declared demo assumptions; do not derive them from the screenshots.

## Success criteria
1. Overview fits 1920×1080 and 3840×2160 fullscreen at appropriate scale; actual screen details pending.
2. Figures and chart labels are readable from the agreed viewing distance.
3. Period totals reconcile with fixture records and chart/grade subtotals.
4. Current snapshots and fixed monthly capacity retain their correct meanings.
5. Fullscreen fallback, loading, empty, delayed and recovery states work.
6. Production build, type checking and focused calculation/refresh checks pass.
7. Management approves design and business definitions before live integration.
