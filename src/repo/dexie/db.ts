import Dexie, { type Table } from 'dexie'
import type {
  Plan,
  KeywordItem,
  StatusColumn,
  KeywordStatus,
  Generator,
  AppSetting,
} from '../types'

/**
 * IndexedDB schema. This file is the ONLY place Dexie types are used for
 * storage; everything above the repository works with the plain interfaces in
 * ../types. Indexes mirror the columns a Cloudflare D1 schema would index on.
 */
export class StockPlannerDB extends Dexie {
  plans!: Table<Plan, string>
  keywords!: Table<KeywordItem, string>
  statusColumns!: Table<StatusColumn, string>
  keywordStatus!: Table<KeywordStatus, string>
  generators!: Table<Generator, string>
  settings!: Table<AppSetting, string>

  constructor() {
    super('stock-planner')
    this.version(1).stores({
      plans: 'id, workspaceId, type, updatedAt',
      keywords: 'id, workspaceId, planId, [planId+period], period, sortOrder',
      statusColumns: 'id, workspaceId, planId, [planId+order], order',
      keywordStatus:
        'id, workspaceId, keywordItemId, statusColumnId, [keywordItemId+statusColumnId]',
      generators: 'id, workspaceId, isDefault',
      settings: 'key',
    })
  }
}

export const db = new StockPlannerDB()
