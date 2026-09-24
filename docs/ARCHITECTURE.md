# ARCHITECTURE

## Storage seam — the Repository pattern

UI and domain logic never talk to IndexedDB directly. Everything goes through
the `Repository` interface (`src/repo/types.ts`). V1 ships exactly one
implementation, `DexieRepository` (IndexedDB via Dexie). The planned
production backend is **Cloudflare D1** — a `D1Repository` implementing the
same interface can be swapped in later by changing one line in
`src/main.tsx`, without touching UI or domain code.

Design rules that keep that swap cheap (see the header comment in
`src/repo/types.ts` for the authoritative version):

- Every method is `async` and returns plain data — no Dexie types leak past
  `src/repo/dexie/`.
- IDs are caller-generated string UUIDs, never auto-increment numbers.
- Reactivity is delivered via `repository.subscribe()` change notifications,
  not a storage-engine-specific live-query mechanism (so it isn't tied to
  Dexie's live queries).
- Every row carries `workspaceId` — multi-user/multi-workspace separation is
  an added `WHERE` clause later, not a schema migration.
- Every mutable row carries `updatedAt` — the basis for a future Sync Mode's
  Last-Modified-Wins conflict policy (`docs/specs/sync.md`).
- **Direct Generate API keys are never part of this contract.** They live
  only in `src/generation/generationConfig.ts` (localStorage), local to each
  device, and are explicitly excluded from Excel export and any future sync.

## Directory layout

```
src/
  repo/
    types.ts                 Repository interface + entity types — the one storage contract
    RepositoryContext.tsx     Provider + useRepository() + useRepoQuery() (backend-agnostic reactivity)
    dexie/
      db.ts                   The only file where Dexie types appear
      DexieRepository.ts       Repository implementation
      seed.ts                 First-run seeding + dev-only reset (never runs in production)

  domain/                     Pure logic — no DB, no React. Reusable as-is if the backend changes.
    periods.ts                 Period parsing/validation/formatting per plan type
    grouping.ts                 Groups keywords by period for display + search/filter
    progress.ts                 Per-status-column progress counts
    statusColumns.ts            Finds the "생성" column (shared by Calendar O/X + Direct auto-check)
    calendar.ts                 Month grid, keywordsByDay, the O/X mark rule
    excel.ts                    Import parser (upsert) / Template / Full Export builders
    prompt.ts                   Keyword -> prompt text assembly
    imageStyles.ts               Built-in + custom image-style presets

  data/defaultStockKeywords/   Isolated seed-pack generator (not hardcoded in components)
    buildDefaultStockPlan.ts    buildDefaultStockPlan(startIso?) -> 365 days of {productionDate, keyword}
    events.ts / pools.ts / dateUtils.ts

  store/uiStore.ts             Volatile UI state only: selection, search, filter, toast
  hooks/                       useRunKeyword (the shared click-a-keyword handler), useImageStyles, useMediaQuery
  lib/                         Small framework-agnostic helpers: clipboard, gptUrl validation, Excel download, settings keys
  components/                  UI. Storage access only through useRepository()
    calendar/                   Calendar View (read + click-to-generate only; no editing/DnD)
    settings/                   Settings modal tabs

  generation/                  [Optional] Direct Generate layer — see docs/specs/generation.md.
                                Never imported by src/domain/* or src/repo/*; removable as a unit.
```

## Data flow

1. A component calls `useRepoQuery(r => r.someRead(...), deps)` for reads, or
   `useRepository()` + a direct method call for writes.
2. `DexieRepository` performs the IndexedDB operation, then calls its
   internal notify, which fires every `subscribe()` listener.
3. `useRepoQuery` re-runs on notification, so the UI stays in sync without any
   Dexie-specific "live query" hook. This is what makes swapping in a
   `D1Repository` (async network calls instead of IndexedDB) a drop-in change.

## The Direct Generate layer is structurally optional

`src/generation/` is a self-contained, removable feature layer:

- Gated end-to-end by `directGenerationEnabled` (`src/generation/featureFlags.ts`,
  env `VITE_DIRECT_GENERATION`, default **off**).
- `src/domain/*` and `src/repo/*` never import anything from `src/generation/`.
- Full removal is three edits (delete the folder, remove the
  `<GenerationProvider>` wrapper in `main.tsx`, remove the
  `directGenerationEnabled` branches in `App.tsx` / `SettingsModal.tsx`) — see
  `docs/specs/generation.md` for the exact steps.

## Cloudflare / deploy

- Cloudflare Pages auto-deploys `main` — pushing to `main` is the deploy
  step. There is no separate manual deploy action to run.
- No D1, no auth, no server-side secret storage exist yet. Do not add them
  without an explicit request — see `docs/DECISIONS.md` and
  `docs/specs/sync.md` for the planned (not built) shape.

## Known architectural debt

- `xlsx@0.18.5` (latest on npm) carries known advisories (prototype
  pollution / ReDoS). Risk is judged low for a local-only tool, but the
  parser is isolated to `src/domain/excel.ts` so swapping libraries later
  (SheetJS CDN build, or `exceljs`) is a contained change.
- The whole app bundle is ~700KB gzip, dominated by `xlsx`. Lazy-loading it
  behind the Import/Export actions would cut initial load — not done yet.
