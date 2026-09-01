import { describe, it, expect } from 'vitest'
import {
  periodKind,
  periodColumnLabel,
  isValidPeriod,
  normalizePeriod,
  periodGroupLabel,
  defaultNewPeriod,
} from '../periods'

describe('periodKind / label', () => {
  it('maps plan type to period kind', () => {
    expect(periodKind('365')).toBe('date')
    expect(periodKind('custom')).toBe('date')
    expect(periodKind('weekly')).toBe('week')
    expect(periodKind('monthly')).toBe('month')
  })
  it('labels the base column', () => {
    expect(periodColumnLabel('date')).toBe('Date')
    expect(periodColumnLabel('week')).toBe('Week')
    expect(periodColumnLabel('month')).toBe('Month')
  })
})

describe('isValidPeriod', () => {
  it('accepts well-formed values', () => {
    expect(isValidPeriod('date', '2027-01-01')).toBe(true)
    expect(isValidPeriod('date', '2027-02-28')).toBe(true)
    expect(isValidPeriod('week', '2027-W01')).toBe(true)
    expect(isValidPeriod('week', '2027-W53')).toBe(true)
    expect(isValidPeriod('month', '2027-12')).toBe(true)
  })
  it('rejects malformed / impossible values', () => {
    expect(isValidPeriod('date', '2027-13-01')).toBe(false)
    expect(isValidPeriod('date', '2027-02-30')).toBe(false)
    expect(isValidPeriod('date', '2027/01/01')).toBe(false)
    expect(isValidPeriod('week', '2027-W54')).toBe(false)
    expect(isValidPeriod('week', '2027-W00')).toBe(false)
    expect(isValidPeriod('month', '2027-00')).toBe(false)
    expect(isValidPeriod('month', 'not-a-month')).toBe(false)
  })
})

describe('normalizePeriod', () => {
  it('normalizes dates with alt separators and short parts', () => {
    expect(normalizePeriod('date', '2027-1-3')).toBe('2027-01-03')
    expect(normalizePeriod('date', '2027/01/03')).toBe('2027-01-03')
    expect(normalizePeriod('date', '2027.1.3')).toBe('2027-01-03')
  })
  it('handles JS Date objects (SheetJS cellDates)', () => {
    const d = new Date(2027, 0, 5) // 5 Jan 2027 local
    expect(normalizePeriod('date', d)).toBe('2027-01-05')
    expect(normalizePeriod('month', d)).toBe('2027-01')
  })
  it('normalizes week forms', () => {
    expect(normalizePeriod('week', '2027-W1')).toBe('2027-W01')
    expect(normalizePeriod('week', '2027W01')).toBe('2027-W01')
    expect(normalizePeriod('week', '2027-w3')).toBe('2027-W03')
  })
  it('normalizes month forms', () => {
    expect(normalizePeriod('month', '2027-3')).toBe('2027-03')
    expect(normalizePeriod('month', '2027/03')).toBe('2027-03')
  })
  it('returns null for junk', () => {
    expect(normalizePeriod('date', 'abc')).toBeNull()
    expect(normalizePeriod('date', '')).toBeNull()
    expect(normalizePeriod('date', null)).toBeNull()
    expect(normalizePeriod('week', '2027-99')).toBeNull()
  })
})

describe('periodGroupLabel', () => {
  it('renders human headers without merging data', () => {
    expect(periodGroupLabel('date', '2027-01-01')).toBe('JAN 01')
    expect(periodGroupLabel('date', '2027-12-25')).toBe('DEC 25')
    expect(periodGroupLabel('week', '2027-W01')).toBe('2027 · W01')
    expect(periodGroupLabel('month', '2027-02')).toBe('FEB 2027')
  })
})

describe('defaultNewPeriod', () => {
  it('suggests the next slot after the latest existing period', () => {
    expect(defaultNewPeriod('date', ['2027-01-01', '2027-01-02'])).toBe('2027-01-03')
    expect(defaultNewPeriod('month', ['2027-01'])).toBe('2027-02')
    expect(defaultNewPeriod('week', ['2027-W01'])).toBe('2027-W02')
  })
})
