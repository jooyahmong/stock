# CURRENT TASK

Tracks what's actively in flight so Claude Code and Codex don't silently
duplicate or conflict. Update this file as part of whatever change picks a
task up or finishes it — don't let it go stale.

## Active

_Nothing in progress right now._ This doc-structure setup itself is not a
product task and isn't tracked here.

## Ready (not started)

### General Planner / Diary / To-do support

- **Status:** `READY` — requested, not scoped in detail, **implementation
  has not started.**
- **What's known:** the product should grow beyond the stock-keyword planner
  into a more general planning surface — a diary and/or to-do capability.
  Beyond that name, no requirements, UX, or data-model shape have been
  defined yet.
- **What's not known / needs deciding before implementation starts:**
  - Is this a new `Plan`/entity type inside the existing `Repository` model,
    or a genuinely separate feature area with its own storage shape?
  - Relationship to the existing stock-keyword plan: separate section of the
    app, a new plan type, or something orthogonal to "plans" entirely?
  - Diary vs. to-do vs. both — same screen or different ones?
  - Does it reuse the existing Calendar view, or need its own?
  - Any generation-site / Direct Generate involvement, or is this pure
    planning data with no AI-generation hook?
  - Excel export/import expectations, if any.
  - Sync Mode interaction (see `docs/specs/sync.md`) — same deferred status?
- **Placeholder spec:** `docs/specs/general-planner.md` — intentionally thin
  until the above is scoped. Fill it in as decisions are made, before
  writing implementation code, not after.
- **Do not start implementation from this entry alone.** It exists so the
  intent isn't lost, not as a green light. Get the open questions above
  answered (with the user, or via an explicit follow-up scoping request)
  first.

## Backlog (not ready, no doc yet)

See `docs/PROJECT.md` → "Phase 2 candidates" style items are tracked
informally in `README.md`'s history; promote anything that gets picked up to
a `docs/specs/*.md` file and list it here as `READY` when it is.
