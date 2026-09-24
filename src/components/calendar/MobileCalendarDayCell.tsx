import type { KeywordItem, PlanPurpose } from '../../repo/types'
import { genMark, type DayCell } from '../../domain/calendar'

export function MobileCalendarDayCell({
  cell,
  today,
  items,
  isGenerated,
  purpose = 'stock',
  onOpenDay,
}: {
  cell: DayCell
  today: string
  items: KeywordItem[]
  isGenerated: (item: KeywordItem) => boolean
  purpose?: PlanPurpose
  onOpenDay: (dayIso: string) => void
}) {
  const isPlanner = purpose === 'planner'
  // Planner never uses the ○/× "missed" rule — a task is only 'done' or not,
  // rendered as the neutral 'none' dot (see docs/specs/general-planner.md §9).
  const marks = items
    .slice(0, 3)
    .map((item) => (isPlanner ? (isGenerated(item) ? 'done' : 'none') : genMark(cell.iso, today, isGenerated(item))))
  // In-month only, for the same reason as CalendarDayCell: keywordsByDay
  // indexes strictly by the displayed month, so Quick Add on an out-of-month
  // cell would immediately vanish from this grid.
  const canOpen = (isPlanner && cell.inMonth) || items.length > 0
  const itemNoun = isPlanner ? '할 일' : '키워드'
  return (
    <button type="button"
      className={`mobile-cal-cell${cell.inMonth ? '' : ' is-outside'}${cell.iso === today ? ' is-today' : ''}`}
      aria-label={`${cell.iso}${items.length ? ` · ${itemNoun} ${items.length}개` : ` · ${itemNoun} 없음`}`}
      onClick={() => canOpen && onOpenDay(cell.iso)}>
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
      {isPlanner && items.length === 0 && (
        <span className="mobile-cal-add-hint" aria-hidden="true">+</span>
      )}
    </button>
  )
}
