import { useMemo, useState } from 'react'
import type { KeywordItem, StatusColumn } from '../../repo/types'
import { findGeneratedColumn } from '../../domain/statusColumns'
import {
  buildMonthGrid,
  currentMonth,
  earliestDateMonth,
  formatMonthTitle,
  genMark,
  keywordsByDay,
  shiftMonth,
  todayIso,
  WEEKDAY_LABELS,
} from '../../domain/calendar'
import { useIsNarrow } from '../../lib/useMediaQuery'
import { CalendarDayCell } from './CalendarDayCell'
import { CalendarKeywordLine } from './CalendarKeywordLine'
import { DayKeywordsModal } from './DayKeywordsModal'

const WD = ['일', '월', '화', '수', '목', '금', '토']

function agendaDayLabel(dayIso: string): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}월 ${d}일 (${wd})`
}

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
}: {
  keywords: KeywordItem[]
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  dateBased: boolean
  onRun: (keyword: string, keywordItemId: string) => void
  onSwitchToList: () => void
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
    />
  )
}

function CalendarBody({
  keywords,
  statusColumns,
  statusMap,
  onRun,
}: {
  keywords: KeywordItem[]
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  onRun: (keyword: string, keywordItemId: string) => void
}) {
  const today = todayIso()
  const narrow = useIsNarrow()

  const [month, setMonth] = useState(() => {
    const cur = currentMonth()
    if (keywordsByDay(keywords, cur).size > 0) return cur
    return earliestDateMonth(keywords) ?? cur
  })
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
      <div className="cal-head">
        <button
          className="icon-btn"
          aria-label="이전 달"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
        >
          ‹
        </button>
        <strong className="cal-title">{formatMonthTitle(month)}</strong>
        <button
          className="icon-btn"
          aria-label="다음 달"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          ›
        </button>
        <button
          className="btn btn-xs"
          onClick={() => setMonth(currentMonth())}
        >
          오늘
        </button>
      </div>

      {narrow ? (
        <div className="cal-agenda">
          {[...dayMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([iso, items]) => (
              <section key={iso} className="cal-agenda-day">
                <h4 className={iso === today ? 'is-today' : undefined}>
                  {agendaDayLabel(iso)}
                </h4>
                {items.map((k) => (
                  <CalendarKeywordLine
                    key={k.id}
                    keyword={k.keyword}
                    keywordItemId={k.id}
                    mark={genMark(iso, today, isGenerated(k))}
                    onRun={onRun}
                  />
                ))}
              </section>
            ))}
          {dayMap.size === 0 && (
            <p className="hint">이 달에 등록된 키워드가 없습니다.</p>
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
