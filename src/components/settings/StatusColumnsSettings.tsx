import { useState } from 'react'
import type { StatusColumn } from '../../repo/types'
import { useRepository } from '../../repo/RepositoryContext'
import { useUiStore } from '../../store/uiStore'
import { PromptDialog } from '../PromptDialog'
import { ConfirmDialog } from '../ConfirmDialog'

/**
 * "체크 항목 관리" (principles 5–7). 생성 / 미캔 are seeded defaults: they can be
 * renamed and reordered but not hidden or deleted. User-defined stages support
 * rename / reorder / hide / permanent delete (delete is confirmed because it
 * also drops existing check records).
 */
export function StatusColumnsSettings({
  planId,
  columns,
}: {
  planId: string
  columns: StatusColumn[]
}) {
  const repo = useRepository()
  const showToast = useUiStore((s) => s.showToast)
  const [adding, setAdding] = useState(false)
  const [renameTarget, setRenameTarget] = useState<StatusColumn | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StatusColumn | null>(null)

  const ordered = [...columns].sort((a, b) => a.order - b.order)

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...ordered]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    await repo.reorderStatusColumns(
      planId,
      next.map((c) => c.id),
    )
  }

  return (
    <div className="stage-settings">
      <ul className="stage-list">
        {ordered.map((col, i) => (
          <li key={col.id} className={`stage-row${col.isVisible ? '' : ' is-hidden'}`}>
            <label
              className="stage-check"
              title={col.isDefault ? '기본 단계 (항상 표시)' : '목록에 표시'}
            >
              <input
                type="checkbox"
                checked={col.isVisible}
                disabled={col.isDefault}
                onChange={(e) =>
                  repo.updateStatusColumn(col.id, { isVisible: e.target.checked })
                }
              />
            </label>
            <span className="stage-name">
              {col.name}
              {col.isDefault && <span className="badge">기본</span>}
            </span>

            <div className="stage-actions">
              <button
                className="icon-btn"
                title="위로"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                title="아래로"
                disabled={i === ordered.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button className="btn btn-xs" onClick={() => setRenameTarget(col)}>
                수정
              </button>
              {!col.isDefault && (
                <button
                  className="btn btn-xs btn-danger-ghost"
                  onClick={() => setDeleteTarget(col)}
                >
                  삭제
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button className="btn btn-sm" onClick={() => setAdding(true)}>
        + 체크 항목 추가
      </button>

      {adding && (
        <PromptDialog
          title="체크 항목 추가"
          label="단계 이름"
          placeholder="예: Adobe Stock, Freepik, 검수…"
          confirmLabel="추가"
          onCancel={() => setAdding(false)}
          onConfirm={async (name) => {
            setAdding(false)
            await repo.createStatusColumn({ planId, name })
            showToast(`"${name}" 체크 항목을 추가했습니다.`)
          }}
        />
      )}

      {renameTarget && (
        <PromptDialog
          title="단계 이름 변경"
          initialValue={renameTarget.name}
          onCancel={() => setRenameTarget(null)}
          onConfirm={async (name) => {
            await repo.updateStatusColumn(renameTarget.id, { name })
            setRenameTarget(null)
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`"${deleteTarget.name}" 체크 항목을 삭제하시겠습니까?`}
          danger
          confirmLabel="영구 삭제"
          message={
            <>
              이 단계에 저장된 기존 체크 기록도 함께 삭제되며 되돌릴 수 없습니다.
              <br />
              데이터를 유지하려면 왼쪽 <b>체크를 해제</b>해 숨기세요.
            </>
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await repo.deleteStatusColumn(deleteTarget.id)
            setDeleteTarget(null)
            showToast('체크 항목을 삭제했습니다.')
          }}
        />
      )}
    </div>
  )
}
