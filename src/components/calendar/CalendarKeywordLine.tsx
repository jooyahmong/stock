import type { GenMark } from '../../domain/calendar'

/**
 * One keyword inside a calendar cell / day list.
 * - single line, ellipsis for overflow (full text kept in `title`)
 * - ○ as soon as 생성 is checked (any date); × only for past days left unchecked
 * - click reuses the caller's generation handler — no logic duplicated here
 */
export function CalendarKeywordLine({
  keyword,
  keywordItemId,
  mark,
  onRun,
}: {
  keyword: string
  keywordItemId: string
  mark: GenMark
  onRun: (keyword: string, keywordItemId: string) => void
}) {
  return (
    <button
      type="button"
      className="cal-kw"
      title={keyword}
      onClick={() => onRun(keyword, keywordItemId)}
    >
      {mark !== 'none' && (
        <span
          className={`cal-mark cal-mark-${mark}`}
          aria-label={mark === 'done' ? '생성 완료' : '미생성'}
        >
          {mark === 'done' ? '◯' : '✕'}
        </span>
      )}
      <span className="cal-kw-text">{keyword}</span>
    </button>
  )
}
