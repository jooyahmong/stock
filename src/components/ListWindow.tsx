/**
 * List-view date window state. A full-year plan (365 groups) is too long to
 * scroll, so the list starts at today by default and expands via
 * the "이후 더 보기 ▼" / "전체 N일 보기" buttons at the end of the list.
 */
export interface ListWindowState {
  after: number
  all: boolean
  past: boolean
}

export const DEFAULT_LIST_WINDOW: ListWindowState = { after: 11, all: false, past: false }

export function getListView<T extends { period: string }>(
  groups: T[],
  anchor: string,
  window: ListWindowState,
  filtering: boolean,
  includePast = true,
) {
  const upcoming = groups.filter((g) => g.period >= anchor)
  const past = includePast ? groups.filter((g) => g.period < anchor).reverse() : []
  const expanded = filtering || window.all
  return {
    visible: expanded ? upcoming : upcoming.slice(0, window.after),
    upcomingCount: upcoming.length,
    hasPast: groups.some((g) => g.period < anchor),
    past,
    showPast: expanded || window.past,
    windowed: !filtering && (upcoming.length > DEFAULT_LIST_WINDOW.after || window.all),
    atEnd: expanded || upcoming.length <= window.after,
  }
}
