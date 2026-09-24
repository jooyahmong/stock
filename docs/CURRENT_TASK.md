# CURRENT TASK

Tracks what's actively in flight so Claude Code and Codex don't silently
duplicate or conflict. Update this file as part of whatever change picks a
task up or finishes it — don't let it go stale.

## Active

_Nothing in progress right now._

## Recently completed

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
  column (완료 only), Calendar Quick Add (in-month cells), completion
  checkboxes (calendar + list), task edit/delete/date-change, no bulk
  selection for Planner, no generation on task click, Planner Excel
  Template/Full Export (`Date | Task | 완료`) reusing the Stock Excel
  parser/builders via an optional `itemLabel` param.
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
