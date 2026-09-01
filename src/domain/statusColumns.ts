import type { StatusColumn } from '../repo/types'

/**
 * The single status column that means "이미지 생성 완료".
 *
 * Used by the Calendar View's O/X marks and by Direct Generate's success
 * auto-check. Prefers a column literally named "생성"; otherwise falls back to
 * the first default column (생성 is seeded at order 0). Renaming 생성 keeps it
 * working via the fallback.
 */
export function findGeneratedColumn(columns: StatusColumn[]): StatusColumn | null {
  const byName = columns.find((c) => c.name.trim() === '생성')
  if (byName) return byName
  const defaults = columns
    .filter((c) => c.isDefault)
    .sort((a, b) => a.order - b.order)
  return defaults[0] ?? null
}
