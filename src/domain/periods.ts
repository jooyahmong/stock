import type { PlanType } from '../repo/types'

/**
 * Period handling. A keyword's `period` string is interpreted by the plan type.
 * Pure functions only — reused as-is by import, export, grouping, and any
 * future backend.
 *
 *  365 / custom : 'YYYY-MM-DD'
 *  weekly       : 'YYYY-Www'   (ISO-ish week number, 01–53)
 *  monthly      : 'YYYY-MM'
 */

export type PeriodKind = 'date' | 'week' | 'month'

export function periodKind(type: PlanType): PeriodKind {
  if (type === 'weekly') return 'week'
  if (type === 'monthly') return 'month'
  return 'date' // '365' and 'custom'
}

/** Header label for the first Excel column of an import/export sheet. */
export function periodColumnLabel(kind: PeriodKind): string {
  return kind === 'week' ? 'Week' : kind === 'month' ? 'Month' : 'Date'
}

/** Korean noun for the period unit, for UI buttons/labels ("날짜 추가"). */
export function periodNoun(kind: PeriodKind): string {
  return kind === 'week' ? '주' : kind === 'month' ? '월' : '날짜'
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const WEEK_RE = /^(\d{4})-W(\d{2})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  )
}

export function isValidPeriod(kind: PeriodKind, raw: string): boolean {
  const value = raw.trim()
  if (kind === 'date') {
    const m = DATE_RE.exec(value)
    if (!m) return false
    return isRealDate(+m[1], +m[2], +m[3])
  }
  if (kind === 'week') {
    const m = WEEK_RE.exec(value)
    if (!m) return false
    const wk = +m[2]
    return wk >= 1 && wk <= 53
  }
  const m = MONTH_RE.exec(value)
  if (!m) return false
  const mo = +m[2]
  return mo >= 1 && mo <= 12
}

/**
 * Coerce a raw cell (string, number, or Date from SheetJS) into the canonical
 * period string for `kind`. Returns null when it cannot be understood.
 */
export function normalizePeriod(kind: PeriodKind, cell: unknown): string | null {
  if (cell == null) return null

  if (cell instanceof Date && !isNaN(cell.getTime())) {
    // SheetJS date serials can land a second either side of midnight
    // (e.g. 2027-01-01 comes back as 2026-12-31T23:59:59). Snap to the
    // nearest local midnight so it round-trips against the stored ISO string.
    const snapped = new Date(cell.getTime())
    if (snapped.getHours() >= 12) snapped.setDate(snapped.getDate() + 1)
    snapped.setHours(0, 0, 0, 0)
    const y = snapped.getFullYear()
    const mo = String(snapped.getMonth() + 1).padStart(2, '0')
    const d = String(snapped.getDate()).padStart(2, '0')
    if (kind === 'date') return `${y}-${mo}-${d}`
    if (kind === 'month') return `${y}-${mo}`
    return isoWeekString(snapped)
  }

  let value = String(cell).trim()
  if (!value) return null

  // Common alternative separators.
  value = value.replace(/[./]/g, '-')

  if (kind === 'week') {
    // Accept '2027-W1', '2027W01', '2027-w01'
    const m = /^(\d{4})-?[wW]-?(\d{1,2})$/.exec(value)
    if (m) {
      const norm = `${m[1]}-W${m[2].padStart(2, '0')}`
      return isValidPeriod('week', norm) ? norm : null
    }
    return null
  }

  if (kind === 'month') {
    const m = /^(\d{4})-(\d{1,2})$/.exec(value)
    if (m) {
      const norm = `${m[1]}-${m[2].padStart(2, '0')}`
      return isValidPeriod('month', norm) ? norm : null
    }
    return null
  }

  // date
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value)
  if (m) {
    const norm = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    return isValidPeriod('date', norm) ? norm : null
  }
  return null
}

function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

/** Human group header shown in the UI (data is never merged; this is display only). */
export function periodGroupLabel(kind: PeriodKind, period: string): string {
  if (kind === 'date') {
    const m = DATE_RE.exec(period)
    if (m) return `${MONTHS_SHORT[+m[2] - 1]} ${m[3]}`
    return period
  }
  if (kind === 'week') {
    const m = WEEK_RE.exec(period)
    if (m) return `${m[1]} · W${m[2]}`
    return period
  }
  const m = MONTH_RE.exec(period)
  if (m) return `${MONTHS_SHORT[+m[2] - 1]} ${m[1]}`
  return period
}

/** Secondary line under the group header (full date / range hint). */
export function periodGroupSubLabel(kind: PeriodKind, period: string): string {
  if (kind === 'date') {
    const m = DATE_RE.exec(period)
    if (m) {
      const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
      const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getUTCDay()]
      return `${period} (${weekday})`
    }
  }
  return period
}

/** Current period string for `kind`, used as the list-view window anchor ("today"). */
export function currentPeriod(kind: PeriodKind, now: Date = new Date()): string {
  const y = now.getFullYear()
  if (kind === 'month') return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (kind === 'week') return isoWeekString(now)
  return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

/** A sensible default period for the "+ 기간 추가" action. */
export function defaultNewPeriod(kind: PeriodKind, existing: string[]): string {
  const sorted = [...existing].sort()
  const last = sorted[sorted.length - 1]
  if (kind === 'date') {
    const base = last && DATE_RE.test(last) ? new Date(last + 'T00:00:00Z') : new Date()
    base.setUTCDate(base.getUTCDate() + (last ? 1 : 0))
    return base.toISOString().slice(0, 10)
  }
  if (kind === 'month') {
    if (last && MONTH_RE.test(last)) {
      let [y, mo] = last.split('-').map(Number)
      mo += 1
      if (mo > 12) { mo = 1; y += 1 }
      return `${y}-${String(mo).padStart(2, '0')}`
    }
    return new Date().toISOString().slice(0, 7)
  }
  if (last && WEEK_RE.test(last)) {
    const [y, w] = [last.slice(0, 4), +last.slice(6)]
    const nw = w + 1
    if (nw > 52) return `${+y + 1}-W01`
    return `${y}-W${String(nw).padStart(2, '0')}`
  }
  return isoWeekString(new Date())
}
