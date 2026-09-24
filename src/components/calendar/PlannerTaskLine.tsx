/**
 * One task inside a Planner calendar cell / day list — a completion checkbox
 * (toggled in place, no generation involved) plus the task text (opens the
 * day detail view for editing). Mirrors `CalendarKeywordLine`'s layout but
 * never calls a generation handler — see docs/specs/general-planner.md §7/§9.
 */
export function PlannerTaskLine({
  keyword,
  completed,
  onToggle,
  onOpen,
}: {
  keyword: string
  completed: boolean
  onToggle: (checked: boolean) => void
  onOpen: () => void
}) {
  return (
    <div className="cal-kw planner-task-line">
      <button
        type="button"
        className={`task-check-dot${completed ? ' is-done' : ''}`}
        aria-label={completed ? `"${keyword}" 완료 해제` : `"${keyword}" 완료 체크`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(!completed)
        }}
      >
        {completed ? '☑' : '□'}
      </button>
      <button
        type="button"
        className="cal-kw-text-btn"
        title={keyword}
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
      >
        <span className="cal-kw-text">{keyword}</span>
      </button>
    </div>
  )
}
