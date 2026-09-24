# CURRENT TASK

Tracks what's actively in flight so Claude Code and Codex don't silently
duplicate or conflict. Update this file as part of whatever change picks a
task up or finishes it — don't let it go stale.

## Active

_Nothing in progress right now._

## Recently completed

### General Planner / Diary / To-do support — V1

- **Status:** `IMPLEMENTED (V1)`. Confirmed decisions were provided, the open
  questions in the original entry were resolved, and the feature was built
  as a `purpose` axis (`'stock' | 'planner'`) on the existing `Plan` entity —
  see `docs/specs/general-planner.md` for the full spec and
  `docs/DECISIONS.md` for the reasoning.
- **What shipped:** plan creation purpose picker, Planner default status
  column (완료 only), Calendar Quick Add (in-month cells), completion
  checkboxes (calendar + list), task edit/delete/date-change, no bulk
  selection for Planner, no generation on task click, Planner Excel
  Template/Full Export (`Date | Task | 완료`) reusing the Stock Excel
  parser/builders via an optional `itemLabel` param.
- **Verification:** `tsc -p . --noEmit` clean; unit suite 131/131 (was
  118/118 before this feature — 13 new tests, 0 regressions); production
  build clean; new Planner E2E scenarios (4) all pass; Stock E2E scenarios
  confirmed **not regressed** by diffing against a pre-feature baseline run
  (see "Known issue" below — some Stock E2E scenarios fail, but identically
  with and without this feature's changes).
- **Explicitly not built:** multi-device sync (shared with Stock,
  `docs/specs/sync.md`), drag-and-drop, recurring tasks, reminders, free-text
  notes beyond single-line task text.

## Known issue (pre-existing, not introduced by Planner V1)

While verifying "no Stock regressions" for the Planner feature, **6 Stock
E2E scenarios were found already broken before any Planner code was
written** (confirmed via `git stash` + a clean baseline run — identical
failures, identical error messages, on the pre-Planner commit). Root cause
appears to be e2e helpers/scenarios that weren't updated when list view
switched to month-picker-based windowing (a fresh Full Export/`+ 날짜 추가`
flow lands the new row wherever `selectedMonth` happens to be, and a couple
of old assertions — `/전체 \d+일 보기/`, the old default-window-size check —
reference UI controls that no longer exist per that change). Affected:

- `seed = "365 스톡 키워드"` (전체 N일 보기 button)
- `list window: ...` (old default window size assumption)
- `Excel import: repeated dates...`, `keyword click copies text...`,
  `내 생성 사이트: 키워드 클릭마다...`, `생성 사이트 URL 검증...`,
  `keyword click with no generator...`
- `Calendar: 토글...`, `Calendar: 오늘/미래...`, `Calendar: 긴 키워드...`,
  `Calendar: 하루 4개 이상...`, `Calendar: 이전/다음 달 이동...`,
  `Calendar mobile: ...`

This is **not** in scope for the Planner feature and was **not** fixed as
part of it (fixing it would mean changing Stock-only e2e helpers/assertions
under a task that was scoped to Planner). Listed here so it isn't
rediscovered from scratch — promote to a proper backlog entry (and ideally
`docs/specs/stock-planner.md` gets a note) before someone picks it up.

## Backlog (not ready, no doc yet)

- **Fix the pre-existing Stock E2E breakage above.** Needs someone to
  decide whether `addKeywordOnDate`/related helpers should navigate the list
  view to the right month first, or whether the assertions themselves are
  stale and should be rewritten against the current month-picker UI.
- See `docs/PROJECT.md` → "Phase 2 candidates" style items are tracked
  informally in `README.md`'s history; promote anything that gets picked up
  to a `docs/specs/*.md` file and list it here as `READY` when it is.
