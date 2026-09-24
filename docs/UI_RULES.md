# UI RULES

Interaction and presentation rules that are load-bearing for this product.
Treat these as regressions if broken, not style preferences.

## Selection vs. work status

Two different checkboxes exist and must stay independent:

- **Selection checkbox** — which rows are targeted for a bulk action
  (`SelectionBar`). Volatile, lives in `uiStore.selection`, cleared on
  reload/search change. Date-group headers do **not** have a selection
  checkbox (removed by design — selecting a whole date group was confusing).
- **Work-status checkbox** (생성/미캔/custom) — persisted per keyword via
  `KeywordStatus`. Checking it never touches selection state and vice versa.

"전체 선택" (select all) only ever targets the keywords **currently visible**
on screen (respecting the list window + search/filter), never hidden rows.

## Clicking a keyword never auto-sends

Clicking a keyword:
1. Copies the assembled prompt (keyword + optional image-style instruction)
   to the clipboard.
2. Opens the user's default generation site in a new tab.

It does **not** auto-paste, auto-submit, or manipulate the target page's DOM
in any way, and it does **not** auto-check "생성" just for being clicked.
"생성" is only ever auto-checked by a *successful* Direct Generate call (see
`docs/specs/generation.md`) or by the user checking it themselves.

Before the user has picked a default generation site, clicking a keyword
routes to Settings instead of silently failing.

## Calendar O/X mark rule

Defined in `src/domain/calendar.ts` (`genMark`), judged on the "생성" column
only:

- **생성 checked → `○`, immediately, regardless of date** (past, today, or
  future). Checking it should be reflected the moment it's checked.
- **생성 unchecked + the date is in the past → `×`** (a day that ended
  without generation).
- **생성 unchecked + today or future → no mark.** The day isn't over yet;
  don't shame it as a miss.

O/X is a per-keyword mark, not a per-day mark — a day can show multiple
marks, one per keyword.

## List window (date plans)

The list view does not render all 365 rows at once. It's anchored to a
month picker shared with the Calendar view; selecting a month shows every
date in that month from the start, with upcoming dates above today and past
dates below (most-recent-past first). "이후 더 보기" / "전체 N일 보기"
controls do not exist for date plans anymore (superseded by month picking).
Weekly/monthly plans, which have no calendar, keep the older period-window +
search behavior.

The "today" anchor should refresh within ~30s automatically and immediately
on tab focus, so a plan open at midnight doesn't show a stale "today".

## Brand & chrome

- Colors sourced from the logo: violet `#6b4df5` (primary), coral `#f4695a`
  (today / accent), applied to a 4px animated top gradient strip, progress
  bars, and checkbox `accent-color`. Keep decoration minimal — this is a
  productivity tool, not a marketing page.
- Footer: solid violet bar, centered, `© <year> WOOJOO Stock Planner` +
  **사용법** (usage help modal) + **데이터 처리 안내** (data handling notice
  modal) links.
- The 사용법 modal is a fixed-size dialog (max 720×740) with two tabs (사용
  방법 / 이용 안내); only its body scrolls, the header/tabs stay fixed. It
  does not currently show a sample video or a sample-GPT prompt inline —
  see `docs/DECISIONS.md` if that changes again.
- The 데이터 처리 안내 modal is the authoritative, user-facing statement of
  what is and isn't collected. If a data-handling fact changes (what's
  stored, where, whether anything leaves the browser), update that modal's
  copy in the same change — don't let it drift from reality.

## Mobile

- Text inputs render at `16px` to stop iOS/Android auto-zoom on focus. Don't
  add a `viewport` zoom lock as an alternative fix.
- Mobile calendar (≤640px breakpoint) still renders a 7-column month grid
  (not an agenda-only view) with compact per-day keyword-count + status dots;
  tapping a day opens the full keyword list for that day in a modal.
- No page-level horizontal scroll on any mobile view — this is asserted by
  e2e (`docs/TESTING.md`).

## Plan search (header search box)

A search box sits in the app header, right of the subtitle (`PlanSearch`,
rendered in `App.tsx`'s `<header>`). It is a **separate control** from the
Toolbar's existing list-view search/filter (`uiStore.search`/`filter`, which
still only filters the *currently selected month's* groups and stays
untouched by this feature):

- **Scope is the entire active plan, not the visible month.** It searches
  every `KeywordItem.keyword` in `snapshot.keywords` for whichever plan is
  currently active — the same data `App.tsx` already loads, no new query/DB.
  Switching months or view mode never narrows it.
- **Plan isolation is absolute.** Because the search source is the active
  plan's own snapshot, another plan's items can never appear, no matter how
  similar the query. Switching the active plan immediately clears the query
  and closes any open result panel (the component remounts via
  `key={activePlan.id}`) — a stale result from the previous plan must never
  linger, even for a frame.
- **Match rule:** case-insensitive substring, trimmed. No fuzzy matching, no
  ranking beyond `(period, sortOrder)` — the same order `getPlanSnapshot`
  already returns keywords in, so filtering preserves it for free.
- The result panel is a fixed-height dropdown right under the search box,
  never a page-pushing block: `max-height` ~380px on desktop, ~48vh on
  mobile (≤640px), with the result list scrolling internally while a "검색
  결과 N개" count header and (when truncated) a limit-notice footer stay put.
  Rendering is capped at the first 50 matches — the full match count still
  shows in the header even when it exceeds that; a footer note
  ("총 N개 중 50개만 표시합니다…") only appears past the cap. There is no
  "load more" — this is a quick jump tool, not a second list view.
- **Clicking a result never edits or generates anything** — it's pure
  navigation: switches to that period's month and, in Calendar view, opens
  the day detail modal (`focusDayRequest`, reusing `DayKeywordsModal`); in
  List view, scrolls to and briefly (~1.6s) highlights that date's
  `PeriodGroup` (`highlightPeriod`, a `box-shadow` pulse — no animation
  beyond that). The result panel closes either way.
- Escape closes the result panel without clearing the query; the panel
  reopens on refocusing the input (same query, if still non-empty) or on any
  further typing. The query itself is never persisted (no IndexedDB/
  localStorage row) — a reload clears it like any other transient UI state.
- Same component for both purposes — Stock searches keyword text, Planner
  searches task text (same underlying `KeywordItem.keyword` field), no
  purpose-specific search logic beyond the placeholder/aria-label wording.

## Plan type surface

New plans are always the date-based `'365'` type — there is no type picker
in the "새 계획" dialog and no type badge next to the plan name (see
`docs/DECISIONS.md` for why weekly/monthly/custom were pulled from the UI).
Don't re-add a type picker without checking that doc and
`docs/specs/stock-planner.md` first.
