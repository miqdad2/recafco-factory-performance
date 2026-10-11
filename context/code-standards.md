# Code Standards

## General
Keep modules small and separate business calculations from rendering.
Prefer a direct implementation and fix root causes.
Do not add dependencies or infrastructure without a concrete need.
Keep all demo records synthetic; no actual confidential records in source.

## TypeScript
Enable strict mode.
Use explicit period unions, units, schemas and snapshot types.
Avoid any; validate unknown data with Zod at external boundaries.
Handle nullable/unknown capacity and missing data explicitly.
Do not round individual records before summing; round only at presentation.
Format m³ with up to three decimals where appropriate; counts are integers.

## React and Vite
Use the React TypeScript Vite template and a single overview page.
Keep components, hooks and provider functions separate; no Next.js App Router, server components or route handlers.
Keep ECharts creation/disposal in a dedicated React wrapper.
The asynchronous demo provider runs in the browser and contains only synthetic records.
The later HTTP provider fetches validated snapshots from NestJS; SAP access and all integration secrets remain backend-only.
Never place secrets in VITE_* variables: values exposed to the frontend are public.
Use an explicit query freshness policy and preserve source timestamps.
Include separate commands for dev, build, preview, lint, typecheck and focused tests.
Build compiles TypeScript and bundles static assets. Preview is for local verification, not production hosting.
Use an internal production web server for dist/; configure a same-origin API proxy when integration is introduced.
Use npm consistently for the initial standalone project unless the user chooses another manager.
Commit package-lock.json; pin a supported runtime and compatible package versions when scaffolding.

## Time and metrics
Use one timezone-aware date utility, not scattered browser-local Date calculations.
Intervals are half-open [start, end); test records exactly on boundaries.
Use a controllable clock in demo calculations/tests.
Future chart buckets must not appear as real zero output.
Use one aggregation result for cards, trend and grade mix.
Deduplicate document counts by stable fixture document ID.
Define remaining quantity before classifying orders as open/active.
Keep returned period and timestamps attached to the rendered response.
During a period change, do not show old-period data under a new label.

## Styling and accessibility
Use shared CSS tokens and typography scales.
Use semantic buttons, visible focus, selected-state attributes and accessible chart summaries.
Do not depend on tooltips or colour for essential information.
Prefer CSS Grid for display composition.
Keep whitespace and readable text at every supported viewport.
Fonts/assets should be local for final LAN deployment.

## Refresh and chart lifecycle
Dispose ECharts instances, ResizeObservers, event listeners and intervals.
Resize charts to their actual container.
Avoid overlapping requests and unbounded fixture/data growth.
Use bounded retries; preserve last valid snapshot on failures.
Track fetch success and source-data time independently.
Do not set source freshness from the client clock.
Account for background-tab throttling; verify behaviour in intended kiosk/browser setup.

## APIs and errors
Provide consistent structured errors, without sensitive diagnostics.
Validate response snapshots before rendering.
Handle request timeout, non-JSON responses and invalid payloads.
These API rules apply to the later NestJS API and HTTP provider; the demo has no server endpoint.
Real-data authentication is required before integration deployment, not inferred from LAN access.

## Verification
Build and type-check every meaningful implementation unit.
Focused calculation checks must cover:
- Kuwait midnight/week/month/year boundaries.
- Period sums equal trend/grade breakdown sums.
- Open orders remain snapshots across period selections.
- Different units remain distinct.
- Zero/unknown capacity and capacity over 100%.
- Comparison spans if comparison figures are implemented.
UI checks cover all period controls, fullscreen fallback, initial errors, stale data and recovery.
Inspect layout at 1920×1080 and 3840×2160; inspect smaller desktop and mobile fallback.
Run a long-session check for chart/timer/request growth before claiming 24/7 readiness.
A short smoke test does not establish all-day reliability.
Do not create tests that merely duplicate component markup.

## Organization
Use dashboard feature components for domain presentation and shared components for reusable controls.
Keep fixture assumptions documented alongside fixtures.
Keep read-only provider logic in lib/dashboard; charts receive calculated values.
No giant page component containing fixtures, calculations and chart options together.
