# UI Context

## Visual direction
A modern executive factory display: spacious navy panels, bright figures, restrained RECAFCO red accents and clear charts.
Use varied panel sizes with a dominant production trend.
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
| Product-row quantity | 32 px (26 px beyond four rows) |
| Card/panel title | 24–28 px |
| Chart labels and project names | 22–24 px |
| Supporting text | 20–22 px |
| Period button | 22–24 px |

Implemented: order counts 76 px; concrete main figure 64 px; units 28 px; screen title 40 px extra-bold; panel titles 26 px; chart axes, bar values and status line 22 px; captions, panel notes, legends and footer 20 px. Numerals are tabular.

Scale deliberately for 4K; do not keep 1080p text sizes on a 4K canvas.
Never shrink everything to force excess content into the screen.
Actual panel dimensions and viewing distance must inform final sizing.

## Layout
- One overview page with no sidebar; no routing library required for the initial scope.
- Header: logo/title on left; period buttons and the Project selector in the centre, with two reserved status lines beneath (what is shown; loading or failure with Retry), so messages never move the dashboard; date/time and fullscreen.
- Four headline cards: Current Sales Orders, Active Production Orders, Produced Elements, Delivered Elements. Order cards show one count labelled "Current". Quantity cards show compact rows of product, quantity and unit, with delivery notes as a separate caption. All four share the height needed for the quantity rows.
- Main area: Production Trend spans three fifths at full remaining height. The right two fifths stack Concrete Output and Project Summary, because Project Summary needs four columns with units.
- Footer: source label, data timestamp and refresh status.
- Start with 24–32 px outside padding and 20–24 px panel gaps.
- 20–24 px panel radius; 12–16 px small control radius; pill selected-period control if useful.
- No dashboard scrolling at 1920×1080 or 3840×2160 fullscreen.
- Smaller desktop/tablet/mobile may stack and scroll; preserve legibility.
- Fit browser-window display separately from native fullscreen; account for browser chrome.

## Chart conventions
Trend ("Production Trend"): one product-and-unit series at a time, chosen with the labelled "Product and unit" buttons (e.g. "Precast volume · m³"). There is never a combined option. The axis, tooltip, legend and total use the series' unit; the total matches its Produced Elements row exactly. The selection survives period changes. Implemented:
- The panel header shows the period total.
- Daily, Weekly and Yearly print a value on every productive bar: whole numbers, with one decimal below 10.
- Date-only Daily data: one day-total bar with "Hourly detail unavailable" in amber. No hour or midnight output is invented.
- Zero-output intervals: no "0" label. They are drawn as a short grey baseline mark, explained by a "No production" legend, and stay distinct from the shaded "Not yet reached" area.
- Monthly (28–31 bars): only the highest bar carries a number (nothing taller beside it can collide). The selected day is drawn in a lighter blue and both days are described under the chart, e.g. "Selected day, to 2:00 PM: Wed 14 Oct · 24.1 m³" and "Highest day: Tue 13 Oct · 62 m³".
- The interval containing the demo reference time is drawn in a lighter blue (`--chart-blue-emphasis`) and named in the legend: Weekly "Selected day, to 2:00 PM"; Yearly "October 2026, to Wed 14 Oct"; Daily "Current hour, to …" only when that hour is partly elapsed.
- Hourly axis labels use the 12-hour form "6 AM".
- Axis labels: every other hour or day for Daily and Monthly, all labels otherwise. The y-axis uses about 3 gridlines.
- Axis labels, bar values and the y-axis unit are 22 px at the 1080p baseline.
Concrete Output: the selected-period m³ as the main figure, the "Batch plant" caption, and month-to-date as a secondary figure labelled with the month ("October 2026, to Wed 14 Oct"). No capacity, target, percentage or gauge.
Project selector: a large button that always names the chosen project; a name too long for it ends in "…", with the full name in its accessible name and tooltip, so the header never changes size. Opening it focuses a search box (name or code, partial, case-insensitive, surrounding spaces ignored). All Projects is pinned above the results, even while searching; projects follow alphabetically by name, with the code as tie-breaker, and Unassigned last. Each option shows the name above its exact code; long names and codes wrap rather than scroll sideways. Only the project list scrolls, and the list stays inside the viewport. Selected: check mark and blue edge (the only check mark). Keyboard option: blue outline. Hover: quiet background only. Typing puts the keyboard on the first match. With no match it reads "No matching projects", and All Projects stays available. Arrow keys, Home, End and Enter work; Escape closes. Closing in any way clears the search, and focus returns to the button after a choice or Escape.
Project Summary: follows the chart's selected product and unit, named prominently in the heading ("Precast volume · m³ · Selected week activity"). Columns: Project, Produced, Delivered, with a unit beside each quantity. One row per project with activity (production or delivery), name first and code underneath, alphabetical with Unassigned last: an index, not a ranking. It shows period activity, never completion. Choosing a row applies the project; a filtered view stays on that project, offers "Show All Projects", and shows an explicit empty message when that project has no activity for the product. Pages are cut from measured row heights at the real width, so a wrapped long name never pushes rows out of the panel and text never shrinks; the page resets when the period, project or product changes.
Selected product highlight: the chart's product-and-unit row is marked in both quantity cards with a raised background and a thin blue left edge, at the same row height, plus aria-current. Every row stays visible; Precast volume and Precast pieces are marked separately.
Project Summary total: a line under the heading, "All projects · Produced 1,581 pieces · Delivered 1,795 pieces", or the project's name when one is selected. It covers every matching project across all pages and wraps rather than cutting a long name.
Project Summary paging: the first footer line reads "Showing 1–3 of 5 projects · Page 1 of 2", "Showing 3 projects" on a single page, or "Showing 1 project" for one. The second line holds Auto pages on the left and labelled Previous and Next buttons on the right.
Auto pages: off by default. "Auto pages" with Start, then Pause or Resume. While running it reads "● Auto pages on · every 15 s"; when held it reads "● Auto pages paused". It turns pages every 15 s, looping. It holds still while the pointer or keyboard focus is in the summary, the project list is open, or another view is loading or has failed, and it suspends while the tab is hidden, restarting with a fresh interval. Manual paging stops it until resumed. A new dataset or view returns to page 1 with a fresh interval. Automatic page changes are not announced; manual ones are.
Future part of the chart: the shaded area after the data's reference time (never the live clock) reads "Later hours" on Daily and "Not yet reached" on Weekly, Monthly and Yearly. It is drawn only for intervals that have not occurred; elapsed zero hours stay grey marks ("No production"), and unknown data, failed loads and completed periods never use it.
Concrete Output: a compact band, the title with "All Projects · batch plant" on the first line and two labelled figures beneath: the selected period ("Selected week") and "Month to date · through 14 Oct 2026". The date comes from the cutoff the month-to-date figure was calculated to (`concrete.monthToDateThrough`, the source as-of time), so it can never disagree with the number. The title column reads "All Projects · batch plant", or "All Projects · not filtered by project" while a project is selected. Two labelled figures: the selected period ("Selected week") and "Month to date · Oct 2026".
Product labels: cards read "Hollowcore", "Precast volume", "Precast pieces" and "GRC", with the unit beside each quantity. Chart buttons and the Project Summary heading add the unit where the name lacks it: "Hollowcore · m²", "Precast volume · m³", "Precast pieces", "GRC · m²". No subtype appears without a verified mapping. Unverified units read "(unverified)" in amber.
No production: if the chosen product has no records for the project, the chart area says so. The chart never switches product by itself.
Unmapped items and unverified units stay visible as their own rows, flagged in amber with text. Beyond four rows, cards and table tighten; table text steps from 22 px to 20 px.

## Demo date wording (presentation polish, 11 Oct 2026)
The demo reference date (Wed 14 Oct 2026, 2:00 PM) differs from the live Kuwait date. Wording must never suggest sample figures describe the real current day:
- Period cards and panels say "Selected day / week / month / year", never "Today / This week".
- Order cards say "Current" with "as of Wed 14 Oct, 2:00 PM", never "Now".
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
  - Thin accent strip: slate for current snapshots, blue for production, teal for delivery.
- **Colour roles:**
  - RECAFCO red: selected period.
  - Blue: production (bars, selected series, Produced column and strip).
  - Light blue: the in-progress interval.
  - Teal: delivery (Delivered column and strip). Always paired with a text label.
  - Amber: demo label and actual status messages only.
  - Red-pink: failures. No colour judges performance.
  - Slate: snapshot strip.
- **Depth:** panels and cards use `--shadow-panel` (faint top highlight plus soft drop shadow) with the existing border.
- **Motion:**
  - ECharts bar transitions (300 ms) and control colour transitions (200 ms), all disabled under reduced motion.
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
Display the selected date range and the concrete month.
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
