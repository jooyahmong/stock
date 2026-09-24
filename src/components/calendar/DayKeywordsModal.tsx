import { useState } from 'react'
import type { KeywordItem, PlanPurpose } from '../../repo/types'
import { genMark } from '../../domain/calendar'
import { useRepository } from '../../repo/RepositoryContext'
import { useUiStore } from '../../store/uiStore'
import { ConfirmDialog } from '../ConfirmDialog'
import { Modal } from '../Modal'
import { CalendarKeywordLine } from './CalendarKeywordLine'

const WD = ['일', '월', '화', '수', '목', '금', '토']

function label(dayIso: string): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${dayIso} (${wd})`
}

/** Full keyword/task list for one day (opened from a cell's "+N개", day number, or "+ 추가"). */
export function DayKeywordsModal({
  dayIso,
  today,
  items,
  isGenerated,
  purpose = 'stock',
  onRun,
  onToggleComplete,
  onQuickAdd,
  onClose,
}: {
  dayIso: string
  today: string
  items: KeywordItem[]
  isGenerated: (k: KeywordItem) => boolean
  purpose?: PlanPurpose
  onRun: (keyword: string, keywordItemId: string) => void
  onToggleComplete?: (keywordItemId: string, checked: boolean) => void
  onQuickAdd?: (dayIso: string, text: string) => void
  onClose: () => void
}) {
  const isPlanner = purpose === 'planner'
  return (
    <Modal title={label(dayIso)} onClose={onClose} width={420}>
      {isPlanner ? (
        <PlannerDayList
          dayIso={dayIso}
          items={items}
          isCompleted={isGenerated}
          onToggleComplete={onToggleComplete}
          onQuickAdd={onQuickAdd}
        />
      ) : (
        <>
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
        </>
      )}
    </Modal>
  )
}

function PlannerDayList({
  dayIso,
  items,
  isCompleted,
  onToggleComplete,
  onQuickAdd,
}: {
  dayIso: string
  items: KeywordItem[]
  isCompleted: (k: KeywordItem) => boolean
  onToggleComplete?: (keywordItemId: string, checked: boolean) => void
  onQuickAdd?: (dayIso: string, text: string) => void
}) {
  const [draftNew, setDraftNew] = useState('')

  const submitNew = () => {
    const value = draftNew.trim()
    if (!value) return
    onQuickAdd?.(dayIso, value)
    setDraftNew('')
  }

  return (
    <>
      <ul className="planner-day-tasks">
        {items.map((item) => (
          <PlannerDayTaskRow
            key={item.id}
            item={item}
            completed={isCompleted(item)}
            onToggle={(checked) => onToggleComplete?.(item.id, checked)}
          />
        ))}
        {items.length === 0 && <li className="hint">등록된 할 일이 없습니다.</li>}
      </ul>

      <div className="pg-add">
        <input
          autoFocus
          value={draftNew}
          placeholder="할 일 또는 한 일을 입력 후 Enter"
          onChange={(e) => setDraftNew(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitNew()
          }}
        />
        <button className="btn btn-sm btn-primary" onMouseDown={submitNew}>
          추가
        </button>
      </div>
    </>
  )
}

function PlannerDayTaskRow({
  item,
  completed,
  onToggle,
}: {
  item: KeywordItem
  completed: boolean
  onToggle: (checked: boolean) => void
}) {
  const repo = useRepository()
  const showToast = useUiStore((s) => s.showToast)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.keyword)
  const [draftDate, setDraftDate] = useState(item.period)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveEdit = async () => {
    const nextText = draft.trim()
    const nextDate = draftDate.trim()
    setEditing(false)
    if (!nextText) {
      setDraft(item.keyword)
      setDraftDate(item.period)
      return
    }
    const patch: Partial<Pick<KeywordItem, 'keyword' | 'period'>> = {}
    if (nextText !== item.keyword) patch.keyword = nextText
    if (nextDate && nextDate !== item.period) patch.period = nextDate
    if (Object.keys(patch).length > 0) await repo.updateKeyword(item.id, patch)
  }

  return (
    <li className="planner-day-task">
      <button
        type="button"
        className={`task-check-dot${completed ? ' is-done' : ''}`}
        aria-label={completed ? `"${item.keyword}" 완료 해제` : `"${item.keyword}" 완료 체크`}
        onClick={() => onToggle(!completed)}
      >
        {completed ? '☑' : '□'}
      </button>

      {editing ? (
        <span className="kw-edit-group">
          <input
            className="kw-edit"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') {
                setDraft(item.keyword)
                setDraftDate(item.period)
                setEditing(false)
              }
            }}
          />
          <input
            type="date"
            className="kw-edit-date"
            value={draftDate}
            title="날짜 변경"
            onChange={(e) => setDraftDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') {
                setDraftDate(item.period)
                setEditing(false)
              }
            }}
          />
        </span>
      ) : (
        <button
          type="button"
          className="planner-day-task-text"
          title="클릭하면 할 일을 수정합니다"
          onClick={() => {
            setDraft(item.keyword)
            setDraftDate(item.period)
            setEditing(true)
          }}
        >
          {item.keyword}
        </button>
      )}

      <button type="button" className="icon-btn" title="삭제" onClick={() => setConfirmDelete(true)}>
        🗑
      </button>

      {confirmDelete && (
        <ConfirmDialog
          title="할 일 삭제"
          danger
          confirmLabel="삭제"
          message={
            <>
              <b>{item.keyword}</b> 할 일을 삭제하시겠습니까? 되돌릴 수 없습니다.
            </>
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            await repo.deleteKeyword(item.id)
            showToast('할 일을 삭제했습니다.')
          }}
        />
      )}
    </li>
  )
}
