# Demo dataset — assumptions

All records are **synthetic and fictional**. They are not SAP data, and none of
the rules below are confirmed SAP business definitions.

## Reference timestamp
- `DEMO_REFERENCE_TIME` = **Wednesday 14 October 2026, 2:00 PM Asia/Kuwait**.
- Every figure is calculated "as of" this moment. It does not move with the real
  date, so the demo always shows the same figures.
- It is separate from the live clock in the header and from `fetchedAt`
  (when the display finished loading the demo data).
- No record is dated at or after the reference time.

## Two separate production measures
- **Finished elements** (whole pieces, by product category) drive Produced
  Elements, the Production Trend and Production by Product.
- **Batching-plant concrete** (m³) drives Monthly Plant Capacity only.
- Element pieces are never derived from concrete volume, and m³ never enters a
  piece total.

## Generation
- `generate.ts` builds the records from fixed seeds, so the output is identical on
  every load. Coverage: 1 Jan 2026 to the reference time.
- **Element production records** (`DEMO-ELM-…`), seed `DEMO_ELEMENT_SEED`:
  - One product category per record (Hollowcore, Precast or GRC) and a whole,
    positive number of completed pieces.
  - The same shift pattern as the batching plant, scaled to a 0–1 intensity.
    Mean pieces per full-intensity hour: Hollowcore 3.8, Precast 2.2, GRC 0.7.
    That is roughly 51 / 30 / 9 pieces on a full weekday.
  - About 6% of scheduled hours are stoppages with no completed elements.
  - Production exceeds deliveries over every period at the reference time.
  - A separate seed keeps every other demo record unchanged.
- **Batching-plant concrete batches** (`DEMO-BAT-…`), seed `DEMO_SEED`, in m³ with
  up to three decimals:
  - Sunday–Thursday: about 5 AM–midnight, plus 12–2 AM night batches.
  - Saturday: morning shift, 6 AM–2 PM.
  - Friday: no production. 2–5 AM is never scheduled.
  - About 5% of scheduled hours are stoppages.
  - Output varies by season, with lower summer output.
  - Concrete grades (C25–C60) are recorded on batches but are not shown.
- **Delivery notes** (`DEMO-DN-…`): 4–8 per weekday, 2–4 on Saturday, each with
  1–3 lines of pieces. About 3% are cancelled.
- **Sales orders** (`DEMO-SO-…`, "Demo Customer NN"): 80 orders, a mix of
  open, closed and cancelled. Some open orders are fully delivered.
- **Production orders** (`DEMO-PO-…`): 60 orders, a mix of planned, released,
  closed and cancelled. Some released orders are already complete.
- **Projects** (`DEMO-P01…P07`): four featured on the dashboard. Planned pieces
  and opening delivered balances are invented.
- **Capacity:** 9,000 m³ per month for the batching plant, illustrative. Not
  derived from SAP "T.VOL".

## Calculation rules (see `../aggregate.ts`)
- **Period activity:** records with timestamps in [period start, reference time).
- **Produced Elements:** sum of whole pieces on element production records. The
  trend and Production by Product come from the same records and add up exactly.
  Categories are mutually exclusive, so no element is counted twice.
- **Delivered Element:** pieces on completed delivery notes. The delivery note
  count is shown separately and is never treated as output. Deliveries come from
  delivery notes, never from production records.
- **Current (open) sales order:** status open, posted before the reference time,
  with at least one line where ordered − delivered > 0.
- **Active production order:** status released, created before the reference
  time, with planned − completed > 0.
- **Project completion:** (opening delivered + delivered to reference time) ÷
  planned pieces.
- **Monthly Plant Capacity:** the batching plant's concrete output (m³, summed in
  whole litres) for the month containing the reference time, against the planned
  m³ capacity.

## Pending SAP confirmation
- The SAP item-to-category mapping for Hollowcore, Precast and GRC (item groups,
  item codes or UDFs), and whether any item can belong to more than one category.
- Which SAP document records a completed element (receipt from production,
  production order completion or a custom report) and its timestamp.
- Whether element counts should include rejected or reworked pieces.
- Which batching-plant report column (for example "P.VOL" or "T.VOL") is the
  official concrete output.
