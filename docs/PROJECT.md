# PROJECT

## What this is

**WOOJOO Stock Planner** (`stock.woojooland.com`) — a Stock Content Planner +
Production Tracker. It manages a year of date-based stock-image keywords,
tracks per-keyword production status (생성/미캔 + custom checks), and links
out to whatever AI image-generation site the user already uses (ChatGPT,
Gemini, Midjourney, or a custom HTTPS link). **It is not an AI image
generation site** — it never auto-sends a prompt or auto-generates an image
on the user's behalf by default (Direct Generate is an optional, currently
disabled, exception — see `docs/specs/generation.md`).

Built for one person's real stock-contributor workflow first (personal tool),
with the architecture kept clean enough to open up later (multi-device sync,
more generation providers, other planner types).

Live: https://stock.woojooland.com/ . Deploys automatically from `main` via
Cloudflare Pages — there is no manual deploy step.

## Who it's for

A solo (or small) stock-image contributor who:
- Plans keywords months ahead of the date they'll actually be sold/used.
- Wants a simple per-keyword checklist (생성 = generated, 미캔 = uploaded to
  미리캔버스/marketplace, plus whatever custom steps they add).
- Generates images themselves, by hand, in ChatGPT/Gemini/Midjourney/a custom
  GPT — the app's job is to get the right prompt into the right tab, not to
  generate on their behalf.
- Wants their data to stay local and exportable (Excel), not locked into a
  server account.

## Non-negotiable principles

These are implemented today and should not be silently changed — if a change
requires breaking one, say so explicitly and update `docs/DECISIONS.md`.

| Principle | Where it lives |
| --- | --- |
| One row = one keyword. Dates are never merged. | `KeywordItem` — see `docs/DATA_MODEL.md` |
| The same date can repeat across multiple keyword rows. | `period` string, no uniqueness constraint |
| Date grouping is a *display* concern only. | `src/domain/grouping.ts` — grouping never mutates stored data |
| Selection checkbox (bulk actions) ≠ work-status checkbox (생성/미캔/…). | Selection lives in `uiStore` (volatile); status lives in `KeywordStatus` (persisted) |
| Default work statuses are 생성 / 미캔. | Seeded per plan; can be renamed/reordered but not hidden or deleted |
| Unlimited custom status columns. | `StatusColumn` + `KeywordStatus`, decoupled schema |
| Excel Full Export is also one row per keyword. | `src/domain/excel.ts` — same repeat-date rule as the DB |
| Clicking a keyword copies the prompt and opens the generation site in a new tab — it never auto-sends. | `src/hooks/useRunKeyword.ts`, `src/lib/clipboard.ts` |
| No login, no server account, no data leaves the browser (Local Mode). | See `docs/DATA_MODEL.md` → Storage / Local Mode |

## Product surface today (V1)

- One date-based plan type (`365`). Weekly/monthly/"custom" plan types exist
  in the type system and are documented, but their UI has been removed — see
  `docs/DECISIONS.md`.
- Calendar view (default) and list view, both reading the same data.
- Per-keyword generation-site linking ("내 생성 사이트": ChatGPT / Gemini /
  Midjourney presets + custom HTTPS links) with prompt copy + image-style
  presets.
- Direct Generate (an in-app "call the API and show the image" mode) exists in
  code but is **disabled by default** — it costs money per call and every
  provider requires a paid key. See `docs/specs/generation.md`.
- Excel Template / Import (upsert) / Full Export, all in one file structure.
- Local-only storage (IndexedDB via Dexie). Multi-device Sync is designed but
  **not implemented** — see `docs/specs/sync.md`.

## Roadmap signal (not started)

A **General Planner / Diary / To-do** feature area has been requested and is
registered as `READY` (not started) in `docs/CURRENT_TASK.md` and sketched in
`docs/specs/general-planner.md`. Do not begin implementing it without an
explicit go-ahead — the spec there is intentionally thin until scoped.
