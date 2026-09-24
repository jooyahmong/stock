/**
 * Storage seam.
 *
 * Every persistence operation in the app goes through the `Repository` interface.
 * V1 ships one implementation (`DexieRepository`, IndexedDB). The planned
 * production backend is Cloudflare D1 — a `D1Repository` implementing this same
 * interface can be dropped in later without touching UI or domain logic.
 *
 * Design rules that keep the D1 swap cheap:
 *  - All methods are async and return plain data (no Dexie types leak out).
 *  - IDs are caller-independent string UUIDs, never auto-increment numbers.
 *  - Reactivity is delivered via `subscribe()` change notifications, not a
 *    storage-engine-specific live-query mechanism.
 *  - The data model already carries `workspaceId` on every row so multi-user /
 *    multi-workspace separation is an added WHERE clause, not a migration.
 *  - Every mutable row carries `updatedAt` — the basis for a future Sync Mode's
 *    Last-Modified-Wins conflict policy (see README "데이터 저장").
 *
 * Local Mode (current): workspaceId = LOCAL_WORKSPACE_ID, DexieRepository.
 * Sync Mode (future): workspaceId = account/workspace id, a D1Repository /
 * SyncRepository implementing this same interface. UI/domain code is unchanged.
 * Direct Generate API keys are NEVER part of this contract — they live only in
 * `src/generation/generationConfig.ts` (localStorage), local to each device.
 */

export type PlanType = '365' | 'weekly' | 'monthly' | 'custom'

/**
 * What a plan is *for*, independent of `type` (which only describes its date
 * structure). `'stock'` = the original stock-keyword tracker. `'planner'` =
 * a general diary/to-do plan (see docs/specs/general-planner.md).
 *
 * Plans created before this field existed have no `purpose` in storage —
 * treat a missing value as `'stock'` (use `planPurpose()` from
 * `src/domain/planPurpose.ts` rather than reading `.purpose` directly).
 */
export type PlanPurpose = 'stock' | 'planner'

/** Local single-user placeholder. Real workspaces arrive with auth + D1. */
export const LOCAL_WORKSPACE_ID = 'local'

export interface Plan {
  id: string
  workspaceId: string
  name: string
  type: PlanType
  /** Optional for backward compatibility — see `PlanPurpose`. */
  purpose?: PlanPurpose
  createdAt: string
  updatedAt: string
}

export interface KeywordItem {
  id: string
  workspaceId: string
  planId: string
  /** Interpreted by plan type: 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM'. */
  period: string
  keyword: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface StatusColumn {
  id: string
  workspaceId: string
  planId: string
  name: string
  order: number
  isVisible: boolean
  /** true for the seeded 생성 / 미캔 columns — cannot be hidden or deleted. */
  isDefault: boolean
  createdAt: string
  /** Set on create + every mutation. Basis for future Last-Modified-Wins sync. */
  updatedAt?: string
}

export interface KeywordStatus {
  id: string
  workspaceId: string
  keywordItemId: string
  statusColumnId: string
  checked: boolean
  updatedAt: string
}

export interface Generator {
  id: string
  workspaceId: string
  name: string
  url: string
  isDefault: boolean
  createdAt: string
  /** Set on create + every mutation. Basis for future Last-Modified-Wins sync. */
  updatedAt?: string
}

/** Small key/value bag for app-level prefs (active plan, prompt template later). */
export interface AppSetting {
  key: string
  value: unknown
}

// ---------------------------------------------------------------------------
// Input shapes (no server-managed fields)
// ---------------------------------------------------------------------------

export interface CreatePlanInput {
  name: string
  type: PlanType
  /** Defaults to `'stock'` when omitted (see `Plan.purpose`). */
  purpose?: PlanPurpose
}

export interface CreateKeywordInput {
  planId: string
  period: string
  keyword: string
  /** Optional explicit order; repository appends to end of the period when omitted. */
  sortOrder?: number
}

export interface CreateStatusColumnInput {
  planId: string
  name: string
  isDefault?: boolean
}

export interface CreateGeneratorInput {
  name: string
  url: string
  isDefault?: boolean
}

/** One fully-hydrated plan payload — cheap to fetch for a single-user local DB. */
export interface PlanSnapshot {
  plan: Plan
  keywords: KeywordItem[]
  statusColumns: StatusColumn[]
  /** Keyed `${keywordItemId}:${statusColumnId}` -> checked. Absent = unchecked. */
  statusMap: Record<string, boolean>
}

export interface Repository {
  /** Fired after any successful mutation. Return value unsubscribes. */
  subscribe(listener: () => void): () => void

  // Plans
  listPlans(): Promise<Plan[]>
  getPlan(planId: string): Promise<Plan | undefined>
  createPlan(input: CreatePlanInput): Promise<Plan>
  renamePlan(planId: string, name: string): Promise<void>
  deletePlan(planId: string): Promise<void>

  /** Everything needed to render one plan. */
  getPlanSnapshot(planId: string): Promise<PlanSnapshot | undefined>

  // Keywords
  createKeyword(input: CreateKeywordInput): Promise<KeywordItem>
  /** Bulk insert, used by Excel import. Returns created rows. */
  createKeywords(inputs: CreateKeywordInput[]): Promise<KeywordItem[]>
  updateKeyword(
    keywordItemId: string,
    patch: Partial<Pick<KeywordItem, 'keyword' | 'period' | 'sortOrder'>>,
  ): Promise<void>
  deleteKeyword(keywordItemId: string): Promise<void>
  deleteKeywords(keywordItemIds: string[]): Promise<void>

  // Status columns
  createStatusColumn(input: CreateStatusColumnInput): Promise<StatusColumn>
  updateStatusColumn(
    statusColumnId: string,
    patch: Partial<Pick<StatusColumn, 'name' | 'order' | 'isVisible'>>,
  ): Promise<void>
  /** Reorder within a plan; `orderedIds` is the new full order. */
  reorderStatusColumns(planId: string, orderedIds: string[]): Promise<void>
  /** Hard delete — also removes every keywordStatus row for that column. */
  deleteStatusColumn(statusColumnId: string): Promise<void>

  // Keyword <-> status checkmarks
  setKeywordStatus(
    keywordItemId: string,
    statusColumnId: string,
    checked: boolean,
  ): Promise<void>
  /** Bulk set one column for many keywords (selection actions). */
  setKeywordStatusBulk(
    keywordItemIds: string[],
    statusColumnId: string,
    checked: boolean,
  ): Promise<void>

  // Generators
  listGenerators(): Promise<Generator[]>
  createGenerator(input: CreateGeneratorInput): Promise<Generator>
  updateGenerator(
    generatorId: string,
    patch: Partial<Pick<Generator, 'name' | 'url' | 'isDefault'>>,
  ): Promise<void>
  deleteGenerator(generatorId: string): Promise<void>

  // App settings
  getSetting<T = unknown>(key: string): Promise<T | undefined>
  setSetting(key: string, value: unknown): Promise<void>
}
