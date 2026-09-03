/** Last-selected Planner view mode. Local UI preference only (not app data). */
export type ViewMode = 'list' | 'calendar'

// Start the calendar-first layout once, then remember subsequent user choices.
const KEY = 'woojoo.viewMode.v2'

export function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(KEY) === 'list' ? 'list' : 'calendar'
  } catch {
    return 'calendar'
  }
}

export function writeViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* storage disabled — session-only is fine */
  }
}
