import type { PlanSnapshot, StatusColumn } from '../repo/types'

export interface ColumnProgress {
  column: StatusColumn
  done: number
  total: number
  ratio: number
}

function statusKey(keywordItemId: string, statusColumnId: string) {
  return `${keywordItemId}:${statusColumnId}`
}

/**
 * Per-column completion counts. Works for any number of columns — default or
 * user-defined — so a newly added stage automatically gets a progress bar.
 * `keywordSubset` limits the count to the currently visible / filtered rows;
 * pass all keywords for a whole-plan summary.
 */
export function computeProgress(
  snapshot: Pick<PlanSnapshot, 'statusColumns' | 'statusMap'>,
  keywordSubset: { id: string }[],
  { includeHidden = false }: { includeHidden?: boolean } = {},
): ColumnProgress[] {
  const total = keywordSubset.length
  const cols = snapshot.statusColumns.filter((c) => includeHidden || c.isVisible)
  return cols.map((column) => {
    let done = 0
    for (const k of keywordSubset) {
      if (snapshot.statusMap[statusKey(k.id, column.id)]) done++
    }
    return { column, done, total, ratio: total === 0 ? 0 : done / total }
  })
}
