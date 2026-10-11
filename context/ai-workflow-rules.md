# AI Workflow Rules

## Approach
Implement the standalone demo incrementally against these context files.
Prioritise a convincing, readable factory overview with coherent behaviour.
Do useful authorized work autonomously; do not request approval for every reversible choice.
Design/functionality approval is the milestone before connecting real SAP data.

## Units
1. Scaffold and theme: React, TypeScript, Vite, package scripts, layout tokens and static dashboard composition.
2. Demo model: schemas, dated fixtures, timezone periods, coherent aggregation and asynchronous in-browser demo provider.
3. Interactive overview: period controls, KPI cards, trend, capacity, grade mix and projects.
4. Display resilience: clock, fullscreen, refresh, loading/empty/delayed/recovery states.
5. Review: display scaling, calculation checks, long-session checks, management review package.
6. After approval: SAP source audit and connector proof of concept.
7. Later: validated read-only integration, access control and internal deployment.

Units may overlap visually but must remain reviewable. Do not build a NestJS backend before the demo needs it.

## Missing requirements
Record unresolved questions in the tracker.
Use explicit reversible demo assumptions for week start, sample capacity and project labels.
Ask before locking business definitions that could misrepresent factory performance.
An unresolved SAP mapping does not block synthetic demo design.
Do not claim a design, business definition or name was approved without evidence.

## Scope discipline
Do not add finance, HR, maintenance, order-entry or administration screens.
Do not introduce OEE/quality/scrap simply because they appear in a reference.
Keep the capacity panel monthly and orders current unless the user changes the specification.
Split UI work from live connector/deployment work.
Do not deploy or access SAP as a side effect of scaffolding.

## Protected boundaries
- Existing RECAFCO FMP, MMS, AuditFlow_IMS applications and databases.
- SAP transactions, tables, configuration, credentials and production services.
- Third-party library internals.
- Uploaded reference/template sources unrelated to the requested adaptation.

Deployment restarts only this application's named process. Never use global node.exe termination.

## At the end of an implementation unit
1. Verify its behaviour within scope.
2. Run appropriate build, type and focused checks.
3. Review screenshot/layout evidence where the UI changed.
4. Update tracker with actual changes and exact test status.
5. Update any changed contract/scope/design documentation.
6. Report what changed, what was verified and any remaining limitation.
Never record a proposed or unrun check as passed.

## Delivery
Keep the root CLAUDE.md and context directory usable in Claude Code or another coding assistant.
No extra skill installation is required for these project instructions.
Use concise handoff notes and preserve open questions.
Before live integration, obtain confirmed KPI mappings and design/functionality acceptance.
Final deployment requires a concrete environment plan, restricted display access and agreed refresh strategy.
