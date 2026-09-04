import type { KeywordItem } from '../../repo/types'
import { genMark, type DayCell } from '../../domain/calendar'

export function MobileCalendarDayCell({
  cell,
  today,
  items,
  isGenerated,
  onOpenDay,
}: {
  cell: DayCell
  today: string
  items: KeywordItem[]
  isGenerated: (item: KeywordItem) => boolean
  onOpenDay: (dayIso: string) => void
}) {
  const marks = items.slice(0, 3).map((item) => genMark(cell.iso, today, isGenerated(item)))
  return (
    <button type="button"
      className={`mobile-cal-cell${cell.inMonth ? '' : ' is-outside'}${cell.iso === today ? ' is-today' : ''}`}
      aria-label={`${cell.iso}${items.length ? ` · 키워드 ${items.length}개` : ' · 키워드 없음'}`}
      onClick={() => items.length > 0 && onOpenDay(cell.iso)}>
      <span className="mobile-cal-day">{cell.day}</span>
      {items.length > 0 && (
        <span className="mobile-cal-summary" aria-hidden="true">
          <span className="mobile-cal-count">{items.length}</span>
          <span className="mobile-cal-marks">
            {marks.map((mark, index) => (
              <i key={index} className={`mobile-cal-dot is-${mark}`} />
            ))}
          </span>
        </span>
      )}
    </button>
  )
}
