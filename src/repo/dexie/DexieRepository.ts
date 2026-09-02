import { db } from './db'
import { newId, nowIso } from '../../lib/ids'
import {
  LOCAL_WORKSPACE_ID,
  type Repository,
  type Plan,
  type KeywordItem,
  type StatusColumn,
  type Generator,
  type CreatePlanInput,
  type CreateKeywordInput,
  type CreateStatusColumnInput,
  type CreateGeneratorInput,
  type PlanSnapshot,
} from '../types'

/** Seeded on every new plan, in this order. */
export const DEFAULT_STATUS_NAMES = ['생성', '미캔'] as const

export class DexieRepository implements Repository {
  private listeners = new Set<() => void>()
  private workspaceId = LOCAL_WORKSPACE_ID

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    this.listeners.forEach((l) => {
      try {
        l()
      } catch (err) {
        console.error('repository listener failed', err)
      }
    })
  }

  private statusKey(keywordItemId: string, statusColumnId: string) {
    return `${keywordItemId}:${statusColumnId}`
  }

  // ---- Plans ------------------------------------------------------------

  async listPlans(): Promise<Plan[]> {
    const plans = await db.plans
      .where('workspaceId')
      .equals(this.workspaceId)
      .toArray()
    return plans.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async getPlan(planId: string): Promise<Plan | undefined> {
    return db.plans.get(planId)
  }

  async createPlan(input: CreatePlanInput): Promise<Plan> {
    const ts = nowIso()
    const plan: Plan = {
      id: newId(),
      workspaceId: this.workspaceId,
      name: input.name.trim() || 'Untitled Plan',
      type: input.type,
      createdAt: ts,
      updatedAt: ts,
    }
    await db.transaction('rw', db.plans, db.statusColumns, async () => {
      await db.plans.add(plan)
      await db.statusColumns.bulkAdd(
        DEFAULT_STATUS_NAMES.map((name, i) => ({
          id: newId(),
          workspaceId: this.workspaceId,
          planId: plan.id,
          name,
          order: i,
          isVisible: true,
          isDefault: true,
          createdAt: ts,
        })),
      )
    })
    this.emit()
    return plan
  }

  async renamePlan(planId: string, name: string): Promise<void> {
    await db.plans.update(planId, { name: name.trim() || 'Untitled Plan', updatedAt: nowIso() })
    this.emit()
  }

  async deletePlan(planId: string): Promise<void> {
    await db.transaction(
      'rw',
      db.plans,
      db.keywords,
      db.statusColumns,
      db.keywordStatus,
      async () => {
        const keywordIds = (
          await db.keywords.where('planId').equals(planId).primaryKeys()
        ) as string[]
        await db.keywordStatus
          .where('keywordItemId')
          .anyOf(keywordIds)
          .delete()
        await db.keywords.where('planId').equals(planId).delete()
        await db.statusColumns.where('planId').equals(planId).delete()
        await db.plans.delete(planId)
      },
    )
    this.emit()
  }

  async getPlanSnapshot(planId: string): Promise<PlanSnapshot | undefined> {
    const plan = await db.plans.get(planId)
    if (!plan) return undefined
    const [keywords, statusColumns] = await Promise.all([
      db.keywords.where('planId').equals(planId).toArray(),
      db.statusColumns.where('planId').equals(planId).toArray(),
    ])
    keywords.sort(
      (a, b) => a.period.localeCompare(b.period) || a.sortOrder - b.sortOrder,
    )
    statusColumns.sort((a, b) => a.order - b.order)

    const keywordIds = keywords.map((k) => k.id)
    const statuses = keywordIds.length
      ? await db.keywordStatus.where('keywordItemId').anyOf(keywordIds).toArray()
      : []
    const statusMap: Record<string, boolean> = {}
    for (const s of statuses) {
      statusMap[this.statusKey(s.keywordItemId, s.statusColumnId)] = s.checked
    }
    return { plan, keywords, statusColumns, statusMap }
  }

  // ---- Keywords -------------------------------------------------------

  private async nextSortOrder(planId: string, period: string): Promise<number> {
    const rows = await db.keywords
      .where('[planId+period]')
      .equals([planId, period])
      .toArray()
    return rows.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1
  }

  async createKeyword(input: CreateKeywordInput): Promise<KeywordItem> {
    const ts = nowIso()
    const item: KeywordItem = {
      id: newId(),
      workspaceId: this.workspaceId,
      planId: input.planId,
      period: input.period,
      keyword: input.keyword.trim(),
      sortOrder:
        input.sortOrder ?? (await this.nextSortOrder(input.planId, input.period)),
      createdAt: ts,
      updatedAt: ts,
    }
    await db.keywords.add(item)
    await this.touchPlan(input.planId)
    this.emit()
    return item
  }

  async createKeywords(inputs: CreateKeywordInput[]): Promise<KeywordItem[]> {
    if (inputs.length === 0) return []
    const ts = nowIso()
    // Compute per-(plan,period) starting offsets once.
    const planId = inputs[0].planId
    const startByPeriod = new Map<string, number>()
    const created: KeywordItem[] = []
    await db.transaction('rw', db.keywords, db.plans, async () => {
      for (const input of inputs) {
        let base = startByPeriod.get(input.period)
        if (base === undefined) {
          base = await this.nextSortOrder(input.planId, input.period)
        }
        const item: KeywordItem = {
          id: newId(),
          workspaceId: this.workspaceId,
          planId: input.planId,
          period: input.period,
          keyword: input.keyword.trim(),
          sortOrder: input.sortOrder ?? base,
          createdAt: ts,
          updatedAt: ts,
        }
        startByPeriod.set(input.period, base + 1)
        created.push(item)
      }
      await db.keywords.bulkAdd(created)
      await this.touchPlan(planId)
    })
    this.emit()
    return created
  }

  async updateKeyword(
    keywordItemId: string,
    patch: Partial<Pick<KeywordItem, 'keyword' | 'period' | 'sortOrder'>>,
  ): Promise<void> {
    const clean: Record<string, unknown> = { updatedAt: nowIso() }
    if (patch.keyword !== undefined) clean.keyword = patch.keyword.trim()
    if (patch.period !== undefined) clean.period = patch.period
    if (patch.sortOrder !== undefined) clean.sortOrder = patch.sortOrder
    await db.keywords.update(keywordItemId, clean)
    const item = await db.keywords.get(keywordItemId)
    if (item) await this.touchPlan(item.planId)
    this.emit()
  }

  async deleteKeyword(keywordItemId: string): Promise<void> {
    await this.deleteKeywords([keywordItemId])
  }

  async deleteKeywords(keywordItemIds: string[]): Promise<void> {
    if (keywordItemIds.length === 0) return
    await db.transaction('rw', db.keywords, db.keywordStatus, db.plans, async () => {
      const items = await db.keywords.bulkGet(keywordItemIds)
      await db.keywordStatus
        .where('keywordItemId')
        .anyOf(keywordItemIds)
        .delete()
      await db.keywords.bulkDelete(keywordItemIds)
      const planId = items.find(Boolean)?.planId
      if (planId) await this.touchPlan(planId)
    })
    this.emit()
  }

  // ---- Status columns ----------------------------------------------------

  async createStatusColumn(input: CreateStatusColumnInput): Promise<StatusColumn> {
    const existing = await db.statusColumns
      .where('planId')
      .equals(input.planId)
      .toArray()
    const order = existing.reduce((max, c) => Math.max(max, c.order), -1) + 1
    const col: StatusColumn = {
      id: newId(),
      workspaceId: this.workspaceId,
      planId: input.planId,
      name: input.name.trim() || '새 단계',
      order,
      isVisible: true,
      isDefault: input.isDefault ?? false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await db.statusColumns.add(col)
    this.emit()
    return col
  }

  async updateStatusColumn(
    statusColumnId: string,
    patch: Partial<Pick<StatusColumn, 'name' | 'order' | 'isVisible'>>,
  ): Promise<void> {
    const clean: Record<string, unknown> = { updatedAt: nowIso() }
    if (patch.name !== undefined) clean.name = patch.name.trim() || '새 단계'
    if (patch.order !== undefined) clean.order = patch.order
    if (patch.isVisible !== undefined) clean.isVisible = patch.isVisible
    await db.statusColumns.update(statusColumnId, clean)
    this.emit()
  }

  async reorderStatusColumns(planId: string, orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.statusColumns, async () => {
      const ts = nowIso()
      for (let i = 0; i < orderedIds.length; i++) {
        await db.statusColumns.update(orderedIds[i], { order: i, updatedAt: ts })
      }
    })
    void planId
    this.emit()
  }

  async deleteStatusColumn(statusColumnId: string): Promise<void> {
    await db.transaction('rw', db.statusColumns, db.keywordStatus, async () => {
      await db.keywordStatus
        .where('statusColumnId')
        .equals(statusColumnId)
        .delete()
      await db.statusColumns.delete(statusColumnId)
    })
    this.emit()
  }

  // ---- Keyword status --------------------------------------------------

  async setKeywordStatus(
    keywordItemId: string,
    statusColumnId: string,
    checked: boolean,
  ): Promise<void> {
    const existing = await db.keywordStatus
      .where('[keywordItemId+statusColumnId]')
      .equals([keywordItemId, statusColumnId])
      .first()
    if (existing) {
      await db.keywordStatus.update(existing.id, { checked, updatedAt: nowIso() })
    } else {
      await db.keywordStatus.add({
        id: newId(),
        workspaceId: this.workspaceId,
        keywordItemId,
        statusColumnId,
        checked,
        updatedAt: nowIso(),
      })
    }
    this.emit()
  }

  async setKeywordStatusBulk(
    keywordItemIds: string[],
    statusColumnId: string,
    checked: boolean,
  ): Promise<void> {
    if (keywordItemIds.length === 0) return
    await db.transaction('rw', db.keywordStatus, async () => {
      const rows = await db.keywordStatus
        .where('statusColumnId')
        .equals(statusColumnId)
        .toArray()
      const byKeyword = new Map(rows.map((r) => [r.keywordItemId, r]))
      const ts = nowIso()
      for (const kid of keywordItemIds) {
        const existing = byKeyword.get(kid)
        if (existing) {
          await db.keywordStatus.update(existing.id, { checked, updatedAt: ts })
        } else {
          await db.keywordStatus.add({
            id: newId(),
            workspaceId: this.workspaceId,
            keywordItemId: kid,
            statusColumnId,
            checked,
            updatedAt: ts,
          })
        }
      }
    })
    this.emit()
  }

  // ---- Generators -----------------------------------------------------

  async listGenerators(): Promise<Generator[]> {
    const rows = await db.generators
      .where('workspaceId')
      .equals(this.workspaceId)
      .toArray()
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createGenerator(input: CreateGeneratorInput): Promise<Generator> {
    const rows = await this.listGenerators()
    const makeDefault = input.isDefault ?? rows.length === 0
    const gen: Generator = {
      id: newId(),
      workspaceId: this.workspaceId,
      name: input.name.trim() || 'Generator',
      url: input.url.trim(),
      isDefault: makeDefault,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await db.transaction('rw', db.generators, async () => {
      if (makeDefault) {
        for (const r of rows) {
          if (r.isDefault) await db.generators.update(r.id, { isDefault: false })
        }
      }
      await db.generators.add(gen)
    })
    this.emit()
    return gen
  }

  async updateGenerator(
    generatorId: string,
    patch: Partial<Pick<Generator, 'name' | 'url' | 'isDefault'>>,
  ): Promise<void> {
    await db.transaction('rw', db.generators, async () => {
      if (patch.isDefault) {
        const rows = await this.listGenerators()
        for (const r of rows) {
          if (r.isDefault && r.id !== generatorId)
            await db.generators.update(r.id, { isDefault: false })
        }
      }
      const clean: Record<string, unknown> = { updatedAt: nowIso() }
      if (patch.name !== undefined) clean.name = patch.name.trim() || 'Generator'
      if (patch.url !== undefined) clean.url = patch.url.trim()
      if (patch.isDefault !== undefined) clean.isDefault = patch.isDefault
      await db.generators.update(generatorId, clean)
    })
    this.emit()
  }

  async deleteGenerator(generatorId: string): Promise<void> {
    await db.transaction('rw', db.generators, async () => {
      const target = await db.generators.get(generatorId)
      await db.generators.delete(generatorId)
      if (target?.isDefault) {
        const rest = await this.listGenerators()
        if (rest[0]) await db.generators.update(rest[0].id, { isDefault: true })
      }
    })
    this.emit()
  }

  // ---- Settings ------------------------------------------------------

  async getSetting<T = unknown>(key: string): Promise<T | undefined> {
    const row = await db.settings.get(key)
    return row?.value as T | undefined
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value })
    this.emit()
  }

  // ---- internal ------------------------------------------------------

  private async touchPlan(planId: string) {
    await db.plans.update(planId, { updatedAt: nowIso() })
  }
}
