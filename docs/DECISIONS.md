# DECISIONS

A log of decisions that aren't obvious from reading the code alone — mostly
"why is it like this and not the more obvious way." Newest first within each
group. Exact dates/authorship are in `git log`; this file captures the
reasoning that commit messages alone don't carry.

## Seeding

- **Default pack renamed "365 스톡 키워드" → "2027 Stock Keywords".** Purely
  cosmetic — no behavior tied to the string. Kept as one fixed name rather
  than year-parametrized because a shifting name would break the
  `alreadyExists` name-match in `ensureDefaultPack` (below) across a
  calendar-year boundary and isn't worth the complexity for a personal tool.
- **A stale-plan production bug led to an additive-only second seed pass,
  not a "clean up legacy data" one.** `stock.woojooland.com` showed Plans
  named "365 재구성" / "데일리 작업" instead of the expected default pack.
  Audited `git log -p` on `seed.ts` and the full working tree: **those names
  have never existed in this codebase, at any point in its history.** They
  aren't identifiable dev/sample data — they were almost certainly created
  through the ordinary "+ 새 계획" UI (by real use of the live site). Given
  that, deleting them would risk destroying real work under the banner of
  "cleanup," which the data-safety principle in `docs/PROJECT.md` (no login,
  local-only, the user's data is the user's) rules out.
  - The actual root cause was structural, not data-related: `runSeedOnce`
    permanently disables itself (writes its marker) the moment it observes
    *any* existing Plan on a production browser, by design — see "Production
    with existing data: untouched" in `docs/specs/stock-planner.md`. A
    browser that had so much as one Plan before the default pack existed
    would never get it, no matter how many times the seed version was
    bumped.
  - Fix: `ensureDefaultPack`, a second pass with its **own** marker
    (`seed:defaultPack`) that only ever *adds* — it checks whether a Plan
    named exactly `"2027 Stock Keywords"` (purpose `stock`) exists and
    creates one if not, **never reading further into, modifying, or
    deleting any other Plan**, regardless of its name or purpose. This also
    means General Planner Plans (`purpose: 'planner'`) are safe by
    construction — there's no code path that could touch them, not a
    special case that has to remember to skip them.
  - If a future audit *can* positively identify specific data as this app's
    own dev/sample output (e.g. a Plan name string that still exists in
    `seed.ts`'s history and nowhere else), a targeted, code-referenced
    cleanup is reasonable. Deleting data whose origin can't be proven from
    code is not — see `docs/specs/stock-planner.md` → "Default pack,
    additively" for what actually shipped instead.

## Storage & sync

- **Repository interface over a direct Firebase/vendor SDK.** V1 uses
  IndexedDB (`DexieRepository`) purely because the planned production backend
  is **Cloudflare D1**, not Firebase. All storage access is behind
  `Repository` (`src/repo/types.ts`) so the eventual backend swap is one line
  in `main.tsx`. See `docs/ARCHITECTURE.md`.
- **Sync Mode designed but not built, and deliberately email-free.** The
  original idea (email + a 4–8 digit PIN, "log in with just that later") was
  rejected: an unverified email + a short PIN is brute-forceable, and adding
  password-reset-by-email is most of the work of real signup anyway. The
  chosen design instead shows a long random token/link **on screen** when
  sync is turned on — no email service, no password, no OAuth. Recovery
  story: a logged-in device can re-show the link; if every device is lost,
  Excel Full Export is the fallback (already built, always available). See
  `docs/specs/sync.md`. **Not implemented** — UI and backend both to come
  later, on request.
- **`__wipeAllData()` is exposed in production, not just dev.** It was
  originally a dev-only console helper, but the 데이터 처리 안내 (data
  handling) modal tells *all* users to run it to delete their data — so it
  has to actually exist outside dev builds for that claim to be true.

## Plan types

- **Weekly/monthly/custom plan creation removed from the UI; only `'365'`
  (date-based) plans can be created.** Two compounding reasons: (1) mixing
  date-shaped data into a workflow built around a 365-day calendar produced
  repeated Excel import errors when users pasted date rows into
  weekly/monthly sheets or vice versa; (2) with only one reachable type, the
  type picker and the per-plan type badge were pure clutter. The `PlanType`
  union, `periodKind`, `normalizePeriod`, and `buildTemplateWorkbook(kind)`
  all still support the other kinds — re-enabling is adding options back to
  `PlanBar`'s `NewPlanDialog`, not a rewrite. Existing plans of other types
  (if any) still render normally.
- Before landing on "remove entirely," a one-file-three-tabs Excel Template
  (Date/Week/Month tabs, import auto-picking the tab matching the active
  plan's kind) was built as a middle ground. It was reverted along with the
  type picker once weekly/monthly were cut from plan creation — a single
  date-only Template sheet is simpler and the multi-kind machinery would
  have been dead weight.
- **Calendar view is the default main screen**, list view is the alternative
  (was originally the other way around). See `src/lib/viewModePref.ts`.

## Excel import

- **Import is an upsert (match-and-update), not append-only.** The original
  behavior appended every row as new, with an opt-out "skip duplicates"
  checkbox. A user who edited an exported file and re-imported it got every
  row duplicated. Root cause: `normalizePeriod`'s handling of SheetJS `Date`
  cells didn't snap sub-second drift (Excel commonly re-saves a plain
  `2027-01-01` text date as a real date cell, and SheetJS can read that back
  as `2026-12-31T23:59:59`), so the "does this already exist" match silently
  failed for every row. Fixed by (a) snapping `Date` cells to the nearest
  local midnight before comparing, and (b) redesigning Import to match
  existing rows by `(period, keyword)` and **overwrite their check values**
  (including un-checking something that was checked), only creating rows for
  combinations that don't already exist. An explicit "파일과 완전히
  일치시키기" (mirror) opt-in also deletes rows the file no longer lists —
  off by default, since most imports are partial edits, not full mirrors.
  See `docs/specs/excel.md` and the regression test noted in
  `docs/TESTING.md`.

## Generation (Direct Generate vs. linking to an external site)

- **Direct Generate defaults to off.** Every provider evaluated (OpenAI
  Images, Google Gemini/Imagen) requires a paid, billing-enabled key —
  Google's free tier specifically returns HTTP 429 with
  `generate_content_free_tier_requests` limit **0** for image models (not "used
  up," never allocated). Rather than ship a feature that always errors for
  free-tier users, the whole `src/generation/` UI is hidden behind
  `VITE_DIRECT_GENERATION` (default unset = off). The code and its tests are
  kept intact and the layer stays fully decoupled from `domain`/`repo` so it
  can be deleted outright or re-enabled without a rewrite.
- Google's `GoogleImageProvider` doesn't hardcode a "the" model id — model
  names there churn quickly. Instead it calls `ListModels` and reports back
  which image-capable models the given key can actually use, both on a
  successful connection test and inside a 404 error message.
- **"내 생성 사이트" (linking out) is the only enabled generation path
  today.** Fixed presets for ChatGPT/Gemini/Midjourney plus arbitrary custom
  HTTPS links; keyword click always opens a **new tab** per click (an
  earlier tab-reuse attempt was abandoned — ChatGPT sends
  `Cross-Origin-Opener-Policy: same-origin`, which severs the opener
  reference and named-window targeting on load, making reuse technically
  impossible; given low daily click volume, "just open a new tab every
  time" was accepted as the simplest correct behavior).
- The default generation site starts **unselected** after first launch (and
  after this UI's most recent update) — clicking a keyword before the user
  picks one routes them to Settings instead of silently picking something on
  their behalf.
- Image-style presets (2D flat, 3D, line icon, isometric, watercolor,
  hand-drawn, paper-cut, clay, retro poster, minimal silhouette) are appended
  to the copied prompt; stored in `Repository` app settings
  (`generator:imageStyles:v1`), excluded from Excel export.

## Calendar

- **O/X rule: checking 생성 shows `○` immediately, regardless of date.**
  Earlier behavior only marked past dates at all (today/future keywords
  never showed anything, even if checked) — the reasoning ("don't call an
  unfinished day a miss") was sound for `×` but wrongly also suppressed `○`
  for work already done ahead of schedule. Fixed so `generated === true` is
  always `'done'`; only the "not generated" branch still depends on whether
  the date has passed. See `src/domain/calendar.ts` (`genMark`) and
  `docs/UI_RULES.md`.
- Calendar `○`/`×` marks were widened to a bold outlined glyph (`-webkit-
  text-stroke`, blue for done / red for missing) because the default
  small/thin marks were hard to notice at a glance.
- Mobile calendar keeps the 7-column month grid (not an agenda-only fallback)
  with compact per-day summaries, tapping into a full-day modal — chosen over
  a plain list so the calendar's actual month shape stays visible on phones.

## UI cleanup

- **`btn-danger:hover` fixed** — the generic `.btn:hover` rule set a light
  background but `.btn-danger` never overrode the text color, so "영구
  삭제"-style buttons went white-text-on-light-background (invisible) on
  hover.
- **Template (blank Excel starter) was removed, then restored.** First
  removed on request; restored once it became clear weekly/monthly plan
  types (before their UI was cut — see "Plan types" above) had no seed data
  and genuinely needed a starter file. It now ships as a single sheet
  matching the active plan's kind and status columns.
- A brief in-app usage guide (사용법 footer link → modal) was added, later
  reworked into a fixed-size two-tab dialog (사용 방법 / 이용 안내) covering
  GPTs account requirements (Plus-tier only, not shareable) and
  responsibility/liability framing for using third-party AI sites through
  this tool. An earlier version embedded a sample video placeholder and a
  literal sample GPT instruction string; both were removed in a later pass
  in favor of the more general 이용 안내 tab — check `e2e/smoke.mjs` and
  `docs/UI_RULES.md` before re-adding either.

## Accepted risk / deferred

- `xlsx@0.18.5` has known advisories (prototype pollution / ReDoS). Accepted
  for now given this is a local-only tool with no server-side parsing;
  isolated to `src/domain/excel.ts` for an eventual swap.
- Bundle size (~700KB gzip, mostly `xlsx`) — not addressed; lazy-loading the
  library behind Import/Export is a known, not-yet-done improvement.
