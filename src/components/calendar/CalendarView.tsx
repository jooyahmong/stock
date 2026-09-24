import { useEffect, useMemo, useState } from 'react'
import type { KeywordItem, PlanPurpose, StatusColumn } from '../../repo/types'
import { findGeneratedColumn, findCompletionColumn } from '../../domain/statusColumns'
import { useRepository } from '../../repo/RepositoryContext'
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
 * handler the list view uses) for stock plans. Planner plans instead show a
 * completion checkbox per task and a Quick Add flow — no generation is ever
 * triggered for `purpose === 'planner'` (docs/specs/general-planner.md §7).
 */
export function CalendarView({
  planId,
  keywords,
  statusColumns,
  statusMap,
  dateBased,
  purpose = 'stock',
  onRun,
  onSwitchToList,
  month,
  onMonthChange,
  focusDayRequest,
}: {
  planId: string
  keywords: KeywordItem[]
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  dateBased: boolean
  purpose?: PlanPurpose
  onRun: (keyword: string, keywordItemId: string) => void
  onSwitchToList: () => void
  month: string
  onMonthChange: (month: string) => void
  /** Set by Plan search's "go to result" — opens that day's detail view. */
  focusDayRequest?: { dayIso: string; nonce: number } | null
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
      planId={planId}
      keywords={keywords}
      statusColumns={statusColumns}
      statusMap={statusMap}
      purpose={purpose}
      onRun={onRun}
      month={month}
      onMonthChange={onMonthChange}
      focusDayRequest={focusDayRequest}
    />
  )
}

function CalendarBody({
  planId,
  keywords,
  statusColumns,
  statusMap,
  purpose,
  onRun,
  month,
  onMonthChange,
  focusDayRequest,
}: {
  planId: string
  keywords: KeywordItem[]
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  purpose: PlanPurpose
  onRun: (keyword: string, keywordItemId: string) => void
  month: string
  onMonthChange: (month: string) => void
  focusDayRequest?: { dayIso: string; nonce: number } | null
}) {
  const repo = useRepository()
  const today = todayIso()
  const narrow = useIsNarrow()
  const isPlanner = purpose === 'planner'

  const [detailDay, setDetailDay] = useState<string | null>(null)

  // Plan search "go to result": always open that day's detail, even if it's
  // the same day already shown — the `nonce` makes each request distinct so
  // clicking the same search result twice still re-opens it.
  useEffect(() => {
    if (focusDayRequest) setDetailDay(focusDayRequest.dayIso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDayRequest?.nonce])

  const genCol = useMemo(
    () => (isPlanner ? findCompletionColumn(statusColumns) : findGeneratedColumn(statusColumns)),
    [isPlanner, statusColumns],
  )
  // For stock this means "생성 checked"; for planner it means "완료 checked" —
  // same shape either way, so the day-cell components don't need to know which.
  const isGenerated = useMemo(
    () => (k: KeywordItem) =>
      genCol ? statusMap[`${k.id}:${genCol.id}`] === true : false,
    [genCol, statusMap],
  )
  const onToggleComplete = useMemo(
    () => (keywordItemId: string, checked: boolean) => {
      if (genCol) void repo.setKeywordStatus(keywordItemId, genCol.id, checked)
    },
    [genCol, repo],
  )
  const onQuickAdd = useMemo(
    () => (dayIso: string, text: string) => {
      const value = text.trim()
      if (!value) return
      void repo.createKeyword({ planId, period: dayIso, keyword: value })
    },
    [planId, repo],
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
              items={dayMap.get(cell.iso) ?? []} isGenerated={isGenerated}
              purpose={purpose} onOpenDay={setDetailDay} />
          ))}
          {dayMap.size === 0 && (
            <p className="hint mobile-cal-empty">
              {isPlanner ? '이 달에 등록된 할 일이 없습니다.' : '이 달에 등록된 키워드가 없습니다.'}
            </p>
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
              purpose={purpose}
              onRun={onRun}
              onToggleComplete={onToggleComplete}
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
          purpose={purpose}
          onRun={onRun}
          onToggleComplete={onToggleComplete}
          onQuickAdd={onQuickAdd}
          onClose={() => setDetailDay(null)}
        />
      )}
    </div>
  )
}
