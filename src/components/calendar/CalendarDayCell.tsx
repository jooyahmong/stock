import type { KeywordItem, PlanPurpose } from '../../repo/types'
import { genMark, type DayCell } from '../../domain/calendar'
import { CalendarKeywordLine } from './CalendarKeywordLine'
import { PlannerTaskLine } from './PlannerTaskLine'

const MAX_VISIBLE = 3

export function CalendarDayCell({
  cell,
  today,
  items,
  isGenerated,
  purpose = 'stock',
  onRun,
  onToggleComplete,
  onOpenDay,
}: {
  cell: DayCell
  today: string
  items: KeywordItem[]
  isGenerated: (k: KeywordItem) => boolean
  purpose?: PlanPurpose
  onRun: (keyword: string, keywordItemId: string) => void
  onToggleComplete?: (keywordItemId: string, checked: boolean) => void
  onOpenDay: (dayIso: string) => void
}) {
  const isPlanner = purpose === 'planner'
  const isToday = cell.iso === today
  const visible = items.slice(0, MAX_VISIBLE)
  const extra = items.length - visible.length
  // Planner: any in-month cell can be opened to add/see tasks, even empty
  // ones. Leading/trailing cells from adjacent months stay open-when-non-empty
  // only — `keywordsByDay` indexes strictly by the *displayed* month, so a
  // task Quick-Added on an out-of-month cell would immediately vanish from
  // this grid (only reappearing after navigating to its real month).
  const canOpen = (isPlanner && cell.inMonth) || items.length > 0

  return (
    <div
      className={
        'cal-cell' +
        (cell.inMonth ? '' : ' cal-cell-out') +
        (isToday ? ' cal-cell-today' : '')
      }
    >
      <button
        type="button"
        className="cal-daynum"
        onClick={() => canOpen && onOpenDay(cell.iso)}
        aria-label={`${cell.iso}${items.length ? ` · ${isPlanner ? '할 일' : '키워드'} ${items.length}개` : ''}`}
      >
        {cell.day}
      </button>

      <div className="cal-cell-body">
        {isPlanner
          ? visible.map((k) => (
              <PlannerTaskLine
                key={k.id}
                keyword={k.keyword}
                completed={isGenerated(k)}
                onToggle={(checked) => onToggleComplete?.(k.id, checked)}
                onOpen={() => onOpenDay(cell.iso)}
              />
            ))
          : visible.map((k) => (
              <CalendarKeywordLine
                key={k.id}
                keyword={k.keyword}
                keywordItemId={k.id}
                mark={genMark(cell.iso, today, isGenerated(k))}
                onRun={onRun}
              />
            ))}
        {extra > 0 && (
          <button
            type="button"
            className="cal-more"
            onClick={() => onOpenDay(cell.iso)}
          >
            +{extra}개
          </button>
        )}
        {isPlanner && cell.inMonth && items.length === 0 && (
          <button type="button" className="cal-add-hint" onClick={() => onOpenDay(cell.iso)}>
            + 추가
          </button>
        )}
      </div>
    </div>
  )
}
