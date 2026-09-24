# AGENTS.md

This file is a thin entry point for Codex (and any other agent working in
this repo). It intentionally does not duplicate project knowledge — **`docs/`
is the single source of truth**, shared with Claude Code via `CLAUDE.md`.
Both files point to the same docs on purpose; don't fork separate
Claude-flavored / Codex-flavored explanations of the same thing.

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

## Commands

See [`docs/WORKFLOW.md`](docs/WORKFLOW.md) for the full list. Quick reference:

```bash
npm install
npm run dev         # http://localhost:5173
npm run build        # tsc -b && vite build
npm run test         # vitest (unit)
node e2e/smoke.mjs   # Playwright E2E — needs `npm run dev` running in another terminal
```

## Ground rules

- **`docs/` and code must agree.** If you change behavior, update the matching
  spec in the same piece of work. If you find docs and code disagree, trust
  the code and fix the doc — call it out rather than silently picking one.
- **Don't invent parallel Codex-only documentation.** If something belongs in
  `docs/`, put it there so Claude Code sees it too.
- Mark anything not yet built **FUTURE** or **PLANNED** in the docs — never
  describe an unimplemented feature as done.
- This is a Vite + React + TypeScript app with no server backend yet
  (IndexedDB via Dexie, see `docs/ARCHITECTURE.md`). Don't add a backend,
  auth, or deploy step unless a doc or the user explicitly asks for it.
