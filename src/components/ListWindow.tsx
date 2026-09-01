/**
 * List-view date window state. A full-year plan (365 groups) is too long to
 * scroll, so the list shows a slice around "today" by default and expands via
 * the "이후 더 보기 ▼" / "전체 N일 보기" buttons at the end of the list.
 */
export interface ListWindowState {
  before: number
  after: number
  all: boolean
}

export const DEFAULT_LIST_WINDOW: ListWindowState = { before: 3, after: 11, all: false }
