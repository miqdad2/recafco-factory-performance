# Data definitions

For the developers and SAP consultant who will connect RECAFCO Factory Performance to real data.

**Status: proposed.** No definition here has been reconciled with real SAP data. The dashboard runs on synthetic demo records. It labels itself "Demo data · SAP not connected" and must keep doing so until these rules are confirmed.

Rules live in code in three places:
- `src/lib/dashboard/productMapping.ts`: which items count, and under which product and unit.
- `src/lib/dashboard/projects.ts`: which project a record belongs to.
- `src/lib/dashboard/aggregate.ts`: how records become figures.

## Metrics

| Metric | Proposed definition | Time behaviour |
| --- | --- | --- |
| Current Sales Orders | Distinct sales orders with status open, posted before the as-of time, with at least one line where ordered − delivered > 0 | Snapshot, labelled "Current"; ignores the period |
| Active Production Orders | Distinct production orders with status released, created before the as-of time, where planned − completed > 0. Excludes planned, cancelled and closed orders, and fully completed orders still marked released. Consistent with examples A–C below; business-wide validation is still pending | Snapshot, labelled "Current"; ignores the period |
| Produced Elements | Sum of transaction quantities on eligible, uncancelled finished-product receipt lines, by product and unit | Selected period |
| Delivered Elements | Sum of eligible lines on uncancelled delivery notes, by product and unit. Open and Closed notes both count | Selected period |
| Delivery notes (caption) | Distinct delivery documents with at least one eligible line | Selected period; never an output quantity |
| Production Trend | The Produced Elements row for one product and unit, split into time intervals | Selected period |
| Concrete Output | Batch-plant concrete in m³, labelled "Selected day/week/month/year" and "Month to date · <month>". Always All Projects | Selected period and reference month |
| Project Summary | Produced and delivered quantity per project for the chart's selected product and unit, with a total across every matching project (all pages, Unassigned included) that equals the headline row. Activity in the period, not project completion | Selected period |

Delivered can exceed produced in the same period, because deliveries can come from earlier stock. The dashboard never treats that as an error, never divides one by the other, and gives no red or green judgement without a verified target.

All of these except Concrete Output follow the selected project.

## Rules that protect the figures

**Identity.** Documents are identified by an internal key (`docEntry`), and lines by key plus line number. The displayed document number alone is not unique across numbering series, so it is never used for counting. A repeated row counts once.

**Units.**
- Quantities are grouped by product and unit. Unlike units are never added.
- There are no area-to-volume or quantity-to-pieces conversions.
- A product can have several rows; the demo's Precast has both m³ and pieces.
- Nos appears as "pieces" only for an item with `nosIsPhysicalCount` and a whole quantity. Otherwise it stays "Nos".
- `normaliseUnit` accepts spelling variants only (m2, m², sqm, …).
- Any other unit gets its own row, marked "(unverified)".

**Production quantities.** Only the transaction quantity on each receipt line is summed. Cumulative completed quantities repeated on production order rows are never summed; the order's cumulative figure only decides whether work remains.

**Eligibility.** The first matching rule wins:

1. Excluded item group: raw material, semi-finished steel, billing adjustment or service.
2. Non-inventory item: excluded as non-physical.
3. Mapped item group: Hollowcore, Precast or GRC.
4. Anything else, including an unknown item: shown as "Unmapped items", never dropped.

The Finished Goods flag is deliberately not used, because the SAP examples show it set inconsistently.

**Timing.**
- All period boundaries use Asia/Kuwait. Periods are half-open: [start, end).
- A record's period comes from its business date.
- A time of day is trusted only if it falls on that business date.
- A Daily chart shows hours only if every record for that product and unit that day has a trusted time. Otherwise it shows one day-total bar with "Hourly detail unavailable"; no hour is inferred and nothing is placed at midnight.
- An elapsed interval with no output is 0. An interval not yet reached is null, and the two are drawn differently.

**Unknown is not zero.** A provider returns `null` when a figure is unknown, and the screen shows "Not available". Loading shows blank blocks.

**Deliberately not calculated.**
- Delivery completion. Delivered ÷ produced is meaningless, because deliveries in a period need not come from that period's production.
- Capacity, targets, or anything derived from undefined report columns such as T.VOL and P.VOL.
- Project completion percentages.

## Project attribution

**Recorded references only.** A record belongs to the project written on it. Projects are never guessed from item descriptions or customer names.

| Record | Where the project comes from in the contract |
| --- | --- |
| Production receipt | The receipt line (`projectCode`) |
| Delivery note | Each line (`projectCode`), so one note can span projects |
| Sales order | Each line (`projectCode`), so one order can span projects |
| Production order | The order (`projectCode`) |
| Concrete batch | None. Output stays "All Projects" |

**Unassigned.** A missing or blank reference goes to "Unassigned", which is selectable and appears in Project Summary. Nothing is dropped. A code recorded on a transaction but missing from the project master stays visible, shown as "Project <code>".

**Quantities add up.** Each line has exactly one project, so All Projects equals the projects plus Unassigned, row by row. Snapshot validation rejects a Project Summary that does not match the cards.

**Order and delivery-note counts do not add up.** A document spanning projects counts once in All Projects and once in each project it touches. An order with lines for two projects therefore counts 1 in All Projects, 1 in each project, and the project views total 2. Do not sum project counts to reach the All Projects figure.

Within a project view, only that project's lines decide: a sales order counts there only if one of that project's lines still has a remaining quantity. The order stays "Current" and ignores the reporting period.

**Concrete Output.** Batches carry no project reference, so the figure is labelled "All Projects" even while a project is selected. It must not be presented as project-specific unless its source records support attribution.

## Product labels

| Row | On cards (unit beside the quantity) | On chart buttons and the Project Summary heading |
| --- | --- | --- |
| Hollowcore in m² | Hollowcore | Hollowcore · m² |
| Precast in m³ | Precast volume | Precast volume · m³ |
| Precast in verified pieces | Precast pieces | Precast pieces |
| GRC in m² | GRC | GRC · m² |
| Anything else | Product · unit, e.g. "Unmapped items · m²" | The same |

"Precast volume" and "Precast pieces" are separate quantity groups. They are never added, and they are not two measures of the same elements: the pieces row does not say how many elements the volume row contains. Units always stay beside quantities and on the chart axis.

Unverified units are flagged in amber with text: Nos without a verified physical count reads "Nos (unverified)", and an unknown unit reads "LM (unverified)".

Not done, because nothing supports it:
- Renaming rows as beams, walls, manholes or other subtypes.
- Calculating an element count from volume.
- Counting transaction lines as elements.

**Prepared for later, unused today:**
- `verifiedSubtype` on an item. Set from a verified mapping, it gives that item's quantities their own row and name, such as "Precast Beam volume". All demo items are `null`.
- `verifiedElementCount` on a receipt or delivery line. Rows report `producedElementCount` and `deliveredElementCount` only if every contributing record has a verified count; otherwise they are `null`. These figures are not displayed yet.

## SAP examples (screenshot-confirmed)

These four cases come from SAP screenshots supplied on 5 Nov 2026. They are regression tests in `src/lib/dashboard/sapExamples.test.ts` and are **not** in the demo dataset. The tests contain the document numbers, item descriptions and project codes shown below, so treat that file as internal. Values the screenshots do not show (record dates other than C's posting date, A's order number, the concrete and steel item codes, C's order status) are marked "assumed" in the test.

| | Screenshot shows | What the dashboard does |
| --- | --- | --- |
| A | Beam-PB-103 - 24/22: unit Nos, planned 1, completed 1, status Closed; 3.88 m³ concrete issued as a component | The 3.88 m³ issue is consumption, never Precast volume. The closed order is not active |
| B | Beam - 92/25-PRODUCTION, order 25303757: unit M3, planned 1,195.405, completed 1,189.297, remaining 6.108, Released, project PC/92-25/80117/417 | Active (released with production remaining). Order totals add nothing to period production |
| C | Receipt from Production 26301288, posted 24 Oct 2026: Straight Joint Pit - 61/26, order 26303249, type Complete, 1 Nos, project PC/61-26/80067/017; order planned and completed both 5 | Adds 1 to Precast pieces on 24 Oct, not 5. Date-only, so no hour is inferred. The fully completed order is not active |
| D | Steel reinforcement also has production receipts, sometimes in Nos | A receipt, or the unit Nos, does not make a finished element. Steel is excluded; an unknown item stays visible as Unmapped |

## Rules: confirmed by example versus proposed

**Shown by the examples above:**
- Period production uses receipt transaction quantities and posting dates (C).
- Cumulative order completion is not period production (B, C).
- Component issues, such as concrete issued to a beam order, are not finished output (A).
- Production receipts include non-element items such as steel, and Nos alone is not proof of an element (D).

**Still proposed, pending business-wide validation:**
- The eligibility mapping by item group (Hollowcore, Precast, GRC; raw material, steel, billing and service excluded). The examples show the need for one, not its contents.
- Which items' Nos is a verified physical count. The fixtures mark the A and C items, as the screenshots show single finished elements.
- Active Production Orders = released with production remaining, across all order types.
- Whether Reject (as opposed to Complete) receipts count; there is no transaction-type field yet.
- Cancellation, reversal and return handling, as already documented.
- `componentIssues` is in the contract only so tests can prove issues never count. The demo has none.

## SAP evidence still needed

The display stays unit-separated until these are supplied. None of them blocks the demo.

1. ~~One precast production example recorded in m³.~~ Received: example B (order level). A receipt-level m³ example would still help.
2. ~~One precast production example recorded in Nos/pieces.~~ Received: examples A and C.
3. Project codes, names and their transaction references: where the project is recorded on receipts, delivery lines, sales order lines and production orders.
4. Any reliable physical element-count field.
5. The item groups or codes that define each product, and which items' Nos is a physical count.
6. A Reject receipt and a reversal or cancellation example, to confirm how they appear.

## Timestamps

| Timestamp | Meaning | Shown as |
| --- | --- | --- |
| Reporting dates (`range`) | The selected calendar period | "Showing <project> · <dates>" under the controls |
| Source as-of (`sourceDataAsOf`) | The moment the records describe | "as of …" on order cards; "Demo reference time" in the footer |
| Fetch time (`fetchedAt`) | The display's last successful load; never advanced by a failure | "Last successful demo load" in the footer |
| Live clock | The real current time, 12-hour, Asia/Kuwait | "Current time" in the header |

## Source fields

These are candidate SAP Business One sources, listed as starting points only. **Neither the tables nor their meanings have been verified against RECAFCO's system, and no connection exists.** Confirm each with the consultant.

| Contract field | Candidate source to verify |
| --- | --- |
| Item `itemGroup`, `inventoryItem`, `finishedGoodsFlag` | Item master (OITM, item group table) |
| `nosIsPhysicalCount` | No SAP equivalent known; needs an agreed mapping table |
| Receipt line `docEntry`, `lineNum`, `postingDate`, `quantity`, `uom` | Receipt from Production (OIGN / IGN1) |
| Receipt `recordedAt` | Unknown. Needs a reliable production timestamp, if one exists |
| Receipt `cancelled` | Document cancellation fields; see question 5 |
| `projectCode` on each record | Project fields on document headers or lines; unverified, see the evidence list |
| Project master | Project code table; unverified |
| `verifiedElementCount`, `verifiedSubtype` | No source known; see the evidence list |
| Delivery note and lines | Delivery (ODLN / DLN1) |
| Sales order and lines | Sales Order (ORDR / RDR1) |
| Production order status and quantities | Production Order (OWOR) |
| Concrete batches | The daily concrete production report; its source and columns are unconfirmed |

When SAP is connected, the browser calls an internal backend API only. SAP credentials and requests belong in that backend, never in the Vite bundle, and `VITE_*` values are public. No endpoints or credentials are defined in this project.

## Questions for SAP reconciliation

**Orders**
1. Does "open" with a remaining quantity match how RECAFCO reads current sales orders? Do any lines or order types need excluding?
2. Does the proposed Active Production Orders definition match real usage, for example against the cockpit card?
3. Should semi-finished and steel production orders count as active, or only finished-product orders?
4. What do the existing cockpit cards calculate and filter?
4a. Is the project recorded on the header, the lines, or both, and which wins if they differ?

**Production**

5. How are cancelled receipts recorded: a flag, a reversal document, or both? Reversal lines could need subtracting rather than ignoring.
6. Which receipt types count (for example complete versus reject), and should rejected or reworked quantity be excluded?
7. Is a reliable production timestamp available, or only the posting date?
8. Can a receipt be backdated, and which date should reporting use?
9. What decimal precision do SAP quantities use? The contract assumes three decimals.

**Products and units**

10. Which item groups, codes or user-defined fields map items to Hollowcore, Precast and GRC? Can an item belong to more than one?
11. Which units occur per product? Where does Nos mean a verified physical count?
12. What are the real codes for raw material, semi-finished steel, billing adjustments and non-physical items?

**Deliveries**

13. Do returns or credit documents need to be subtracted?
14. Should delivery use posting date, document date or actual dispatch date?

**Concrete**

15. Which report column is the official batch-plant output? What do T.VOL and P.VOL mean?
16. Is there one batching plant or several?

**Calendar and access**

17. What are the factory week start, shift-day cutoff and fiscal year?
18. Is Service Layer available? What read-only access is approved?
