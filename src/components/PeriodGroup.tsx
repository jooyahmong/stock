import { useState } from 'react'
import type { KeywordItem, StatusColumn } from '../repo/types'
import type { PeriodGroup as PeriodGroupData } from '../domain/grouping'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { computeProgress } from '../domain/progress'
import { KeywordRow } from './KeywordRow'

export function PeriodGroup({
  group,
  statusColumns,
  statusMap,
  onRun,
  onEditPeriod,
}: {
  group: PeriodGroupData
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  onRun: (keyword: string, keywordItemId: string) => void
  onEditPeriod: (period: string) => void
}) {
  const repo = useRepository()
  const planIdOfGroup = group.items[0]?.planId
  const activePlanId = useUiStore((s) => s.activePlanId)

  const [adding, setAdding] = useState(false)
  const [newKw, setNewKw] = useState('')

  const planId = planIdOfGroup ?? activePlanId ?? ''
  const prog = computeProgress({ statusColumns, statusMap }, group.items)

  const addKeyword = async () => {
    const value = newKw.trim()
    if (!value || !planId) return
    await repo.createKeyword({ planId, period: group.period, keyword: value })
    setNewKw('')
  }

  return (
    <section className="period-group">
      <header className="pg-head">
        <div className="pg-title">
          <button
            className="pg-label-btn"
            title="기간 수정"
            onClick={() => onEditPeriod(group.period)}
          >
            <span className="pg-label">{group.label}</span>
            <span className="pg-sub">{group.subLabel}</span>
          </button>
          <span className="pg-count">{group.items.length}</span>
        </div>
        <div className="pg-progress">
          {prog.map((p) => (
            <span key={p.column.id} className="pg-prog-chip" title={p.column.name}>
              {p.column.name} {p.done}/{p.total}
            </span>
          ))}
        </div>
      </header>

      <div className="pg-rows">
        {group.items.map((item: KeywordItem) => (
          <KeywordRow
            key={item.id}
            item={item}
            statusColumns={statusColumns}
            statusMap={statusMap}
            onRun={onRun}
          />
        ))}
        {group.items.length === 0 && (
          <p className="pg-empty">이 기간에 키워드가 없습니다.</p>
        )}
      </div>

      {adding ? (
        <div className="pg-add">
          <input
            autoFocus
            value={newKw}
            placeholder="키워드 입력 후 Enter"
            onChange={(e) => setNewKw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addKeyword()
              if (e.key === 'Escape') {
                setNewKw('')
                setAdding(false)
              }
            }}
            onBlur={() => {
              if (!newKw.trim()) setAdding(false)
            }}
          />
          <button className="btn btn-sm btn-primary" onMouseDown={addKeyword}>
            추가
          </button>
        </div>
      ) : (
        <button className="pg-add-btn" onClick={() => setAdding(true)}>
          + 키워드 추가
        </button>
      )}
    </section>
  )
}
