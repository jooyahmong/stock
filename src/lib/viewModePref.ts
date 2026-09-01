/** Last-selected Planner view mode. Local UI preference only (not app data). */
export type ViewMode = 'list' | 'calendar'

const KEY = 'woojoo.viewMode.v1'

export function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(KEY) === 'calendar' ? 'calendar' : 'list'
  } catch {
    return 'list'
  }
}

export function writeViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* storage disabled — session-only is fine */
  }
}
