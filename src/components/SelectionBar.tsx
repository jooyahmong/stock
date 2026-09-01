import { useState } from 'react'
import type { PlanSnapshot } from '../repo/types'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { ConfirmDialog } from './ConfirmDialog'

export function SelectionBar({ snapshot }: { snapshot: PlanSnapshot }) {
  const repo = useRepository()
  const selection = useUiStore((s) => s.selection)
  const clearSelection = useUiStore((s) => s.clearSelection)
  const showToast = useUiStore((s) => s.showToast)

  const [bulkColId, setBulkColId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const ids = [...selection]
  if (ids.length === 0) return null

  const visibleCols = snapshot.statusColumns.filter((c) => c.isVisible)
  const targetCol = bulkColId || visibleCols[0]?.id || ''

  const applyBulk = async (checked: boolean) => {
    if (!targetCol) return
    await repo.setKeywordStatusBulk(ids, targetCol, checked)
    const name = visibleCols.find((c) => c.id === targetCol)?.name ?? ''
    showToast(`${ids.length}개 항목 "${name}" ${checked ? '체크' : '해제'} 완료`)
  }

  return (
    <div className="selection-bar">
      <span className="sel-count">{ids.length}개 선택됨</span>

      <div className="sel-actions">
        <select value={targetCol} onChange={(e) => setBulkColId(e.target.value)}>
          {visibleCols.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={() => applyBulk(true)}>
          일괄 체크
        </button>
        <button className="btn btn-sm" onClick={() => applyBulk(false)}>
          일괄 해제
        </button>
        <button
          className="btn btn-sm btn-danger-ghost"
          onClick={() => setConfirmDelete(true)}
        >
          선택 삭제
        </button>
        <button className="btn btn-sm" onClick={clearSelection}>
          선택 해제
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="선택한 키워드 삭제"
          danger
          confirmLabel={`${ids.length}개 삭제`}
          message={`선택한 ${ids.length}개 키워드와 각 작업 상태 기록이 삭제됩니다. 되돌릴 수 없습니다.`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            await repo.deleteKeywords(ids)
            clearSelection()
            showToast(`${ids.length}개 키워드를 삭제했습니다.`)
          }}
        />
      )}
    </div>
  )
}
