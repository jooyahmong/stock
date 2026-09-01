import type { KeywordItem } from '../repo/types'
import {
  periodGroupLabel,
  periodGroupSubLabel,
  type PeriodKind,
} from './periods'
import type { Filter } from '../store/uiStore'

export interface PeriodGroup {
  period: string
  label: string
  subLabel: string
  items: KeywordItem[]
}

export interface GroupingResult {
  groups: PeriodGroup[]
  /** Flat list of the keywords that passed the filter — used for progress. */
  visibleKeywords: KeywordItem[]
  filtering: boolean
}

function matchesStatus(
  keywordId: string,
  filter: Filter,
  statusMap: Record<string, boolean>,
): boolean {
  if (filter.kind === 'all') return true
  const checked = statusMap[`${keywordId}:${filter.columnId}`] === true
  return filter.want === 'done' ? checked : !checked
}

export function groupKeywords(
  keywords: KeywordItem[],
  opts: {
    kind: PeriodKind
    search: string
    filter: Filter
    statusMap: Record<string, boolean>
    /** Periods that should render even with zero rows (only when not filtering). */
    knownPeriods?: string[]
  },
): GroupingResult {
  const q = opts.search.trim().toLowerCase()
  const filtering = q.length > 0 || opts.filter.kind !== 'all'

  const passed = keywords.filter((k) => {
    if (q && !k.keyword.toLowerCase().includes(q) && !k.period.toLowerCase().includes(q))
      return false
    if (!matchesStatus(k.id, opts.filter, opts.statusMap)) return false
    return true
  })

  const byPeriod = new Map<string, KeywordItem[]>()
  if (!filtering) {
    for (const p of opts.knownPeriods ?? []) byPeriod.set(p, [])
  }
  for (const k of passed) {
    const arr = byPeriod.get(k.period)
    if (arr) arr.push(k)
    else byPeriod.set(k.period, [k])
  }

  const groups: PeriodGroup[] = [...byPeriod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, items]) => ({
      period,
      label: periodGroupLabel(opts.kind, period),
      subLabel: periodGroupSubLabel(opts.kind, period),
      items: items.sort((a, b) => a.sortOrder - b.sortOrder),
    }))

  return { groups, visibleKeywords: passed, filtering }
}
