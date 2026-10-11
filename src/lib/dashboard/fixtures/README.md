# Demo dataset — assumptions

All records are **synthetic and fictional**. They are not SAP data, and none of
the rules below are confirmed SAP business definitions.

## Reference timestamp
- `DEMO_REFERENCE_TIME` = **Wednesday 14 October 2026, 14:00 Asia/Kuwait**.
- Every figure is calculated "as of" this moment. It does not move with the real
  date, so the demo always shows the same figures.
- It is separate from the live Kuwait clock in the header and from `fetchedAt`
  (when the display finished loading the demo data).
- No record is dated at or after the reference time.

## Generation
- `generate.ts` builds the records from a fixed seed (`DEMO_SEED`), so the
  output is identical on every load. Coverage: 1 Jan 2026 to the reference time.
- **Production batches** (`DEMO-PRD-…`), in m³ with up to three decimals:
  - Sunday–Thursday: about 05:00–23:00, plus 00:00–02:00 night batches.
  - Saturday: morning shift, 06:00–14:00.
  - Friday: no production. 02:00–05:00 is never scheduled.
  - About 5% of scheduled hours are stoppages (an elapsed hour with zero output).
  - Output varies by season, with lower summer output.
  - Six grades: C40, C50, C35, C60, C30, C25.
- **Delivery notes** (`DEMO-DN-…`): 4–8 per weekday, 2–4 on Saturday, each with
  1–3 lines of precast pieces. About 3% are cancelled.
- **Sales orders** (`DEMO-SO-…`, "Demo Customer NN"): 80 orders, a mix of
  open, closed and cancelled. Some open orders are fully delivered.
- **Production orders** (`DEMO-PO-…`): 60 orders, a mix of planned, released,
  closed and cancelled. Some released orders are already complete.
- **Projects** (`DEMO-P01…P07`): four featured on the dashboard. Planned pieces
  and opening delivered balances are invented.
- **Capacity:** 9,000 m³ per month, illustrative. Not derived from SAP "T.VOL".

## Calculation rules (see `../aggregate.ts`)
- **Period activity:** records with timestamps in [period start, reference time).
- **Concrete Produced:** sum of batch m³, calculated in whole litres so the
  trend and grade breakdown reconcile exactly.
- **Delivered Output:** pieces on completed delivery notes. The delivery note
  count is shown separately and is never treated as output.
- **Open sales order:** status open, posted before the reference time, with at
  least one line where ordered − delivered > 0.
- **Active production order:** status released, created before the reference
  time, with planned − completed > 0.
- **Project completion:** (opening delivered + delivered to reference time) ÷
  planned pieces.
- **Monthly capacity:** the month containing the reference time. Actual output
  is that month's production to the reference time.
