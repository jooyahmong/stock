# TESTING

## Suites

| Suite | Command | Needs a server? | What it covers |
| --- | --- | --- | --- |
| Unit (Vitest) | `npm run test` | No | `src/domain/*` pure logic, `src/generation/*` providers/service, `buildDefaultStockPlan`, `gptUrl` validation |
| E2E (Playwright, headless Chromium) | `node e2e/smoke.mjs` | Yes — `npm run dev` in another terminal | Full browser flows: seeding, list window, selection vs. status, Excel Template/Import/Export round-trip, generation-site click flow, Direct Generate (only when the feature flag is on), Calendar view, mobile viewport |

**Do not hardcode pass/fail counts in prose docs** (this file included) — they
drift as tests are added. Run the commands above for the current numbers.
As of the last doc sync: `npm run test` reported **118 passing tests across
13 files**; `e2e/smoke.mjs` declares **36 scenarios** (a subset — currently 7
— auto-skip when `VITE_DIRECT_GENERATION` is off, which is the default). Trust
a fresh run over this note.

## Unit test coverage by area

- `domain/periods` — period parsing/validation/formatting per plan kind,
  including the SheetJS `Date` drift-snapping fix (`normalizePeriod`) and
  `periodNoun`.
- `domain/excel` — Import upsert matching, unchecked-value propagation,
  mirror-delete candidate detection, Template status-column generation,
  Full Export round-trip, and an explicit assertion that no credential-shaped
  string ever appears in an export.
- `domain/grouping`, `domain/calendar` (month grid math, weekday offset, leap
  February, the `genMark` O/X rule), `domain/statusColumns`,
  `domain/imageStyles`, `domain/__tests__/listWindow` (list-window slicing).
- `lib/gptUrl` — generation-site URL allow-list validation.
- `generation/*` — `generationConfig`, `directGenerationService`,
  `openaiImageProvider`, `googleImageProvider` (all pure/mocked, no live API
  calls; see `e2e/real-openai-check.mjs` for the manual, cost-incurring,
  opt-in real-API check — not part of CI).
- `data/defaultStockKeywords/buildDefaultStockPlan` — the seed-pack generator:
  365-day continuity, 2 keywords/day, 730 total rows, no duplicate rows on a
  date, determinism, (month, day) looping, specific event placements
  (Valentine, Christmas, Halloween, New Year lead times), moving-event actual
  dates, word-phrase (not sentence) keywords, brand-name exclusion, and
  correct counts across a leap-year window.

## E2E coverage by area

Driven against a real dev server in headless Chromium
(`e2e/smoke.mjs`, single-file harness with its own `test()`/`testIf()`
wrapper — `testIf(DIRECT_ON, ...)` auto-skips Direct-Generate-only scenarios
when the feature flag is off, printed as `– name (skipped: Direct Generate
off)` rather than failing).

- Default seed pack rendering and the list window / month picker.
- Work-status persistence across reload (IndexedDB), selection independence
  from status, no selection checkbox on date-group headers, "전체 선택"
  scoped to visible rows.
- Adding keywords/status columns; Settings → 저장·백업 (no sync UI, Excel
  actions present).
- Excel: Full Export content (repeated dates, TRUE/FALSE), Template header +
  FALSE defaults, re-importing a Full Export produces **zero** new rows (the
  regression test for the duplicate-on-reimport bug — see
  `docs/DECISIONS.md`), Import preview/commit with mixed valid/invalid rows.
- Generation-site click flow: new tab per click, clipboard copy, URL
  allow-list enforcement, "no generator configured" warning, the 생성
  사이트 열기 toolbar button.
- Direct Generate (flag on only): mode-specific settings visibility, fallback
  modal when no provider is configured, success → image + auto-checked 생성
  + persistence, failure → not checked + retry affordance, Google/Gemini
  provider mocked end-to-end.
- Calendar: month grid rendering, O/X rules (past vs. today/future, and that
  checking 생성 shows `○` immediately regardless of date), long-keyword
  ellipsis, day overflow (`+N개` → detail modal), reusing the exact same
  `onRun` handler as the list view, month navigation + "오늘", mobile agenda
  layout with no horizontal overflow.
- Footer 사용법 modal: GPTs guidance text and the sample-media placeholder.

## Manual checks (not automated)

- Tablet-width layout.
- Desktop alignment with 6–7 status columns visible.
- The toast shown when a browser blocks the generation-site popup.

## Adding a test

- Pure logic → unit test next to the module in `src/**/__tests__/`.
- Anything a user can click/see → add or extend a scenario in
  `e2e/smoke.mjs`, reusing the existing `boot()`/`newPlan()`/
  `addKeywordOnDate()` helpers rather than duplicating setup.
- If a fix corrects a real bug a user hit, add a regression test that would
  have caught it (see the Full Export re-import test above as the pattern).
