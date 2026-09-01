import { describe, it, expect } from 'vitest'
import { groupKeywords } from '../grouping'
import { computeProgress } from '../progress'
import type { KeywordItem, StatusColumn } from '../../repo/types'

function kw(id: string, period: string, keyword: string, sortOrder = 0): KeywordItem {
  return {
    id,
    workspaceId: 'local',
    planId: 'p1',
    period,
    keyword,
    sortOrder,
    createdAt: '',
    updatedAt: '',
  }
}

const items: KeywordItem[] = [
  kw('a', '2027-01-01', '떡국', 0),
  kw('b', '2027-01-01', '일출', 1),
  kw('c', '2027-01-01', '복주머니', 2),
  kw('d', '2027-01-02', '겨울여행', 0),
]

describe('groupKeywords', () => {
  it('groups by period for display only, data order preserved', () => {
    const res = groupKeywords(items, {
      kind: 'date',
      search: '',
      filter: { kind: 'all' },
      statusMap: {},
    })
    expect(res.groups.map((g) => g.period)).toEqual(['2027-01-01', '2027-01-02'])
    expect(res.groups[0].items.map((i) => i.keyword)).toEqual([
      '떡국',
      '일출',
      '복주머니',
    ])
    expect(res.groups[0].label).toBe('JAN 01')
  })

  it('shows known empty periods when not filtering, hides them when filtering', () => {
    const withEmpty = groupKeywords(items, {
      kind: 'date',
      search: '',
      filter: { kind: 'all' },
      statusMap: {},
      knownPeriods: ['2027-01-05'],
    })
    expect(withEmpty.groups.map((g) => g.period)).toContain('2027-01-05')

    const filtered = groupKeywords(items, {
      kind: 'date',
      search: '떡',
      filter: { kind: 'all' },
      statusMap: {},
      knownPeriods: ['2027-01-05'],
    })
    expect(filtered.groups.map((g) => g.period)).not.toContain('2027-01-05')
    expect(filtered.groups[0].items).toHaveLength(1)
  })

  it('filters by status column completion', () => {
    const statusMap = { 'a:c1': true }
    const done = groupKeywords(items, {
      kind: 'date',
      search: '',
      filter: { kind: 'status', columnId: 'c1', want: 'done' },
      statusMap,
    })
    expect(done.visibleKeywords.map((k) => k.id)).toEqual(['a'])

    const todo = groupKeywords(items, {
      kind: 'date',
      search: '',
      filter: { kind: 'status', columnId: 'c1', want: 'todo' },
      statusMap,
    })
    expect(todo.visibleKeywords.map((k) => k.id)).toEqual(['b', 'c', 'd'])
  })
})

describe('computeProgress', () => {
  it('counts per column and auto-covers any number of columns', () => {
    const cols: StatusColumn[] = [
      { id: 'c1', workspaceId: 'local', planId: 'p1', name: '생성', order: 0, isVisible: true, isDefault: true, createdAt: '' },
      { id: 'c2', workspaceId: 'local', planId: 'p1', name: '미캔', order: 1, isVisible: true, isDefault: true, createdAt: '' },
      { id: 'c3', workspaceId: 'local', planId: 'p1', name: 'Adobe', order: 2, isVisible: true, isDefault: false, createdAt: '' },
    ]
    const statusMap = { 'a:c1': true, 'b:c1': true, 'a:c2': true, 'a:c3': true }
    const prog = computeProgress({ statusColumns: cols, statusMap }, items)
    expect(prog.map((p) => [p.column.name, p.done, p.total])).toEqual([
      ['생성', 2, 4],
      ['미캔', 1, 4],
      ['Adobe', 1, 4],
    ])
  })
})
