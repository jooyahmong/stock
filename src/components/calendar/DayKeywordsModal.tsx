import type { KeywordItem } from '../../repo/types'
import { genMark } from '../../domain/calendar'
import { Modal } from '../Modal'
import { CalendarKeywordLine } from './CalendarKeywordLine'

const WD = ['일', '월', '화', '수', '목', '금', '토']

function label(dayIso: string): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${dayIso} (${wd})`
}

/** Full keyword list for one day (opened from a cell's "+N개" or day number). */
export function DayKeywordsModal({
  dayIso,
  today,
  items,
  isGenerated,
  onRun,
  onClose,
}: {
  dayIso: string
  today: string
  items: KeywordItem[]
  isGenerated: (k: KeywordItem) => boolean
  onRun: (keyword: string, keywordItemId: string) => void
  onClose: () => void
}) {
  return (
    <Modal title={label(dayIso)} onClose={onClose} width={420}>
      <ul className="cal-day-list">
        {items.map((k) => (
          <li key={k.id}>
            <CalendarKeywordLine
              keyword={k.keyword}
              keywordItemId={k.id}
              mark={genMark(dayIso, today, isGenerated(k))}
              onRun={(kw, id) => {
                onClose()
                onRun(kw, id)
              }}
            />
          </li>
        ))}
        {items.length === 0 && <li className="hint">등록된 키워드가 없습니다.</li>}
      </ul>
      <p className="hint">키워드 수정·작업 상태 관리는 목록 보기에서 하세요.</p>
    </Modal>
  )
}
