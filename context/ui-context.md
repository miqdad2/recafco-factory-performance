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

Implemented (management presentation design): KPI figures 76 px, stepping down to 64 px for values longer than 6 characters (e.g. "66,197.9"); units 28 px; screen title 40 px extra-bold; panel titles 26 px; chart axes, bar values and status line 22 px; captions, panel notes, legends and footer 20 px. The capacity percentage scales with the gauge (about 55–60 px at 1080p). Numerals are tabular.

Scale deliberately for 4K; do not keep 1080p text sizes on a 4K canvas.
Never shrink everything to force excess content into the screen.
Actual panel dimensions and viewing distance must inform final sizing.

## Layout
- One overview page with no sidebar; no routing library required for the initial scope.
- Header: logo/title on left; period buttons centrally/right; date/time and fullscreen.
- Four headline cards: Current Sales Orders, Active Production Orders, Produced Elements (pieces), Delivered Element (pieces, with delivery-note count).
- Middle: production trend spans approximately two thirds; capacity panel one third.
- Bottom: Production by Product (Hollowcore, Precast, GRC) and four selected project progress rows.
- Footer: source label, data timestamp and refresh status.
- Start with 24–32 px outside padding and 20–24 px panel gaps.
- 20–24 px panel radius; 12–16 px small control radius; pill selected-period control if useful.
- No dashboard scrolling at 1920×1080 or 3840×2160 fullscreen.
- Smaller desktop/tablet/mobile may stack and scroll; preserve legibility.
- Fit browser-window display separately from native fullscreen; account for browser chrome.

## Chart conventions
Trend ("Production Trend"): produced elements in whole pieces; readable bars, restrained gridlines, a "pieces" axis with whole-number ticks, and sensible tick density. Implemented:
- The panel header shows the period total.
- Daily, Weekly and Yearly print a whole-piece count on every productive bar.
- Zero-output intervals: no "0" label. They are drawn as a short grey baseline mark, explained by a "No production" legend, and stay distinct from the shaded "Not yet reached" area.
- Monthly (28–31 bars): only the highest bar carries a number (nothing taller beside it can collide). The selected day is drawn in a lighter blue and both days are described under the chart, e.g. "Selected day, to 2:00 PM: Wed 14 Oct · 50 pieces" and "Highest day: Tue 6 Oct · 102 pieces".
- The interval containing the demo reference time is drawn in a lighter blue (`--chart-blue-emphasis`) and named in the legend: Weekly "Selected day, to 2:00 PM"; Yearly "October 2026, to Wed 14 Oct"; Daily "Current hour, to …" only when that hour is partly elapsed.
- Hourly axis labels use the 12-hour form "6 AM".
- Axis labels: every other hour or day for Daily and Monthly, all labels otherwise. The y-axis uses about 3 gridlines.
- Axis labels, bar values and the y-axis unit are 22 px at the 1080p baseline.
Monthly capacity: large semicircle or clean progress visual; show actual / capacity m³ and percentage. Implemented:
- Inline SVG semicircle; the arc stops at 100% while the printed percentage keeps the true value.
- Title "Monthly Plant Capacity", the month on the right, and the subtitle "Concrete batch plant · illustrative".
- The gauge takes all spare height; actual output, capacity and remaining sit in three aligned columns beneath it. Turquoise is neutral, with no good/bad colouring until business thresholds are agreed.
- Unknown capacity: "Not available", "capacity not set", and "Not set" with no unit.
- Over capacity: full arc, "over capacity", and "Above capacity".
Production by Product: three large horizontal bars (Hollowcore, Precast, GRC) with right-aligned whole-piece counts ("513 pcs"); categories are mutually exclusive and always listed in that order, including zero rows. Concrete grades are no longer shown. (Replaced the grade mix on 12 Oct 2026.)
Projects: four names, codes as secondary text, percentages and progress bars. Implemented:
- Panel note "Delivery progress · demo"; each code sits on its own line under the name.
- Bars use the production blue.
- The calculation basis (delivered pieces ÷ planned pieces) is supplementary screen-reader text and is documented in `src/lib/dashboard/fixtures/README.md`.

## Demo date wording (presentation polish, 11 Oct 2026)
The demo reference date (Wed 14 Oct 2026, 2:00 PM) differs from the live Kuwait date. Wording must never suggest sample figures describe the real current day:
- Period cards and panels say "Selected day / week / month / year", never "Today / This week".
- Order cards say "Demo snapshot" with the snapshot date and time ("Wed 14 Oct, 2:00 PM"), never "Now".
- Chart summaries say "Selected day", never "today".
- The footer separates "Demo data · SAP not connected", "Demo reference time: …" and "Last successful demo load: …". The live clock stays in the header, alone.
- Card chips use sentence case so the chip and its caption fit on one line at 1080p.

## Management presentation design (11 Oct 2026)
- **Header:**
  - Official logo on a white tile, a thin divider, and "Factory Performance" at 40 px extra-bold.
  - Period controls centred, with the "Showing <range>" status beneath.
  - Amber "Demo data" badge.
  - Live clock labelled "Current time", 12-hour ("1:05 PM"), with the date; "Kuwait" is not shown, but all times use Asia/Kuwait internally.
- **Time format:** every visible time uses the 12-hour form with uppercase AM/PM: clock, snapshot ("Wed 14 Oct, 2:00 PM"), footer timestamps and Monthly legend. Midnight shows "12:00 AM" and noon "12:00 PM". Formatting comes from Kuwait civil time, so it is identical in every browser.
- **KPI cards:**
  - A fixed-height figure row bottom-aligns numbers and units across cards.
  - Thin accent strip: slate (`--accent-snapshot`) for demo-snapshot cards, blue for period output.
  - The redundant "Volume produced" caption was removed.
- **Colour roles:**
  - RECAFCO red: selected controls.
  - Blue: production bars, product bars, project progress.
  - Light blue: the in-progress (selected-day / current-month) bar.
  - Turquoise: capacity only.
  - Amber: demo/warning.
  - Slate: snapshot strip.
  - Teal and violet are no longer used in the trend.
- **Depth:** panels and cards use `--shadow-panel` (faint top highlight plus soft drop shadow) with the existing border.
- **Projects:** percentage 32 px bold, bar 16 px tall in production blue, code on its own line.
- **Motion:**
  - ECharts bar transitions (300 ms), control colour transitions (200 ms), and progress-bar width transitions (300 ms), all disabled under reduced motion.
  - Numbers never animate through intermediate values.
  - A KPI fade-in was tried and removed: headless rendering froze it at low opacity, an unacceptable risk on a 24/7 wallboard.
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
