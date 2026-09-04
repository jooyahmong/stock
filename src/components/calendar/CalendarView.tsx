import { useMemo, useState } from 'react'
import type { KeywordItem, StatusColumn } from '../../repo/types'
import { findGeneratedColumn } from '../../domain/statusColumns'
import {
  buildMonthGrid,
  keywordsByDay,
  todayIso,
  WEEKDAY_LABELS,
} from '../../domain/calendar'
import { useIsNarrow } from '../../lib/useMediaQuery'
import { CalendarDayCell } from './CalendarDayCell'
import { DayKeywordsModal } from './DayKeywordsModal'
import { MobileCalendarDayCell } from './MobileCalendarDayCell'
import { MonthNavigator } from './MonthNavigator'

const MOBILE_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * Monthly Calendar View. Read-only over the existing plan data — it renders
 * KeywordItems by date and delegates every keyword click to `onRun` (the same
 * handler the list view uses). No editing here (spec §9).
 */
export function CalendarView({
  keywords,
  statusColumns,
  statusMap,
  dateBased,
  onRun,
  onSwitchToList,
  month,
  onMonthChange,
}: {
  keywords: KeywordItem[]
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  dateBased: boolean
  onRun: (keyword: string, keywordItemId: string) => void
  onSwitchToList: () => void
  month: string
  onMonthChange: (month: string) => void
}) {
  if (!dateBased) {
    return (
      <div className="calendar">
        <div className="empty-state">
          <p>달력 보기는 날짜 기반 계획(365 / My Plan)에서 사용할 수 있습니다.</p>
          <button className="btn btn-sm" onClick={onSwitchToList}>
            목록 보기로 전환
          </button>
        </div>
      </div>
    )
  }
  return (
    <CalendarBody
      keywords={keywords}
      statusColumns={statusColumns}
      statusMap={statusMap}
      onRun={onRun}
      month={month}
      onMonthChange={onMonthChange}
    />
  )
}

function CalendarBody({
  keywords,
  statusColumns,
  statusMap,
  onRun,
  month,
  onMonthChange,
}: {
  keywords: KeywordItem[]
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  onRun: (keyword: string, keywordItemId: string) => void
  month: string
  onMonthChange: (month: string) => void
}) {
  const today = todayIso()
  const narrow = useIsNarrow()

  const [detailDay, setDetailDay] = useState<string | null>(null)

  const genCol = useMemo(
    () => findGeneratedColumn(statusColumns),
    [statusColumns],
  )
  const isGenerated = useMemo(
    () => (k: KeywordItem) =>
      genCol ? statusMap[`${k.id}:${genCol.id}`] === true : false,
    [genCol, statusMap],
  )

  const weeks = useMemo(() => buildMonthGrid(month), [month])
  const dayMap = useMemo(() => keywordsByDay(keywords, month), [keywords, month])
  const detailItems = detailDay ? (dayMap.get(detailDay) ?? []) : []

  return (
    <div className="calendar">
      <MonthNavigator month={month} onChange={onMonthChange} />

      {narrow ? (
        <div className="mobile-cal-grid" role="grid">
          {MOBILE_WEEKDAY_LABELS.map((weekday) => (
            <div key={weekday} className="mobile-cal-weekday" role="columnheader">{weekday}</div>
          ))}
          {weeks.flat().map((cell) => (
            <MobileCalendarDayCell key={cell.iso} cell={cell} today={today}
              items={dayMap.get(cell.iso) ?? []} isGenerated={isGenerated} onOpenDay={setDetailDay} />
          ))}
          {dayMap.size === 0 && (
            <p className="hint mobile-cal-empty">이 달에 등록된 키워드가 없습니다.</p>
          )}
        </div>
      ) : (
        <div className="cal-grid" role="grid">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="cal-wd" role="columnheader">
              {w}
            </div>
          ))}
          {weeks.flat().map((cell) => (
            <CalendarDayCell
              key={cell.iso}
              cell={cell}
              today={today}
              items={dayMap.get(cell.iso) ?? []}
              isGenerated={isGenerated}
              onRun={onRun}
              onOpenDay={setDetailDay}
            />
          ))}
        </div>
      )}

      {detailDay && (
        <DayKeywordsModal
          dayIso={detailDay}
          today={today}
          items={detailItems}
          isGenerated={isGenerated}
          onRun={onRun}
          onClose={() => setDetailDay(null)}
        />
      )}
    </div>
  )
}
