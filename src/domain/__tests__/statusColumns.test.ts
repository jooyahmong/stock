import { describe, it, expect } from 'vitest'
import { findGeneratedColumn } from '../statusColumns'
import type { StatusColumn } from '../../repo/types'

function col(over: Partial<StatusColumn>): StatusColumn {
  return {
    id: 'c',
    workspaceId: 'local',
    planId: 'p1',
    name: 'x',
    order: 0,
    isVisible: true,
    isDefault: false,
    createdAt: '',
    ...over,
  }
}

describe('findGeneratedColumn', () => {
  it('matches the column named 생성', () => {
    const cols = [
      col({ id: '1', name: '미캔', order: 0, isDefault: true }),
      col({ id: '2', name: '생성', order: 1, isDefault: true }),
    ]
    expect(findGeneratedColumn(cols)?.id).toBe('2')
  })

  it('falls back to the first default column when 생성 was renamed', () => {
    const cols = [
      col({ id: '1', name: 'Created', order: 0, isDefault: true }),
      col({ id: '2', name: '미캔', order: 1, isDefault: true }),
      col({ id: '3', name: 'Adobe', order: 2, isDefault: false }),
    ]
    expect(findGeneratedColumn(cols)?.id).toBe('1')
  })

  it('returns null when there is no default column', () => {
    expect(findGeneratedColumn([col({ id: '1', name: 'Adobe', isDefault: false })])).toBeNull()
    expect(findGeneratedColumn([])).toBeNull()
  })
})
