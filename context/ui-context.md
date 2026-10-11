# UI Context

## Visual direction
A modern executive factory display: spacious navy panels, bright figures, restrained RECAFCO red accents and clear charts.
Use varied panel sizes with a dominant production trend and prominent monthly capacity.
Primary audience: management aged 45+, reading a large landscape screen from a distance.
Use simple labels and calm motion. Avoid small tables, photographic backgrounds behind figures and weak transparent surfaces.

## Colour tokens — proposed demo palette
These values are design proposals; RECAFCO brand red must be verified against the supplied logo.
| Role | CSS variable | Value |
| --- | --- | --- |
| Page background | --bg-base | #081321 |
| Surface | --bg-surface | #122236 |
| Raised surface | --bg-raised | #1A3048 |
| Primary text | --text-primary | #F7FAFF |
| Secondary text | --text-secondary | #C0CDDC |
| Primary accent | --accent-primary | #E34A55 |
| Chart blue | --chart-blue | #6BAFFF |
| Chart teal | --chart-teal | #50D4C1 |
| Chart violet | --chart-violet | #BAA1FF |
| Border | --border-default | #334C66 |
| Error | --state-error | #FF929A |
| Warning | --state-warning | #FFD181 |
| Success | --state-success | #64DBB0 |

Components use tokens; chart palettes resolve the same variables.
Verify normal-text contrast ≥4.5:1 and large-text/control contrast ≥3:1.
Colour never carries status alone; add explicit text/icons.

## Typography
Use locally bundled Inter or a comparably readable sans-serif; system sans fallback.
Use tabular numerals for changing figures; do not use a thin display face for metrics.
Proposed 1920×1080 fullscreen baseline:
| Role | Size |
| --- | --- |
| Screen title | 32–40 px |
| Main KPI | 56–72 px |
| Capacity percentage | 64–80 px |
| Card/panel title | 24–28 px |
| Chart labels and project names | 22–24 px |
| Supporting text | 20–22 px |
| Period button | 22–24 px |

Implemented (after presentation polish): chart axes, bar values and status line 22 px; captions, panel notes, legends and footer 20 px; nothing essential below 20 px at 1080p. KPI figures remain 64 px and the capacity percentage about 60 px.

Scale deliberately for 4K; do not keep 1080p text sizes on a 4K canvas.
Never shrink everything to force excess content into the screen.
Actual panel dimensions and viewing distance must inform final sizing.

## Layout
- One overview page with no sidebar; no routing library required for the initial scope.
- Header: logo/title on left; period buttons centrally/right; date/time and fullscreen.
- Four headline cards: Open Sales Orders, Active Production Orders, Concrete Produced, Delivered Output.
- Middle: production trend spans approximately two thirds; capacity panel one third.
- Bottom: grade breakdown and four selected project progress rows.
- Footer: source label, data timestamp and refresh status.
- Start with 24–32 px outside padding and 20–24 px panel gaps.
- 20–24 px panel radius; 12–16 px small control radius; pill selected-period control if useful.
- No dashboard scrolling at 1920×1080 or 3840×2160 fullscreen.
- Smaller desktop/tablet/mobile may stack and scroll; preserve legibility.
- Fit browser-window display separately from native fullscreen; account for browser chrome.

## Chart conventions
Trend: readable bars/line, restrained gridlines, explicit m³ axis/unit and sensible tick density. Implemented:
- The panel header shows the period total.
- Daily, Weekly and Yearly print a whole-m³ value on every productive bar.
- Zero-output intervals: no "0" label. They are drawn as a short grey baseline mark, explained by a "No production" legend, and stay distinct from the shaded "Not yet reached" area.
- Monthly (28–31 bars): no bar labels. The highest day (teal) and the selected day (violet) get their own colour plus a sentence under the chart, e.g. "Selected day, to 14:00: Wed 14 Oct · 152.3 m³".
- Axis labels: every other hour or day for Daily and Monthly, all labels otherwise. The y-axis uses about 3 gridlines.
- Axis labels, bar values and the y-axis unit are 22 px at the 1080p baseline.
Monthly capacity: large semicircle or clean progress visual; show actual / capacity m³ and percentage. Implemented:
- Inline SVG semicircle; the arc stops at 100% while the printed percentage keeps the true value.
- Title "Monthly Plant Capacity", the month on the right, and the subtitle "Concrete batch plant · illustrative".
- On full wallboard screens (the `wall` variant) actual output, capacity and remaining sit in a column beside a larger gauge (percentage about 60 px at 1080p). Smaller screens stack them below.
- Unknown capacity: "Not available", "capacity not set", and "Not set" with no unit.
- Over capacity: full arc, "over monthly capacity", and "Above capacity".
Grade mix: horizontal bars with grade names and values; group remaining minor grades as Other if necessary.
Projects: four names, codes as secondary text, percentages and progress bars. Implemented:
- Panel note "Delivery progress · demo"; each code sits on its own line under the name.
- Bars use the production blue.
- The calculation basis (delivered pieces ÷ planned pieces) is supplementary screen-reader text and is documented in `src/lib/dashboard/fixtures/README.md`.

## Demo date wording (presentation polish, 11 Oct 2026)
The demo reference date (Wed 14 Oct 2026, 14:00) differs from the live Kuwait date. Wording must never suggest sample figures describe the real current day:
- Period cards and panels say "Selected day / week / month / year", never "Today / This week".
- Order cards say "Demo snapshot" with the snapshot date and time ("Wed 14 Oct, 14:00"), never "Now".
- Chart summaries say "Selected day", never "today".
- The footer separates "Demo data · SAP not connected", "Demo reference time: …" and "Last successful demo load: …". The live clock stays in the header, alone.
- Card chips use sentence case so the chip and its caption fit on one line at 1080p.
No 3D/perspective charts, arbitrary decorative rings or unlabeled shapes.
No hover dependence; supplementary tooltips are allowed.
Future/unavailable data is distinct from a real zero.

## Controls and states
Daily, Weekly, Monthly and Yearly are large real buttons with keyboard support and selected state. Implemented:
- The selected button uses aria-pressed and a solid fill.
- A requested period that is loading or has failed shows an outline with "…" or "!".
- A status line under the buttons (polite live region, 22 px) reads "Showing <range>" plus "Loading <Period>…" or "<Period> did not load" with Try again.
Display selected date range and explicit monthly capacity month.
Fullscreen is initiated by a user click; catch unsupported/denied requests.
Keep escape/exit behaviour normal. Dedicated browser kiosk setup is a deployment decision.
Initial loading preserves the layout with skeletons.
Background refresh does not blank the overview.
Empty output: No production recorded for this period.
Failure after prior success: Data delayed, with last successful data timestamp.
Initial failure: Data unavailable with a retry control.
Demo always shows Demo data / Last successful demo load; do not label it Live SAP.
Use subtle 200–400 ms updates, no perpetual animation; respect reduced motion.

## Brand and icons
Use an approved, clean RECAFCO logo asset when supplied.
Do not treat a screenshot crop or AI recreation as the final approved logo.
Use a temporary text wordmark if required and record it in the tracker.
Use Lucide React sparingly at 24–28 px for controls; icons supplement words.
No greetings, avatars, promotional panels or extra navigation in the wallboard.

## Reference interpretation
1. Green reference: card organisation and capacity clarity.
2. Black/gold reference: typographic hierarchy and spacing.
3. Manufacturing reference: principal composition and prominent performance panel.
OEE, scrap, downtime and quality metrics from reference 3 are outside the initial scope.
