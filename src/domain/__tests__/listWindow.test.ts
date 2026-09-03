import { describe, expect, it } from 'vitest'
import { DEFAULT_LIST_WINDOW, getListView } from '../../components/ListWindow'

const groups = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
  .map((period) => ({ period }))
const anchor = '2026-09-03'

describe('today-first list', () => {
  it('hides past dates even for a short plan and preserves them newest first', () => {
    const view = getListView(groups, anchor, DEFAULT_LIST_WINDOW, false)
    expect(view.visible).toEqual(groups.slice(2))
    expect(view.past).toEqual([groups[1], groups[0]])
    expect(view.showPast).toBe(false)
  })

  it('expanding past dates does not displace today', () => {
    const view = getListView(groups, anchor, { ...DEFAULT_LIST_WINDOW, past: true }, false)
    expect(view.visible[0].period).toBe(anchor)
    expect(view.showPast).toBe(true)
  })

  it('keeps past-only plans accessible without showing them by default', () => {
    const view = getListView(groups.slice(0, 2), anchor, DEFAULT_LIST_WINDOW, false)
    expect(view.visible).toEqual([])
    expect(view.past).toHaveLength(2)
    expect(view.showPast).toBe(false)
  })

  it('search and full view include past work while keeping today first', () => {
    for (const [all, filtering] of [[true, false], [false, true]]) {
      const view = getListView(groups, anchor, { ...DEFAULT_LIST_WINDOW, all }, filtering)
      expect(view.visible[0].period).toBe(anchor)
      expect(view.showPast).toBe(true)
      expect(view.visible.length + view.past.length).toBe(groups.length)
    }
  })

  it('advances the start date when the day changes and uses the next date if today is empty', () => {
    const view = getListView(groups, '2026-09-04', DEFAULT_LIST_WINDOW, false)
    expect(view.visible).toEqual([groups[3]])
    expect(getListView([groups[3]], anchor, DEFAULT_LIST_WINDOW, false).visible).toEqual([groups[3]])
  })
})
