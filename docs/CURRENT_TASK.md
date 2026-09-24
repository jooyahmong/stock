# CURRENT TASK

Tracks what's actively in flight so Claude Code and Codex don't silently
duplicate or conflict. Update this file as part of whatever change picks a
task up or finishes it — don't let it go stale.

## Active

_Nothing in progress right now._

## Recently completed

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
