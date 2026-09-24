import { describe, it, expect } from 'vitest'
import {
  planPurpose,
  isPlannerPlan,
  itemLabelFor,
  itemNounFor,
  DEFAULT_STATUS_NAMES_BY_PURPOSE,
} from '../planPurpose'

describe('planPurpose', () => {
  it('reads an explicit purpose', () => {
    expect(planPurpose({ purpose: 'planner' })).toBe('planner')
    expect(planPurpose({ purpose: 'stock' })).toBe('stock')
  })

  it('defaults missing/legacy purpose to stock', () => {
    expect(planPurpose({})).toBe('stock')
    expect(planPurpose({ purpose: undefined })).toBe('stock')
    expect(planPurpose(null)).toBe('stock')
    expect(planPurpose(undefined)).toBe('stock')
  })

  it('isPlannerPlan mirrors planPurpose', () => {
    expect(isPlannerPlan({ purpose: 'planner' })).toBe(true)
    expect(isPlannerPlan({ purpose: 'stock' })).toBe(false)
    expect(isPlannerPlan({})).toBe(false)
  })
})

describe('DEFAULT_STATUS_NAMES_BY_PURPOSE', () => {
  it('stock seeds 생성/미캔; planner seeds only 완료', () => {
    expect(DEFAULT_STATUS_NAMES_BY_PURPOSE.stock).toEqual(['생성', '미캔'])
    expect(DEFAULT_STATUS_NAMES_BY_PURPOSE.planner).toEqual(['완료'])
  })
})

describe('itemLabelFor / itemNounFor', () => {
  it('stock = Keyword/키워드, planner = Task/할 일', () => {
    expect(itemLabelFor('stock')).toBe('Keyword')
    expect(itemLabelFor('planner')).toBe('Task')
    expect(itemNounFor('stock')).toBe('키워드')
    expect(itemNounFor('planner')).toBe('할 일')
  })
})
