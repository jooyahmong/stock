# SPEC — General Planner / Diary / To-do

Status: **IMPLEMENTED (V1)**. Confirmed and built as a `purpose` axis on the
existing `Plan` entity — not a separate app, not a new storage system. See
`docs/DECISIONS.md` for why it's shaped this way and `docs/CURRENT_TASK.md`
for what's still open.

## Core model: `purpose`, orthogonal to `type`

- `Plan.type` still only describes **date structure** (`'365'` in practice —
  see `docs/specs/stock-planner.md`).
- `Plan.purpose?: 'stock' | 'planner'` (`src/repo/types.ts`) describes **what
  the plan is for**. Optional for backward compatibility — a plan created
  before this field existed has no `purpose` in storage.
- **Always resolve purpose through `planPurpose(plan)`**
  (`src/domain/planPurpose.ts`), never read `plan.purpose` directly. Missing/
  legacy data resolves to `'stock'`. `isPlannerPlan(plan)` is the boolean
  shortcut.
- **A Planner "Task" is not a new entity.** It is a `KeywordItem` (the
  `.keyword` field holds the task text) with a single `StatusColumn` named
  **완료**. This is why Excel, Repository, and Calendar infrastructure all
  reuse unchanged — see "Shared infrastructure" below.

## Creating a plan

"+ 새 계획" (`PlanBar` → `NewPlanDialog`) asks for a name and a **purpose**
radio (no separate "date structure" choice — that's still always `'365'`):

- **Stock 제작** (default) — identical to today's stock plan creation.
- **일정 / 다이어리** — creates an empty Planner plan.

`DexieRepository.createPlan` seeds status columns from
`DEFAULT_STATUS_NAMES_BY_PURPOSE[purpose]`:

```
stock:   ['생성', '미캔']
planner: ['완료']
```

The 완료 column is seeded `isDefault: true`, exactly like 생성/미캔 — so
`StatusColumnsSettings` (unmodified, driven generically by `isDefault`)
automatically protects it from being hidden or deleted.

## Calendar Quick Add

Desktop grid (`CalendarDayCell`): a Planner cell can always be opened — even
with zero tasks — via the day number or a `+ 추가` hint shown when empty.
Opening a day shows `DayKeywordsModal`'s Planner branch: existing tasks (with
a completion checkbox) plus a Quick Add row (`pg-add`-styled input + Enter /
추가 button) that calls `repo.createKeyword({ planId, period: dayIso,
keyword: text })` — the same call the list view's "+ 할 일 추가" uses.

The completion checkbox in the **compact grid cell** (`PlannerTaskLine`) is
also directly clickable without opening the day modal — checking a task off
doesn't require a detour through the detail view (desktop: "확인/체크
가능" per the original request). Mobile keeps the compact 7-column grid
(count + neutral/blue dots, no red) and opens the same day modal for detail
+ Quick Add — no separate inline mobile panel was built; the modal serves
both viewports.

## Completion checkbox

Rendered by the **same `StatusCheckbox`** component list view already uses
for every status column — no Planner-specific checkbox component. □
unchecked / ☑ checked, `repo.setKeywordStatus` fires immediately on click,
which is the existing persistence path shared with every other status
column in the app. Nothing new to test here beyond "완료 behaves like any
other status column," which the existing status-check test coverage already
establishes generically.

## Selection checkbox is hidden for Planner (§6 — do not blur this)

Stock's `□ Keyword` bulk-selection checkbox and Planner's `□ Task` completion
checkbox look similar but **must never be the same control**:

- `Toolbar`'s "전체 선택" is not rendered when `hideSelection` is true
  (`App.tsx` passes `hideSelection={isPlanner}`).
- `KeywordRow`'s `.select-box` is not rendered when `purpose === 'planner'`.
- Because nothing can ever populate `uiStore.selection` for a Planner plan,
  `SelectionBar` naturally never has anything to show (it already
  early-returns on empty selection) — no separate Planner branch needed
  there.

## Task click = edit, never generation

- List view (`KeywordRow`): for a Planner row, clicking the task text starts
  inline editing (the same input the ✎ button opens) instead of calling
  `onRun`. The row also gets a `<input type="date">` next to the text input
  while editing, so the date-change requirement below is met from the same
  interaction.
- Calendar (`PlannerTaskLine` / `DayKeywordsModal`'s Planner rows): clicking
  task text opens the day detail / inline rename — never `onRun`.
- **Defense in depth:** `App.tsx`'s `onRun` itself returns immediately when
  `isPlanner` is true, so even a future bug that wires a Planner row to
  `onRun` can't trigger Direct Generate or 내 생성 사이트.

## Task management

All via the existing `Repository` methods, no new ones:

- **추가**: `createKeyword` (list add-row or Calendar Quick Add).
- **수정** (text): `updateKeyword({ keyword })`, inline in `KeywordRow` / the
  day-modal's `PlannerDayTaskRow`.
- **삭제**: `deleteKeyword`, with a confirm dialog (Planner-flavored copy,
  no "체크 기록도 함께 삭제" wording since there's only ever one column).
- **날짜 변경**: `updateKeyword({ period })` via the `<input type="date">`
  shown alongside the text field while editing (list row and day-modal row
  both support this).
- **완료/미완료 변경**: `setKeywordStatus` on the 완료 column, as above.

## Calendar display rules — Stock's O/X is not reused

`genMark`'s ○/×/none rule is Stock-only. Planner never shows `×`:

- A task shows a **done** mark (`○`/☑, blue) the moment 완료 is checked —
  any date, past/today/future.
- An unchecked task shows a **neutral** mark (empty box `□`, or the grid's
  default gray dot) — never red, never treated as a "miss," regardless of
  whether the date has passed. There is no equivalent of Stock's × for
  Planner.
- Mobile dots reuse the existing `.mobile-cal-dot` component with only
  `'done' | 'none'` values passed in (never `'missing'`) — see
  `MobileCalendarDayCell`'s purpose branch.

## Day display (reused from Stock, unmodified rules)

Max 3 items per cell, `+N개` overflow into the day detail view, long text
single-line ellipsis with the full string in `title`, clicking `+N개` or the
day number opens the same detail view. All from the existing
`CalendarDayCell` constants/logic — Planner only swaps which line component
renders (`PlannerTaskLine` vs `CalendarKeywordLine`) and whether an empty
cell can still be opened.

## List view

```
SEP 24
☑ 로고 수정
□ 이메일 보내기
□ 운동하기
+ 할 일 추가

SEP 25
□ 병원 예약
+ 할 일 추가
```

This is the existing `PeriodGroup`/`KeywordRow` list, purpose-branched only
on: the add-row button label (`+ 할 일 추가` vs `+ 키워드 추가`), the empty
placeholder text (할 일 vs 키워드), and the two behaviors above (no
selection box, click = edit). Grouping, date windowing, search/filter, and
progress display are all shared and unmodified.

## Excel — Stock format is untouched

`domain/excel.ts` functions gained an optional `itemLabel: 'Keyword' |
'Task'` (default `'Keyword'`) and `buildFullExportWorkbook` an optional
`sheetName` (default `'Stock Plan'`) — every existing call site that omits
them behaves exactly as before (regression-tested, see `docs/TESTING.md`).

- **Planner Template**: `Date | Task` header + example rows, extended with
  any status columns (완료) at `FALSE`.
- **Planner Full Export**: `Date | Task | 완료`, sheet named `Planner`.

```
2027-09-24 | 로고 수정      | TRUE
2027-09-24 | 이메일 보내기  | FALSE
```

- **Import** matches the same upsert rule as Stock (`docs/specs/excel.md`) —
  `(period, task text)` identifies an existing row, unchecked/checked
  values overwrite in place, unmatched rows create new tasks. The only
  difference is which header text (`Task` vs `Keyword`, `ITEM_HEADER_
  ALIASES` in `domain/excel.ts`) is recognized as the item column.
- `lib/planExcel.ts` picks `itemLabel`/`sheetName`/filename
  (`planner-template.xlsx` vs `stock-template.xlsx`) from
  `planPurpose(plan)` — nothing plan-specific lives in `domain/excel.ts`
  itself.

## Storage — Local-first, unchanged

Planner plans live in the exact same `Repository` → `DexieRepository` →
IndexedDB path as Stock plans (`docs/ARCHITECTURE.md`). No new tables, no
new Dexie schema version — `purpose` is simply an extra (non-indexed) field
on the existing `plans` table. No login, no D1, no sync were added by this
feature; Planner data is exactly as local-only as Stock data and covered by
the same Excel Full Export backup path. See `docs/specs/sync.md` for the
(still not built) future multi-device story, which applies identically to
both purposes.

## Shared infrastructure (§14 — not a separate app)

Purpose changes **UI/behavior only**, never the underlying system:

| Shared, unmodified | Branches on `purpose` |
| --- | --- |
| `Plan` / `KeywordItem` / `StatusColumn` / `KeywordStatus` schema | Default seeded status column names |
| `Repository` interface + `DexieRepository` | `NewPlanDialog`'s purpose radio |
| `domain/grouping.ts`, `domain/periods.ts`, list-window logic | `Toolbar` (hide 전체 선택), `PeriodGroup`/`KeywordRow` (labels, click behavior, selection box) |
| Calendar month-grid math, day-cell layout, `+N개` overflow | `CalendarDayCell`/`MobileCalendarDayCell`/`DayKeywordsModal` (which line renderer, Quick Add, empty-cell openness) |
| `domain/excel.ts` parser/builders | `itemLabel`/`sheetName` params (still default to Stock's exact values) |
| Responsive breakpoint, mobile agenda/grid infrastructure | Which controls render at that breakpoint |

## Stock regression guardrails

None of the above should ever change for a plan whose `purpose` resolves to
`'stock'` (including every plan that predates this feature). The specific
behaviors protected — 2027 Stock Keywords / 730-row seed, Stock list, Stock
Calendar ○/×, 생성/미캔, custom status columns, 내 생성 사이트, GPT tab
behavior, Direct Generate, Stock Excel format, search/filter — are the ones
listed in `docs/DECISIONS.md` → "Stock plans" cluster and covered by the
pre-existing unit/E2E suites (`docs/TESTING.md`), all of which stayed green
through this feature's implementation.

## Explicitly not built in V1

Multi-device sync (shared with Stock, `docs/specs/sync.md`), drag-and-drop
task reordering/rescheduling, recurring tasks, reminders/notifications,
diary-specific free-text notes (only single-line task text exists today),
and any Excel/Calendar behavior beyond what's described above.
