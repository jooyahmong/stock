# WORKFLOW

## Setup & run

```bash
npm install
npm run dev          # http://localhost:5173 (Vite picks another port if busy)
npm run build         # tsc -b && vite build — the exact check that must pass before any push
npm run preview        # serve the production build locally
```

## Tests

See `docs/TESTING.md` for what each suite covers and how to read results.
Quick commands:

```bash
npm run test           # vitest run — unit/domain tests, no server needed
npm run test:watch      # vitest watch mode
node e2e/smoke.mjs      # Playwright E2E — requires `npm run dev` running in another terminal
```

Before treating any change as done: `npm run build` (tsc + vite build must be
clean) and `npm run test` must pass. Run `node e2e/smoke.mjs` for anything
touching UI behavior, the calendar, Excel import/export, or the generation
click flow.

## Environment variables

Copy `.env.example` to `.env` to override anything. Currently one flag:

```bash
# Default OFF. Turn on to surface the Direct Generate UI (paid image-gen APIs).
VITE_DIRECT_GENERATION=true
```

Set the same variable in Cloudflare Pages' project settings to change the
deployed behavior — see `docs/specs/generation.md`.

## Git & deploy

- Cloudflare Pages auto-deploys `main`. **Pushing to `main` is the deploy
  step** — there is no separate manual deploy/build trigger to run.
- Standard hygiene: new commits (don't amend published history), run
  build + unit tests before committing, run the relevant e2e scenarios before
  pushing anything UI-facing.
- Don't push or deploy as a side effect of an unrelated task — only when the
  work is actually meant to ship.

## When you change behavior

1. Update the code.
2. Update the matching `docs/specs/*.md` (and `docs/UI_RULES.md` /
   `docs/DATA_MODEL.md` if the change touches an invariant or the schema).
3. Update or add tests (unit for domain logic, e2e for user-visible flows).
4. If the change reverses or overrides an earlier decision, add an entry to
   `docs/DECISIONS.md` instead of just editing the old one away silently —
   the history of *why* is as useful as the current state.

## Working with two agents (Claude Code + Codex) in this repo

- `docs/` is shared and authoritative for both. Don't write
  Claude-only or Codex-only explanations — if it's project knowledge, it goes
  in `docs/`.
- Before starting non-trivial work, check `docs/CURRENT_TASK.md` for what's
  already in flight so two agents don't silently duplicate or conflict.
- If you finish or change the status of the task in `docs/CURRENT_TASK.md`,
  update that file as part of the same change.
