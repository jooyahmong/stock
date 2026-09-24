# CLAUDE.md

This file is a thin entry point for Claude Code. It intentionally does not
duplicate project knowledge — **`docs/` is the single source of truth** for
this project, shared with Codex via `AGENTS.md`. Read the relevant doc below
before making changes; don't re-derive facts that already live there.

## Read first

| File | Answers |
| --- | --- |
| [`docs/PROJECT.md`](docs/PROJECT.md) | What this product is, for whom, and the non-negotiable principles |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Repository pattern, directory layout, how the future D1 backend slots in |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Entities, fields, `period` encoding, sync-readiness (`updatedAt`) |
| [`docs/UI_RULES.md`](docs/UI_RULES.md) | Interaction rules that must not regress (selection vs. status checks, no auto-send, etc.) |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Run/build/test commands, commit/deploy conventions, env vars |
| [`docs/TESTING.md`](docs/TESTING.md) | What's covered, how to run each suite, how to read results |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why things are the way they are — check before undoing something that looks odd |
| [`docs/CURRENT_TASK.md`](docs/CURRENT_TASK.md) | What's actively being worked on right now |
| `docs/specs/*.md` | Per-feature behavior specs (stock planner core, calendar, general planner, generation, Excel, sync) |

## Ground rules

- **`docs/` and code must agree.** If you change behavior, update the matching
  spec in the same piece of work. If you find docs and code disagree, trust
  the code and fix the doc — call it out to the user rather than silently
  picking one.
- **Don't invent parallel Claude-only documentation.** If something belongs in
  `docs/`, put it there so Codex sees it too. This file only points; it
  doesn't explain.
- Mark anything not yet built **FUTURE** or **PLANNED** in the docs — never
  describe an unimplemented feature as done.
- Repo-specific conventions (attribution lines, when to push, etc.) come from
  the harness/user instructions for this session, not from this file.
