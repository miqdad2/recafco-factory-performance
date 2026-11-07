# Architecture Context

## Stack
| Layer | Technology | Role |
| --- | --- | --- |
| UI | React + TypeScript | Single interactive overview page |
| Build tool | Vite | Development server and static production assets |
| Styling | Tailwind CSS + CSS variables | Large-screen layout and tokens |
| Controls | Selected shadcn/ui components | Accessible period and fullscreen controls |
| Charts | Apache ECharts | Production trend |
| Client data | TanStack Query | Cached snapshots, refresh and retries |
| Validation | Zod | Validate period requests and provider responses |
| Future backend | NestJS | SAP access, scheduled collection and KPI aggregation |
| Future reporting storage | PostgreSQL, only if justified | Historical snapshots/targets if SAP source is insufficient |

Select compatible stable package versions at scaffolding and commit one lockfile.
Installed packages:
- Unit 1: React 19, Vite 8, TypeScript 6, Tailwind CSS 4, ECharts 6 and Vitest.
- Unit 2: TanStack Query 5 and Zod 4.

Additional implemented paths:
- `src/hooks/`: clock and root font size.
- `src/lib/time.ts`: Asia/Kuwait display formatting.
- `src/lib/format.ts`: number formatting.
- `src/lib/dashboard/units.ts`: summing in whole thousandths; never converts units.
- `src/lib/dashboard/productMapping.ts`: item eligibility, product and unit rules, row order.
- `src/lib/dashboard/projects.ts`: project attribution and options.
- `src/features/dashboard/projectSummaryPages.ts`: Project Summary paging from measured row heights.
- `src/features/dashboard/chartSeries.ts`: the product-and-unit choice shared by the chart and Project Summary.
- `src/lib/dashboard/errors.ts` and `validate.ts`: typed errors and Zod parsing.
- `src/lib/dashboard/providers/index.ts`: selects the active provider.
- `src/lib/dashboard/fixtures/{catalog,generate,random}.ts` and `README.md`: seeded demo records and their assumptions.
- `src/features/dashboard/useDashboardSelection.ts`: requested versus displayed period and project, commit on validated success.
- `src/features/dashboard/snapshotQuery.ts`: query keys, options and the shared QueryClient defaults.
- `src/features/dashboard/dataProvider.ts`: React context for the active provider (tests inject a controllable one).
- `src/features/dashboard/chartLabels.ts`: which trend bars carry value labels, and the Monthly highlights.
- `src/features/dashboard/components/DashboardLayout.tsx`: grid shared by the loaded, loading and error states.
Do not introduce an integration backend, database, Redis or MinIO merely to display demo fixtures.

## Proposed demo folder structure
- `index.html`: Vite HTML entry point.
- `src/main.tsx`: React root and global providers.
- `src/App.tsx`: overview composition and application error boundary.
- `vite.config.ts`: build configuration and future development API proxy.
- `src/features/dashboard/components/`: dashboard composition and period controls.
- `src/components/ui/`: shared UI primitives.
- `src/components/charts/`: ECharts lifecycle and reusable chart wrappers.
- `src/lib/dashboard/contracts.ts`: period, metric, unit and snapshot schemas/types.
- `src/lib/dashboard/periods.ts`: timezone-aware date windows and bucket definitions.
- `src/lib/dashboard/aggregate.ts`: pure metric calculations.
- `src/lib/dashboard/provider.ts`: provider interface/factory.
- `src/lib/dashboard/providers/demo.ts`: deterministic demo provider.
- `src/lib/dashboard/fixtures/`: dated transactions, items and orders.
- `src/styles/`: theme tokens and display scaling.
- `public/brand/`: locally available approved brand files.
- `context/`: these project specifications.

TanStack Query calls an asynchronous in-browser demo provider; no HTTP endpoint is needed for the demo.
Synthetic fixtures may be bundled into the frontend. They must contain no real operational records or secrets.
A later HTTP provider implements the same interface and calls the internal NestJS API.
No router is required for one page; introduce routing only if scope expands.

## Data contract
A snapshot contains:
- source: demo or sap.
- selectedPeriod and range start/end/timeZone/bucket granularity.
- sourceDataAsOf and fetchedAt as separate timestamps.
- current order counts and their snapshot timestamp.
- `selectedProject` and `projectOptions`.
- `output.rows`: one row per product and unit in the project scope, with produced and delivered quantities. The only source for the two quantity cards.
- `output.productionSeries`: one chart series per row.
- `output.deliveryDocumentCount`: a separate measure.
- `projectSummary`: period activity by project, product and unit; validated to add up to `output.rows`. The panel shows the rows for the chart's selected product and unit.
- `concrete`: selected-period and reference-month-to-date m³, always `all-projects`.
- section availability/status for partial data failures where appropriate (not yet implemented).

Implemented in `src/lib/dashboard/contracts.ts` (fields and rules: `docs/data-definitions.md`):
- `range` is the full calendar period [start, end). Data runs only to `sourceDataAsOf`.
- Trend buckets carry `start`, `end` and `quantity`. `quantity: null` means not yet reached; `0` means an elapsed interval with no production.
- Each series states its actual `granularity` and `hourlyDetail`; date-only Daily data has one day bucket.
- Unknown figures are `null`, never 0.
- Snapshot validation rejects a row listed twice, a row key that disagrees with its unit, fractional pieces, a series total that differs from its row and a trend that does not add up. Sums compare whole thousandths, so reconciliation is exact.
- Batching-plant concrete feeds Concrete Output only; element quantities are never derived from m³.
- Demo `sourceDataAsOf` is a fixed reference time (Wed 14 Oct 2026, 14:00 Kuwait). `fetchedAt` is when the provider finished loading.
- Providers reject with `DashboardDataError`, using the codes `invalid-response`, `invalid-source-data`, `aborted` and `unavailable`.

The provider returns a coherent snapshot; presentation does not perform business calculations.
The demo provider validates synthetic inputs/results in the browser. The later HTTP provider validates API responses; the NestJS API independently validates requests and authorizes access.
Query key includes the period and any explicit scope such as plant. Implemented as `['dashboard', 'snapshot', { scope, period, project }]`, where `scope` is the provider's `DashboardDataProvider.scope` (demo: `demo@<reference time>`), so source and reference time are part of every key.
Period and project switching: the last successful snapshot stays on screen with its own labels until the requested view's validated snapshot arrives. Obsolete requests are cancelled through their AbortSignal, and a failed request leaves the displayed snapshot unchanged.
Use a proposed 60-second polling interval, bounded retries and one active request per query. Unit 2 loads once with no polling and retries non-validation failures twice; the polling interval arrives in Unit 4.
Configure visible wallboard background behaviour deliberately; do not assume browser defaults.
Cancel requests when appropriate and dispose all timers/charts on unmount.

## Storage
Demo transactions live in source-controlled synthetic fixtures bundled with the static frontend.
Browser storage may persist display preferences only; do not persist SAP credentials or real operational records there.
Local fonts and brand assets keep the internal display independent of third-party CDNs.
No database is needed in the demo.

## Hosting
Vite builds the frontend into `dist/`; serve these static files through an internal production web server such as IIS on Windows.
Do not use the Vite development server or `vite preview` as the 24/7 production server.
Later, configure the web server to proxy `/api` to the internal NestJS API for a same-origin frontend/API deployment.
Use appropriate cache headers: allow versioned assets to cache; ensure the HTML entry point can discover new builds.
All Vite client environment variables are public build configuration, never a place for credentials.

## Later SAP boundary
Browser → dashboard API → cached validated reporting snapshot.
A separate internal NestJS collector will read SAP using a verified connector.
SAP version is confirmed from a screenshot; Service Layer installation, availability and permissions are not.
Evaluate read-only Service Layer or consultant-approved reporting queries against the actual system.
Do not prescribe an upgrade or direct database access based solely on these screenshots.
SAP report/query definitions, document statuses, UDFs and completion formulas require mapping.
Keep polling work outside page-request lifecycles; one collector should serve displays from cache.
Never send SAP credentials to the browser or embed them in source.
Historical reporting storage is a later choice, not a replacement of the SAP HANA database.

## Access model
Demo may run locally/LAN with synthetic data and no sign-in workflow.
Before real data is exposed, implement an agreed restricted, read-only display access/session model.
LAN access alone is not the final authorization design.
The dashboard does not create, update or delete SAP records.

## Invariants
1. Demo remains clearly identified as demo.
2. One snapshot drives related cards/charts; totals reconcile.
3. Units never silently change or combine; quantities are grouped by product and unit.
4. Period activity and current snapshots are distinct. Project scope applies to both; concrete is never project-scoped.
5. Capacity, targets and completion percentages are not shown until defined; undefined SAP report fields are never interpreted as them.
6. Failures retain last valid data and its actual timestamp; a failed fetch never advances sourceDataAsOf.
7. No live credentials or operational data enter client fixtures or public repositories.
8. Long-running display resources are bounded and cleaned up.
9. Existing FMP/MMS/AuditFlow systems are untouched.
10. Integration status is never inferred from a green dot or working clock.
