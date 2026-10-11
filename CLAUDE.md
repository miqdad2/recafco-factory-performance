# RECAFCO Factory Performance — AI Project Instructions

Read these files in order before implementing or making architectural decisions:

1. `context/project-overview.md` — purpose, scope and metric definitions.
2. `context/architecture.md` — stack, data boundaries and invariants.
3. `context/ui-context.md` — large-screen design and visual conventions.
4. `context/code-standards.md` — implementation and verification rules.
5. `context/ai-workflow-rules.md` — phased development and delivery.
6. `context/progress-tracker.md` — actual progress, assumptions and next unit.

## Current objective
Build a standalone, one-page factory performance demo for RECAFCO management.
Use consistent sample data. SAP integration follows design and functionality approval.
This documentation package is the starting specification; no application has been built or tested yet.

## Essential rules
- Keep figures and language readable for management aged 45+ viewing a large screen.
- Default display title: **RECAFCO Factory Performance**. This is a proposed working name, awaiting management confirmation.
- Include Daily, Weekly, Monthly and Yearly controls; distinguish period totals from current snapshots.
- Use React, TypeScript, Vite, Tailwind CSS, Apache ECharts and TanStack Query.
- Start with a static frontend and asynchronous demo provider; no database, SAP connection or backend service.
- Keep demo fixtures, metric calculations, data access and presentation separate.
- Never describe demo figures as real SAP data.
- Do not invent the meaning of SAP report columns, cockpit queries or project completion.
- Keep this standalone project separate from FMP, MMS and AuditFlow_IMS.
- Never stop all Node processes on a shared Windows server; target only this application's process.
- Update the progress tracker after meaningful implementation changes.
- Update relevant context files when implementation changes an agreed boundary or specification.

Follow explicit user instructions over this documentation. Resolve reversible implementation choices autonomously; record assumptions. Ask only when missing information materially affects business meaning, access or an irreversible action.
