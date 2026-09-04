import { currentMonth, formatMonthTitle, shiftMonth } from '../../domain/calendar'

export const FIRST_AVAILABLE_MONTH = '2026-09'

export function MonthNavigator({ month, onChange }: {
  month: string
  onChange: (month: string) => void
}) {
  const current = currentMonth()
  return (
    <div className="cal-head" aria-label="월 선택">
      <button className="icon-btn" aria-label="이전 달" disabled={month <= FIRST_AVAILABLE_MONTH}
        onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
      <strong className="cal-title">{formatMonthTitle(month)}</strong>
      <button className="icon-btn" aria-label="다음 달"
        onClick={() => onChange(shiftMonth(month, 1))}>›</button>
      <button className="btn btn-xs" disabled={month === current}
        onClick={() => onChange(current < FIRST_AVAILABLE_MONTH ? FIRST_AVAILABLE_MONTH : current)}>오늘</button>
    </div>
  )
}
