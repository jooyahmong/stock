# SPEC — Excel (Template / Import / Full Export)

Status: **IMPLEMENTED**. Logic in `src/domain/excel.ts` (pure, no DB/React),
wired up in `src/lib/planExcel.ts` and `src/components/ImportPreviewModal.tsx`.

## Shared shape

All three operations use the same column layout:

```
<Date|Week|Month>  |  Keyword  |  <status column 1>  |  <status column 2>  | ...
```

- The first column's header/meaning depends on plan kind
  (`periodColumnLabel`): `Date` for date plans, `Week` / `Month` for the
  (currently UI-unreachable) other kinds.
- Status columns are `TRUE`/`FALSE` text values, one column per
  `StatusColumn` (all of them, including hidden ones, so a file round-trips
  fully).
- Same date/period repeats across multiple rows — never merged, matching the
  in-app rule.
- **Never contains any credential.** No API key, no Direct Generate secret,
  ever appears in a generated file — this is asserted by a unit test
  (`docs/TESTING.md`).

## Template

`buildTemplateWorkbook(kind, statusColumns)` — a single sheet matching the
**active plan's kind**, header + 3 example rows, status columns defaulted to
`FALSE`. (An earlier "one file, three tabs — Date/Week/Month, auto-picked by
plan kind on import" design was built and then reverted along with the
weekly/monthly plan-type UI removal — see `docs/DECISIONS.md`. The
multi-kind machinery (`buildTemplateWorkbookAllKinds`, tab auto-pick) no
longer exists in the codebase; don't assume it does.)

## Import — upsert, not append

`parseImportFile` reads the **first sheet only**. Required columns: the
period column (aliased by kind, e.g. `Date`/`날짜`/`Day`) and `Keyword`.
Extra columns are matched to existing `StatusColumn`s by case-insensitive
name; unmatched columns are reported as ignored, not errors.

Per row:
- Empty keyword or fully blank row → silently skipped (counted separately,
  not an error).
- Missing/invalid period value → counted as an error; the row is skipped,
  everything else in the file still processes (never aborts the whole
  import).
- Date cells: SheetJS `cellDates` gives `Date` objects for real date-typed
  cells; these are snapped to the nearest local midnight before formatting,
  because SheetJS can return e.g. `2026-12-31T23:59:59` for what should read
  as `2027-01-01` — see `docs/DECISIONS.md` for why this matters (it used to
  silently break duplicate matching). `.` and `/` separators and single-digit
  month/day are also accepted for text-typed date cells.

**Matching (the important part):** every row's `(period, keyword)` is matched
1:1, greedily, against existing keywords in the target plan with the same
`(period, keyword)`:

- **Matched** → the row is an *update*: every recognized status column on
  that row overwrites the existing keyword's check value, **including
  unchecking something that was checked**. The keyword text/date are not
  changed by a match (only status values).
- **Unmatched** → the row creates a new `KeywordItem`, with any `TRUE`
  status columns applied.
- If the file has more copies of a given `(period, keyword)` than the plan
  does, the extras become new rows (not silently merged/deduped away).

This means re-importing an edited Full Export **does not duplicate
anything** — it's the regression case the upsert design specifically fixes
(`docs/DECISIONS.md`, `docs/TESTING.md`).

Preview UI shows: 새로 추가 (will create) / 기존 갱신 (will update) /
파일에 없는 기존 항목 (existing keywords the file doesn't mention, only
shown when non-zero) / 오류 / 빈 행 무시.

**Mirror option** — "파일과 완전히 일치시키기" checkbox, **off by default**:
when on, existing keywords not present in the file are deleted after the
import, making the plan match the file exactly. Intended for "I edited a
full export and want the plan to become exactly that file," not for partial
imports (which would otherwise delete everything not in the partial file).

## Full Export

`buildFullExportWorkbook` — every `KeywordItem` in the plan, sorted by
period then `sortOrder`, with every `StatusColumn`'s `TRUE`/`FALSE` value.
This is the app's **official backup/restore mechanism** (see
`docs/DATA_MODEL.md` and `docs/specs/sync.md` — it's also the universal
fallback recovery path even after Sync Mode exists).

## Known risk

`xlsx@0.18.5` (the latest available on npm) has open security advisories.
Accepted for now as a local-only, single-user tool; the parser surface is
fully isolated to `src/domain/excel.ts` for an eventual library swap. See
`docs/ARCHITECTURE.md`.
