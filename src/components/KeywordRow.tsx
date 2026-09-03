import { useState } from 'react'
import type { KeywordItem, StatusColumn } from '../repo/types'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusCheckbox } from './StatusCheckbox'

export function KeywordRow({
  item,
  statusColumns,
  statusMap,
  onRun,
}: {
  item: KeywordItem
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  onRun: (keyword: string, keywordItemId: string) => void
}) {
  const repo = useRepository()
  const selected = useUiStore((s) => s.selection.has(item.id))
  const setSelected = useUiStore((s) => s.setSelected)
  const showToast = useUiStore((s) => s.showToast)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.keyword)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveEdit = async () => {
    const next = draft.trim()
    setEditing(false)
    if (!next) {
      setDraft(item.keyword)
      return
    }
    if (next !== item.keyword) await repo.updateKeyword(item.id, { keyword: next })
  }

  return (
    <div className={`kw-row${selected ? ' is-selected' : ''}`}>
      <input
        type="checkbox"
        className="select-box"
        checked={selected}
        onChange={(e) => setSelected(item.id, e.target.checked)}
        aria-label={`${item.keyword} 선택`}
      />

      {editing ? (
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
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          className="kw-text"
          title="클릭하면 프롬프트를 복사하고 기본 생성 사이트를 엽니다"
          onClick={() => onRun(item.keyword, item.id)}
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
          title="키워드 삭제"
          danger
          confirmLabel="삭제"
          message={
            <>
              <b>{item.keyword}</b> 키워드를 삭제하시겠습니까? 이 키워드의 작업 상태
              기록도 함께 삭제됩니다.
            </>
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            await repo.deleteKeyword(item.id)
            setSelected(item.id, false)
            showToast('키워드를 삭제했습니다.')
          }}
        />
      )}
    </div>
  )
}
