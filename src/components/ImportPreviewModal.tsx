import { useRef, useState } from 'react'
import type { Plan, PlanSnapshot } from '../repo/types'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { periodKind } from '../domain/periods'
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
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  const kind = periodKind(plan.type)

  const onFile = async (file: File) => {
    setFileName(file.name)
    setPhase('parsing')
    try {
      const result = await parseImportFile(file, {
        kind,
        existingKeywords: snapshot.keywords.map((k) => ({
          period: k.period,
          keyword: k.keyword,
        })),
        statusColumns: snapshot.statusColumns.map((c) => ({ id: c.id, name: c.name })),
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
    const rows = skipDuplicates
      ? preview.rows.filter((r) => !r.isDuplicate)
      : preview.rows

    const created = await repo.createKeywords(
      rows.map((r) => ({ planId: plan.id, period: r.period, keyword: r.keyword })),
    )

    // Apply extended-column check values, grouped per status column.
    const byColumn = new Map<string, string[]>()
    created.forEach((kw, i) => {
      const statuses = rows[i]?.statuses ?? {}
      for (const [colId, checked] of Object.entries(statuses)) {
        if (checked) {
          const arr = byColumn.get(colId) ?? []
          arr.push(kw.id)
          byColumn.set(colId, arr)
        }
      }
    })
    for (const [colId, ids] of byColumn) {
      await repo.setKeywordStatusBulk(ids, colId, true)
    }

    showToast(`${created.length}개 키워드를 가져왔습니다.`)
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
              disabled={preview.rows.length === 0}
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
            <b>Keyword</b> 열이 필요합니다. 확장 열(생성 / 미캔 / 사용자 단계)이 있으면
            자동으로 인식합니다.
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
              새 항목 <b>{skipDuplicates ? preview.newCount : preview.rows.length}</b>
            </li>
            <li className={preview.duplicateCount ? 'warn' : ''}>
              중복 가능 <b>{preview.duplicateCount}</b>
              {preview.duplicateCount > 0 && (
                <label className="dup-toggle">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                  중복 제외
                </label>
              )}
            </li>
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
