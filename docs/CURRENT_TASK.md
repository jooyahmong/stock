# CURRENT TASK

Tracks what's actively in flight so Claude Code and Codex don't silently
duplicate or conflict. Update this file as part of whatever change picks a
task up or finishes it — don't let it go stale.

## Active

_Nothing in progress right now._

## Recently completed

### Plan search (header search box)

- **Status:** `IMPLEMENTED`, committed (`58eca19`) and deployed to
  production, plus a follow-up large-result UX fix (see below, not yet
  committed as of this entry — check git status). Full behavior in
  `docs/UI_RULES.md` → "Plan search".
- **What shipped:** `src/components/PlanSearch.tsx`, rendered in `App.tsx`'s
  header next to the subtitle. Searches every item (keyword or task text) in
  the currently active plan only — full-plan scope, not month-scoped, and
  never leaks another plan's data (plan switch clears query/results via a
  `key={activePlan.id}` remount). Case-insensitive substring match over
  `PlanSnapshot.keywords` (already sorted by `(period, sortOrder)` — no new
  index/DB). Clicking a result navigates: Calendar view opens that day's
  detail modal (`CalendarView`'s new `focusDayRequest` prop); List view
  scrolls to and briefly highlights that date's `PeriodGroup` (new `id`/
  `highlighted` prop). Shared between Stock and Planner, no purpose-specific
  logic beyond wording. Unrelated to and doesn't touch the Toolbar's existing
  month-scoped list search/filter. Escape's native `type="search"`
  "clear value" default action is blocked (`e.preventDefault()`) so Escape
  only closes the panel, keeping the query for refocus.
- **Large-result UX follow-up:** result panel is a fixed-height dropdown
  (`max-height` ~380px desktop / ~48vh mobile) with only the list scrolling
  internally — it never pushes the page down. A "검색 결과 N개" count header
  always shows the true match count; rendering itself caps at 50 rows, with
  a footer notice ("총 N개 중 50개만 표시합니다…") appearing only past that
  cap. Sorting/navigation/lifecycle (Clear/Esc/plan-switch/isolation)
  unchanged.
- **Verification:** `tsc -p . --noEmit` clean; unit 131/131 (unchanged — no
  new unit-testable pure logic, the substring filter is trivial and covered
  by E2E); production build clean; 7 Plan-search E2E scenarios total
  (isolation + query-clear-on-plan-switch + empty-result wording,
  case-insensitive + off-screen-month scope, click-to-navigate for both
  views + highlight, Planner task-text search, mobile no-overflow, 62-match
  render-cap/count/notice/max-height/scroll across desktop+mobile, ≤50-match
  no-notice regression) all pass; full E2E 50/50 (7 Direct Generation
  skips), 0 Stock/Planner regressions.

### Production default-pack audit + additive migration

- **Status:** `RESOLVED`. `stock.woojooland.com` showed pre-existing Plans
  ("365 재구성", "데일리 작업") instead of the expected default stock pack.
- **Audit finding (code-confirmed, not speculation):** those two names have
  never existed anywhere in this codebase or its git history — they aren't
  identifiable dev/sample data, almost certainly created through the normal
  "+ 새 계획" UI. Root cause was structural: `runSeedOnce` permanently
  disables itself, by design, the moment a production browser has *any*
  existing Plan (see `docs/specs/stock-planner.md`) — so a browser that had
  one Plan before the default pack existed would never get it, regardless of
  marker bumps. Full reasoning in `docs/DECISIONS.md` → "Seeding".
- **What shipped:** `ensureDefaultPack` — a second, independently-marked
  (`seed:defaultPack`), **purely additive** pass that creates a
  `"2027 Stock Keywords"` Plan (`purpose: 'stock'`) once if one doesn't
  already exist by name, and never reads, modifies, or deletes any other
  Plan (Stock or General Planner). The default pack's name changed from
  "365 스톡 키워드" to "2027 Stock Keywords" for **all** installs, new and
  existing. Does **not** force the new plan to become active (a startup-
  timing race with `App.tsx`'s plan-selection effect made that unreliable
  without either blocking initial render or touching that shared effect —
  both judged riskier than the bug being fixed); it's selectable from the
  plan dropdown instead.
- **Explicitly not done:** no deletion of "365 재구성" / "데일리 작업" or
  any other pre-existing Plan — see the audit finding above. If they later
  turn out to be identifiable dev artifacts by some other means, a targeted
  cleanup can be scoped separately.
- **Verification:** `tsc -p . --noEmit` clean; unit suite 131/131 (no seed.ts
  unit coverage exists or was added — Dexie/IndexedDB logic in this project
  is verified via E2E, matching existing convention); production build
  clean; E2E 41/41 passed (7 Direct Generation scenarios skipped), including
  a new scenario that seeds a legacy-plan + General-Planner-plan production
  state directly via raw IndexedDB, reloads three times, and asserts: both
  pre-existing plans untouched, exactly one "2027 Stock Keywords" created,
  no duplicate on repeated reload.

### Stock E2E maintenance — resolved

- **Status:** `RESOLVED`. All previously reported Stock E2E failures were
  stale test expectations after the UI evolved; no product regression was
  found and no product code changed.
- **What changed:** date helpers now navigate to the target month and reject
  dates before the first available month; list scenarios verify the selected
  month's complete contents without the retired expansion controls; generator
  scenarios explicitly choose a default custom site and distinguish fixed
  presets from custom rows; guidance text and the minimum-month navigation
  assertion now match the current UX.
- **Verification:** E2E 40/40 passed with 7 Direct Generation scenarios
  skipped by the disabled feature flag; unit suite 131/131 passed;
  `tsc -p . --noEmit` and the production build passed. The four General
  Planner E2E scenarios and all exercised Stock scenarios passed.

### General Planner / Diary / To-do support — V1

- **Status:** `IMPLEMENTED (V1)`. Confirmed decisions were provided, the open
  questions in the original entry were resolved, and the feature was built
  as a `purpose` axis (`'stock' | 'planner'`) on the existing `Plan` entity —
  see `docs/specs/general-planner.md` for the full spec and
  `docs/DECISIONS.md` for the reasoning.
- **What shipped:** plan creation purpose picker, Planner default status
  column (완료 only), Calendar Quick Add (in-month cells — including a click
  anywhere on a cell's empty background, not just the day number or the
  `+ 추가` hint, so cells that already hold 1–2 tasks can still be
  quick-added to; see `docs/specs/general-planner.md` → "Calendar Quick
  Add"), completion checkboxes (calendar + list), task edit/delete/
  date-change, no bulk selection for Planner, no generation on task click,
  Planner Excel Template/Full Export (`Date | Task | 완료`) reusing the
  Stock Excel parser/builders via an optional `itemLabel` param.
- **Verification:** `tsc -p . --noEmit` clean; unit suite 131/131 (was
  118/118 before this feature — 13 new tests, 0 regressions); production
  build clean; new Planner E2E scenarios (4) all pass; Stock E2E scenarios
  confirmed **not regressed** by diffing against a pre-feature baseline run.
- **Explicitly not built:** multi-device sync (shared with Stock,
  `docs/specs/sync.md`), drag-and-drop, recurring tasks, reminders, free-text
  notes beyond single-line task text.

## Backlog (not ready, no doc yet)

- See `docs/PROJECT.md` → "Phase 2 candidates" style items are tracked
  informally in `README.md`'s history; promote anything that gets picked up
  to a `docs/specs/*.md` file and list it here as `READY` when it is.
