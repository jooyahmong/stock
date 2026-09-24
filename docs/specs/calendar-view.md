# SPEC — Calendar View

Status: **IMPLEMENTED**. Lives in `src/components/calendar/`, logic in
`src/domain/calendar.ts`.

## Role

Calendar View is **read + click-to-generate only** — for `purpose === 'stock'`
plans. It never edits keyword text, dates, or status directly, and never does
drag-and-drop — those stay in list view. It's the **default main screen**
(`src/lib/viewModePref.ts`, `readViewMode()` defaults to `'calendar'`); the
last view the user picked (list or calendar) is then remembered in
`localStorage`.

For `purpose === 'planner'` plans this "read-only" framing does not apply:
Calendar also supports adding tasks in place via Quick Add (clicking a day
number, the `+ 추가` hint, or any empty background inside an in-month cell)
and toggling completion directly from the compact grid cell — see
`docs/specs/general-planner.md` → "Calendar Quick Add" for the exact
behavior and event-propagation details. This is purpose-gated: Stock cells
never receive the background click handler and behave exactly as described
in this file, unchanged.

Only available for date-based plans (`calendarAvailable = kind === 'date'`).
Since only `'365'`-type plans can currently be created, this is effectively
"always available" today, but the guard is intentionally left in place for
when weekly/monthly plan creation is re-enabled (see `docs/DECISIONS.md`).

## Layout

- Desktop: 7-column month grid (Sun–Sat), `‹ Month Year ›` header + `[오늘]`
  jump button, today's cell highlighted. The month picker is centered and
  **shared with the list view** — picking a month in one is reflected in the
  other. The earliest navigable month is fixed (see
  `src/components/calendar/MonthNavigator.tsx` for the current bound).
- Mobile (≤640px): still a 7-column month grid, not an agenda-only fallback —
  each day cell shows a compact keyword count + status dot(s); tapping a day
  opens the full keyword list for that day in a modal. No page-level
  horizontal scroll is allowed at this breakpoint (asserted by e2e).
- Each day cell shows that date's `KeywordItem`s directly — data is never
  merged for display. Desktop shows up to 3 per day inline before collapsing
  to `+N개` → a detail modal listing everything for that day, each keyword
  clickable.
- Long keyword text is single-line ellipsis (`white-space: nowrap; overflow:
  hidden; text-overflow: ellipsis`); the full string is available via the
  `title` attribute and inside the day-detail modal.

## O/X mark rule

`genMark(dayIso, today, generated)` in `src/domain/calendar.ts`, judged on
the 생성 status column only (found via `src/domain/statusColumns.ts`):

```
생성 checked                    -> 'done'    (○), any date, immediately
생성 unchecked + date is past   -> 'missing' (×)
생성 unchecked + today/future   -> 'none'    (no mark — the day isn't over)
```

This is a **per-keyword** mark, not per-day — a single day can show multiple
marks if it has multiple keywords in different states. See
`docs/UI_RULES.md` for the product reasoning and `docs/DECISIONS.md` for why
this rule changed from "only past dates ever get a mark" to the current
"○ shows immediately" behavior.

Rendered as a bold, outlined glyph (`-webkit-text-stroke`) — blue for `○`,
red for `×` — chosen for visibility over the original small/thin marks.

## Interaction

- Clicking a keyword calls **the exact same `onRun` handler the list view
  uses** (routes through `src/hooks/useRunKeyword.ts` the same way) — there
  is no duplicated generation logic between list and calendar. Whatever the
  current generation mode is (내 생성 사이트 or Direct Generate, see
  `docs/specs/generation.md`), Calendar behaves identically to List.
- Month navigation (`‹` / `›` / `[오늘]`) and the shared month picker are the
  only calendar-specific controls; everything else (search, status filter,
  bulk selection, editing) is list-view only.

## Out of scope

Editing keyword text/date from the calendar, drag-and-drop rescheduling,
week view, and any calendar view for weekly/monthly-type plans (blocked by
`calendarAvailable`, and moot today since those plan types aren't creatable —
see `docs/specs/stock-planner.md`).
