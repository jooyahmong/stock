import { useState } from 'react'
import type { KeywordItem, PlanPurpose, StatusColumn } from '../repo/types'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusCheckbox } from './StatusCheckbox'

export function KeywordRow({
  item,
  statusColumns,
  statusMap,
  onRun,
  purpose = 'stock',
}: {
  item: KeywordItem
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  onRun: (keyword: string, keywordItemId: string) => void
  purpose?: PlanPurpose
}) {
  const repo = useRepository()
  const selected = useUiStore((s) => s.selection.has(item.id))
  const setSelected = useUiStore((s) => s.setSelected)
  const showToast = useUiStore((s) => s.showToast)
  const isPlanner = purpose === 'planner'

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
    if (isPlanner && nextDate && nextDate !== item.period) patch.period = nextDate
    if (Object.keys(patch).length > 0) await repo.updateKeyword(item.id, patch)
  }

  return (
    <div className={`kw-row${selected ? ' is-selected' : ''}`}>
      {!isPlanner && (
        <input
          type="checkbox"
          className="select-box"
          checked={selected}
          onChange={(e) => setSelected(item.id, e.target.checked)}
          aria-label={`${item.keyword} 선택`}
        />
      )}

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
          {isPlanner && (
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
          )}
        </span>
      ) : (
        <button
          className="kw-text"
          title={
            isPlanner
              ? '클릭하면 할 일을 수정합니다'
              : '클릭하면 프롬프트를 복사하고 기본 생성 사이트를 엽니다'
          }
          onClick={() => {
            if (isPlanner) {
              setDraft(item.keyword)
              setDraftDate(item.period)
              setEditing(true)
            } else {
              onRun(item.keyword, item.id)
            }
          }}
        >
          {item.keyword}
        </button>
      )}

      <div className="kw-statuses">
        {statusColumns.map((col) => (
          <StatusCheckbox
            key={col.id}
            label={col.name}
            checked={statusMap[`${item.id}:${col.id}`] === true}
            onToggle={(next) => repo.setKeywordStatus(item.id, col.id, next)}
          />
        ))}
      </div>

      <div className="kw-actions">
        <button
          className="icon-btn"
          title="수정"
          onClick={() => {
            setDraft(item.keyword)
            setDraftDate(item.period)
            setEditing(true)
          }}
        >
          ✎
        </button>
        <button
          className="icon-btn"
          title="삭제"
          onClick={() => setConfirmDelete(true)}
        >
          🗑
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={isPlanner ? '할 일 삭제' : '키워드 삭제'}
          danger
          confirmLabel="삭제"
          message={
            isPlanner ? (
              <>
                <b>{item.keyword}</b> 할 일을 삭제하시겠습니까? 되돌릴 수 없습니다.
              </>
            ) : (
              <>
                <b>{item.keyword}</b> 키워드를 삭제하시겠습니까? 이 키워드의 작업 상태
                기록도 함께 삭제됩니다.
              </>
            )
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            await repo.deleteKeyword(item.id)
            setSelected(item.id, false)
            showToast(isPlanner ? '할 일을 삭제했습니다.' : '키워드를 삭제했습니다.')
          }}
        />
      )}
    </div>
  )
}
