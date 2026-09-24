import { useRef, useState } from 'react'
import type { Plan, PlanSnapshot } from '../repo/types'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { periodKind } from '../domain/periods'
import { planPurpose, itemLabelFor } from '../domain/planPurpose'
import { parseImportFile, type ImportPreview } from '../domain/excel'
import { Modal } from './Modal'

type Phase = 'pick' | 'parsing' | 'preview' | 'importing'

export function ImportPreviewModal({
  plan,
  snapshot,
  onClose,
}: {
  plan: Plan
  snapshot: PlanSnapshot
  onClose: () => void
}) {
  const repo = useRepository()
  const showToast = useUiStore((s) => s.showToast)
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('pick')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  // Mirror mode: also remove keywords that the file no longer contains.
  const [deleteMissing, setDeleteMissing] = useState(false)

  const kind = periodKind(plan.type)
  const itemLabel = itemLabelFor(planPurpose(plan))

  const onFile = async (file: File) => {
    setFileName(file.name)
    setPhase('parsing')
    try {
      const result = await parseImportFile(file, {
        kind,
        existingKeywords: snapshot.keywords.map((k) => ({
          id: k.id,
          period: k.period,
          keyword: k.keyword,
        })),
        statusColumns: snapshot.statusColumns.map((c) => ({ id: c.id, name: c.name })),
        itemLabel,
      })
      setPreview(result)
      setPhase('preview')
    } catch (err) {
      console.error(err)
      showToast('파일을 읽지 못했습니다. Excel(.xlsx) 파일인지 확인하세요.', 'error')
      setPhase('pick')
    }
  }

  const runImport = async () => {
    if (!preview || !preview.ok) return
    setPhase('importing')

    const newRows = preview.rows.filter((r) => !r.matchedKeywordId)
    const matchedRows = preview.rows.filter((r) => r.matchedKeywordId)

    // 1. Create the brand-new keywords.
    const created = await repo.createKeywords(
      newRows.map((r) => ({ planId: plan.id, period: r.period, keyword: r.keyword })),
    )
    const newByColumn = new Map<string, string[]>()
    created.forEach((kw, i) => {
      for (const [colId, checked] of Object.entries(newRows[i]?.statuses ?? {})) {
        if (!checked) continue
        const arr = newByColumn.get(colId) ?? []
        arr.push(kw.id)
        newByColumn.set(colId, arr)
      }
    })
    for (const [colId, ids] of newByColumn) {
      await repo.setKeywordStatusBulk(ids, colId, true)
    }

    // 2. Update matched keywords in place — set every recognized column to the
    //    sheet value so un-checks are applied too, not only checks.
    for (const colId of preview.recognizedStatusColumnIds) {
      const on: string[] = []
      const off: string[] = []
      for (const r of matchedRows) {
        if (!(colId in r.statuses)) continue
        ;(r.statuses[colId] ? on : off).push(r.matchedKeywordId as string)
      }
      if (on.length) await repo.setKeywordStatusBulk(on, colId, true)
      if (off.length) await repo.setKeywordStatusBulk(off, colId, false)
    }

    // 3. Mirror mode: drop keywords the file no longer lists.
    let deleted = 0
    if (deleteMissing && preview.unmatchedExistingIds.length) {
      await repo.deleteKeywords(preview.unmatchedExistingIds)
      deleted = preview.unmatchedExistingIds.length
    }

    const parts = [`추가 ${created.length}`, `갱신 ${matchedRows.length}`]
    if (deleted) parts.push(`삭제 ${deleted}`)
    showToast(parts.join(' · '))
    onClose()
  }

  return (
    <Modal
      title="Excel Import"
      onClose={onClose}
      width={560}
      footer={
        phase === 'preview' && preview?.ok ? (
          <>
            <button className="btn" onClick={onClose}>
              취소
            </button>
            <button
              className="btn btn-primary"
              onClick={runImport}
              disabled={preview.rows.length === 0 && !deleteMissing}
            >
              가져오기
            </button>
          </>
        ) : (
          <button className="btn" onClick={onClose}>
            닫기
          </button>
        )
      }
    >
      {(phase === 'pick' || phase === 'parsing') && (
        <div className="import-pick">
          <p className="hint">
            기준 열은 <b>{preview?.periodHeader ?? kindLabel(kind)}</b>, 그리고{' '}
            <b>{itemLabel}</b> 열이 필요합니다. 확장 열(체크 항목)이 있으면
            자동으로 인식합니다.
          </p>
          <p className="hint">
            같은 <b>{kindLabel(kind)} + {itemLabel}</b> 는 기존 항목으로 보고 <b>체크값을
            그대로 덮어씁니다</b> (체크 해제도 반영). 없는 항목만 새로 추가됩니다.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
          {phase === 'parsing' && <p>분석 중… {fileName}</p>}
        </div>
      )}

      {phase === 'preview' && preview && !preview.ok && (
        <div className="import-error">
          <p className="error-text">{preview.fatalError}</p>
          <button
            className="btn btn-sm"
            onClick={() => {
              setPreview(null)
              setPhase('pick')
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            다른 파일 선택
          </button>
        </div>
      )}

      {(phase === 'preview' || phase === 'importing') && preview?.ok && (
        <div className="import-preview">
          <p className="import-file">{fileName}</p>
          <ul className="import-stats">
            <li>
              새로 추가 <b>{preview.newCount}</b>
            </li>
            <li>
              기존 갱신 <b>{preview.updateCount}</b>
            </li>
            {preview.unmatchedExistingIds.length > 0 && (
              <li className={deleteMissing ? 'warn' : ''}>
                파일에 없는 기존 항목 <b>{preview.unmatchedExistingIds.length}</b>
                <label className="dup-toggle">
                  <input
                    type="checkbox"
                    checked={deleteMissing}
                    onChange={(e) => setDeleteMissing(e.target.checked)}
                  />
                  삭제 (파일과 완전히 일치시키기)
                </label>
              </li>
            )}
            <li className={preview.errors.length ? 'warn' : ''}>
              오류 <b>{preview.errors.length}</b>
            </li>
            <li>빈 키워드/행 무시 <b>{preview.skippedEmpty}</b></li>
          </ul>

          {preview.recognizedStatusHeaders.length > 0 && (
            <p className="hint">
              인식된 체크 항목 열: {preview.recognizedStatusHeaders.join(', ')}
            </p>
          )}
          {preview.unknownStatusHeaders.length > 0 && (
            <p className="hint">
              무시된 열(일치하는 체크 항목 없음): {preview.unknownStatusHeaders.join(', ')}
            </p>
          )}

          {preview.errors.length > 0 && (
            <details className="import-errors">
              <summary>오류 {preview.errors.length}건 보기</summary>
              <ul>
                {preview.errors.slice(0, 50).map((e) => (
                  <li key={e.rowNumber}>
                    {e.rowNumber}행: {e.reason}
                  </li>
                ))}
                {preview.errors.length > 50 && <li>…</li>}
              </ul>
            </details>
          )}

          {phase === 'importing' && <p>가져오는 중…</p>}
        </div>
      )}
    </Modal>
  )
}

function kindLabel(kind: ReturnType<typeof periodKind>) {
  return kind === 'week' ? 'Week' : kind === 'month' ? 'Month' : 'Date'
}
