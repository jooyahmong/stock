# DATA MODEL

Source of truth: `src/repo/types.ts`. If this doc and that file disagree,
the file is right — fix this doc.

## Entities

```
Plan          { id, workspaceId, name, type, createdAt, updatedAt }
KeywordItem   { id, workspaceId, planId, period, keyword, sortOrder, createdAt, updatedAt }
StatusColumn  { id, workspaceId, planId, name, order, isVisible, isDefault, createdAt, updatedAt? }
KeywordStatus { id, workspaceId, keywordItemId, statusColumnId, checked, updatedAt }
Generator     { id, workspaceId, name, url, isDefault, createdAt, updatedAt? }
AppSetting    { key, value }   // active plan, list window state, empty-period list, image styles, etc.
```

- `PlanType = '365' | 'weekly' | 'monthly' | 'custom'`. **Only `'365'` is
  reachable from the UI today** — see `docs/DECISIONS.md`. The other values
  still exist in the type and in `periods.ts` so old data renders and the
  types can be re-enabled later without a schema change.
- `period` is interpreted per plan type: `'365' | 'custom'` → `'YYYY-MM-DD'`,
  `'weekly'` → `'YYYY-Www'`, `'monthly'` → `'YYYY-MM'`.
- Every mutable row carries `updatedAt`. This is unused today but is the
  intended basis for a future Sync Mode's Last-Modified-Wins conflict policy
  (`docs/specs/sync.md`) — don't remove it as "dead" data.
- `workspaceId` is always `LOCAL_WORKSPACE_ID` ("local") today. A future
  account/workspace id replaces it without a schema change — see
  `docs/ARCHITECTURE.md`.
- `PlanSnapshot { plan, keywords, statusColumns, statusMap }` is the one
  fetch a screen needs; `statusMap` is keyed `` `${keywordItemId}:${statusColumnId}` ``
  → `checked`, with an absent key meaning unchecked.

## Repository surface

`Repository` (`src/repo/types.ts`) exposes: `subscribe`, plan CRUD +
`getPlanSnapshot`, keyword CRUD (+ bulk `createKeywords` for Excel import),
status-column CRUD + `reorderStatusColumns`, `setKeywordStatus` /
`setKeywordStatusBulk`, generator CRUD, and a generic `getSetting`/`setSetting`
key-value bag. This is the entire storage contract — anything new that needs
persistence should be added here, not bolted onto Dexie directly.

## Invariants

- One row = one keyword. Never merge same-date rows, in the DB or in Excel.
- The same `(period, keyword)` pair is allowed to repeat — duplicates are a
  valid state, not a bug (a keyword can legitimately appear twice on one
  date).
- Selection (which rows are bulk-checked in the UI) is **not** stored here —
  it lives in `src/store/uiStore.ts` and resets on reload.
- `StatusColumn.isDefault` marks the seeded 생성/미캔 columns: they can be
  renamed and reordered but never hidden or deleted.

## Excel round-trip

Full Export writes exactly this shape and Import reads it back with upsert
matching on `(period, keyword)` — see `docs/specs/excel.md` for the full
behavior. API keys and any Direct Generate credential are **never** written
to an export file; they aren't part of the `Repository` contract at all (see
`docs/ARCHITECTURE.md`).
