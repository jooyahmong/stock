import type { KeywordItem } from '../../repo/types'
import { genMark, type DayCell } from '../../domain/calendar'
import { CalendarKeywordLine } from './CalendarKeywordLine'

const MAX_VISIBLE = 3

export function CalendarDayCell({
  cell,
  today,
  items,
  isGenerated,
  onRun,
  onOpenDay,
}: {
  cell: DayCell
  today: string
  items: KeywordItem[]
  isGenerated: (k: KeywordItem) => boolean
  onRun: (keyword: string, keywordItemId: string) => void
  onOpenDay: (dayIso: string) => void
}) {
  const isToday = cell.iso === today
  const visible = items.slice(0, MAX_VISIBLE)
  const extra = items.length - visible.length

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
        onClick={() => items.length > 0 && onOpenDay(cell.iso)}
        aria-label={`${cell.iso}${items.length ? ` · 키워드 ${items.length}개` : ''}`}
      >
        {cell.day}
      </button>

      <div className="cal-cell-body">
        {visible.map((k) => (
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
      </div>
    </div>
  )
}
