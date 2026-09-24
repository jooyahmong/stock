# SPEC — General Planner / Diary / To-do

Status: **PLANNED — not scoped, not started.** Registered as `READY` (queued,
not designed) in `docs/CURRENT_TASK.md`. This file is intentionally thin: it
exists so the intent isn't lost, not as an implementation guide. Do not build
against this document as if it were a real spec — resolve the open questions
below (with the user) and expand this file *before* writing code.

## Intent (as given)

Grow the product beyond the stock-keyword planner into a more general
planning surface: a **diary** and/or a **to-do** capability. No further
detail has been provided yet.

## Open questions (must be answered before implementation starts)

- **Data shape:** a new `Plan`-like entity inside the existing `Repository`
  model (`docs/DATA_MODEL.md`), or a separate storage shape entirely? If it
  reuses `Plan`/`KeywordItem`, does the "one row = one keyword, dates never
  merged" invariant (`docs/PROJECT.md`) even apply, or does this feature
  need its own rules?
- **Relationship to the stock planner:** a new section of the same app, a
  new selectable plan type, or a conceptually separate feature that happens
  to live in the same repo?
- **Diary vs. to-do vs. both:** same screen, same data model, or distinct
  features that happen to share a name?
- **Calendar reuse:** does this ride on the existing Calendar View
  (`docs/specs/calendar-view.md`), or does diary/to-do need its own?
- **Generation involvement:** any hook into 내 생성 사이트 / Direct Generate
  (`docs/specs/generation.md`), or is this pure planning data with no
  AI-generation angle at all?
- **Excel:** does Template/Import/Export (`docs/specs/excel.md`) extend to
  this, or is it out of scope?
- **Sync:** same deferred status as `docs/specs/sync.md`, or does this
  feature change the urgency of building sync?

## Non-goals until scoped

- No new `Repository` methods, entities, or UI surfaces for this feature
  should be added speculatively.
- No plan-type or navigation changes made "in preparation" for this — land
  them when the actual feature lands, scoped against real requirements.

## When this gets picked up

1. Answer the open questions above (with the user).
2. Rewrite this file as an actual spec (data model, UI, interaction rules) —
   follow the shape of `docs/specs/stock-planner.md` as a template.
3. Update `docs/CURRENT_TASK.md` status from `READY` to `IN PROGRESS`.
4. Only then start implementation.
