# Demo dataset — assumptions

All records are **synthetic and fictional**. They are not SAP data, and none of
the rules below are confirmed SAP business definitions. Metric definitions and open
SAP questions are in `docs/data-definitions.md`.

## Reference timestamp
- `DEMO_REFERENCE_TIME` = **Wednesday 14 October 2026, 2:00 PM Asia/Kuwait**.
- Every figure is calculated "as of" this moment. It does not move with the real
  date, so the demo always shows the same figures.
- It is separate from the live clock in the header and from `fetchedAt`
  (when the display finished loading the demo data).
- No record is dated after the reference time.

## Generation
`generate.ts` builds the records from fixed seeds, so the output is identical on
every load. Coverage: 1 Jan 2026 to the reference time.

- **Projects** (`catalog.ts`): seven fictional projects with `DEMO-` codes and invented names. Each takes only some item groups, so a project can have no records for a product (Ring Road Bridge Segments has Precast only).
- **Project references**, seed `DEMO_PROJECT_SEED`, so quantities do not depend on attribution. About 4% of lines have no reference and show under Unassigned. Some delivery notes and sales orders span two projects.
- **Items** (`catalog.ts`): a fictional item master. Finished Goods flags are
  deliberately inconsistent, as in the SAP examples. Stair and column Nos are marked
  as verified physical counts; other Nos is not.
- **Production receipts**, seed `DEMO_RECEIPT_SEED`:
  - Hollowcore (m²) and Precast (m³, and Nos for stairs and columns) carry a
    completion time, on the same shift pattern as the batching plant. They can
    show hourly bars.
  - GRC (m²) is **date-only**, so its Daily view shows "Hourly detail unavailable".
    This demonstrates how date-only SAP postings will behave.
  - Each line's `quantity` is that transaction. `orderCumulativeCompleted` repeats a
    running total, as order rows do, and is never summed. The order link is an
    illustrative monthly run per item, not one of the current production orders.
  - About 1% are cancelled. Occasional raw-material and steel-cage receipts are
    flagged Finished Goods to prove they are excluded by rule.
  - About 6% of scheduled hours are stoppages with no receipts.
- **Batching-plant concrete batches** (`DEMO-BAT-…`), seed `DEMO_SEED`, in m³ with
  up to three decimals:
  - Sunday–Thursday: about 5 AM–midnight, plus 12–2 AM night batches.
  - Saturday: morning shift, 6 AM–2 PM.
  - Friday: no production. 2–5 AM is never scheduled.
  - About 5% of scheduled hours are stoppages.
  - Output varies by season, with lower summer output.
- **Delivery notes**: 4–8 per weekday, 2–4 on Saturday, each with 1–3 product lines
  in the item's own unit. About 35% stay Open and still count; about 3% are cancelled.
  Some carry billing-adjustment or transport lines, which are excluded. Quantities
  are independent of production, so a product can deliver more than it produced in a
  period, drawing on earlier stock.
- **Sales orders** ("Demo Customer NN"): 80 orders, a mix of open, closed and
  cancelled, with 1–4 lines. Some open orders are fully delivered.
- **Production orders**: 60 orders, a mix of planned, released, closed and cancelled.
  Some released orders are already complete.

Concrete batches have no project reference. `componentIssues` is empty: the demo does not model component consumption, which never counts as output anyway. The real SAP examples (A–D in `docs/data-definitions.md`) live only in `sapExamples.test.ts`. No item has a verified subtype and no line has a verified element count, because no evidence for either exists yet.

The demo does not include unmapped items or unknown units, to keep the management
view clean. Both are covered by automated tests and were checked on screen with
temporary records.
