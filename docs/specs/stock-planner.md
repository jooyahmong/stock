# SPEC — Stock Planner core

Status: **IMPLEMENTED**. This is the core product: a date-based keyword
tracker with per-keyword status checks. See `docs/DATA_MODEL.md` for the
schema this spec assumes.

## Plan

- One or more `Plan` rows, each holding its own `KeywordItem`/`StatusColumn`
  set.
- **Only date-based (`type: '365'`) plans are creatable from the UI.** The
  "새 계획" dialog takes just a name; there is no type picker and no type
  badge anywhere in the UI. `weekly` / `monthly` / `custom` remain valid
  `PlanType` values and their supporting pure functions
  (`periodKind`, `normalizePeriod`, `buildTemplateWorkbook`) still work, but
  nothing in the UI can create them. See `docs/DECISIONS.md` for why.
- If more than one plan exists, a `<select>` (name only) switches between
  them; with exactly one plan, its name is shown plainly.

## Keyword rows

- One row = one `KeywordItem`, always. Never merge same-date rows for
  display or storage.
- The same `(period, keyword)` pair may repeat any number of times — this is
  valid data, not a duplicate bug.
- Keywords can be added to any date (`+ 날짜 추가` creates an otherwise-empty
  date group first if needed, then `+ 키워드 추가` inside it), edited, moved
  to a different date, or deleted freely.

## Work status

- Every plan seeds two `StatusColumn`s: **생성** and **미캔**, both
  `isDefault: true` — they can be renamed and reordered but never hidden or
  deleted.
- Unlimited custom status columns can be added, reordered (↑/↓ buttons; drag
  handles are currently visual only — reordering by drag is not implemented),
  shown/hidden.
- A status checkbox (`KeywordStatus.checked`) is fully independent of the
  **selection** checkbox used for bulk actions (`src/store/uiStore.ts`,
  volatile, not persisted). See `docs/UI_RULES.md`.
- The 생성 column specifically is what the Calendar view's O/X marks and
  Direct Generate's auto-check both key off of — found via
  `src/domain/statusColumns.ts`, not hardcoded by name in multiple places.

## List view / date window

- The date-plan list view is anchored to a month picker (shared with
  Calendar — see `docs/specs/calendar-view.md`). Selecting a month shows
  every date in that month, upcoming dates above today, past dates below
  (most-recent-past first, from the start of the month). There is no
  "load more" / "show all 365" control for date plans anymore.
- Weekly/monthly plans (unreachable from the UI today, but still supported
  by the underlying functions) keep the older windowed list + search
  behavior instead, since they have no calendar.
- "Today" for window/anchor purposes refreshes automatically (~30s poll, and
  immediately on tab focus) so a plan left open overnight doesn't show a
  stale anchor.

## Default seed pack — rolling 365 days

A brand-new install seeds one plan, **"2027 Stock Keywords"**, automatically
on first run (`src/repo/dexie/seed.ts`, marker `seed:marker =
rolling-365-v2`; `src/data/defaultStockKeywords/`). The name is fixed text,
not year-parametrized — it says "2027" because that's the year most of a
pack seeded "today" actually displays, not because `buildDefaultStockPlan`
takes a year (it takes a `startIso` date string).

- **Empty DB (any build):** creates the seed plan.
- **Dev-only reset** (`import.meta.env.DEV`): if stale dev sample data from
  an older seed marker is found, wipes all tables and reseeds. **Never runs
  in a production build** — a real user's data is never touched by bumping
  the seed version.
- **Production with existing data:** untouched by this marker, no matter the
  seed version — see "Default pack, additively" below for the *separate*
  mechanism that still gets these browsers the pack.
- Start date = local "today" at seeding time; 365 consecutive days, **2
  keywords/day, 730 rows total**, never merged.
- Display date = *production date*; it targets roughly 61 days
  (~2 months) ahead — the premise being an image made today sells about two
  months later.
- Filler content loops by **(month, day)** ordinal, independent of year — the
  same (month, day) always gets the same filler keyword across years
  (verified by a determinism test comparing two builds with different start
  years but the same (month, day) set).
- Named events (Valentine's, Christmas, Halloween, New Year, and moving
  events like Easter/Thanksgiving/Mother's & Father's Day/Lunar New Year)
  override that day's two filler slots at their computed production date,
  taking real calendar math into account for moving events (so lead time
  drifts ±1–2 days year to year, same as the real event does).
- A seeding window that spans a year boundary (e.g. December production for
  next Valentine's, or November production for next New Year) is handled
  correctly — always exactly 365 days / 730 rows, leap-year Feb 29 included.
- Keywords are short **Korean noun phrases** (2–6 words), not full sentences;
  no duplicate keyword text within the pack; no brand/celebrity names. A
  shared pool rotates per category, with framing qualifiers (close-up,
  flat-lay, etc.) only added after the pool has cycled once (~30% of rows).
- All status columns start unchecked (seeding never writes `KeywordStatus`
  rows).
- Once seeded, rows behave exactly like any other keyword — fully editable.

## Default pack, additively (`ensureDefaultPack`, `seed:defaultPack` marker)

A separate, **purely additive** pass in `src/repo/dexie/seed.ts` runs after
the above on every load. It exists for browsers that already had a Plan
(of any kind — including one not created by this app's seeding, e.g. one
made through the normal "새 계획" UI) before this pack existed — those
browsers permanently skip the main seed path (see "Production with existing
data" above), so without this second pass they'd never get the default pack
at all. This is exactly what was observed on `stock.woojooland.com`
(see `docs/DECISIONS.md`).

- Marker: `seed:defaultPack = stock-default-pack:2027:v1`, independent of
  `seed:marker`.
- If a Plan named exactly `"2027 Stock Keywords"` with `purpose: 'stock'`
  already exists, does nothing (belt-and-suspenders alongside the marker).
- Otherwise creates it (same `createDefaultPlan` used by the main path),
  **without reading, modifying, or deleting any other Plan.** It does not
  force-activate the new plan (`AppSetting['ui:activePlanId']`) — `main.tsx`
  doesn't wait for seeding before rendering, so the plan-selection effect in
  `App.tsx` can already have locked onto an existing plan by the time this
  finishes, and a late write there wouldn't be picked up (that effect only
  re-evaluates while no valid `activePlanId` is set yet). The new plan
  becomes selectable from the plan dropdown; it isn't forced open.
- **There is no logic anywhere that deletes a Plan it cannot positively
  identify as this app's own seed output.** If a browser has unrelated
  Plans, they are left exactly as they were, forever.

## Explicitly out of scope for this spec

- Generation (linking out / Direct Generate) — `docs/specs/generation.md`.
- Excel import/export/template — `docs/specs/excel.md`.
- Multi-device sync — `docs/specs/sync.md` (not built).
- General planner / diary / to-do — `docs/specs/general-planner.md` (not
  started).
