import type { ViewMode } from '../lib/viewModePref'

export function ViewToggle({
  viewMode,
  onChange,
  calendarAvailable,
}: {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
  calendarAvailable: boolean
}) {
  return (
    <div className="view-toggle" role="tablist" aria-label="보기 전환">
      <button
        role="tab"
        aria-selected={viewMode === 'calendar'}
        className={`vt-btn${viewMode === 'calendar' ? ' is-active' : ''}`}
        disabled={!calendarAvailable}
        title={
          calendarAvailable
            ? undefined
            : '달력 보기는 날짜 기반 계획에서 사용할 수 있습니다.'
        }
        onClick={() => calendarAvailable && onChange('calendar')}
      >
        달력 보기
      </button>
      <button
        role="tab"
        aria-selected={viewMode === 'list'}
        className={`vt-btn${viewMode === 'list' ? ' is-active' : ''}`}
        onClick={() => onChange('list')}
      >
        목록 보기
      </button>
    </div>
  )
}
