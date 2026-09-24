import { useState } from 'react'
import type { KeywordItem, PlanPurpose, StatusColumn } from '../repo/types'
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
  purpose = 'stock',
  highlighted = false,
}: {
  group: PeriodGroupData
  statusColumns: StatusColumn[]
  statusMap: Record<string, boolean>
  onRun: (keyword: string, keywordItemId: string) => void
  onEditPeriod: (period: string) => void
  purpose?: PlanPurpose
  /** Briefly highlighted after Plan search navigates here — see App.tsx. */
  highlighted?: boolean
}) {
  const repo = useRepository()
  const planIdOfGroup = group.items[0]?.planId
  const activePlanId = useUiStore((s) => s.activePlanId)
  const isPlanner = purpose === 'planner'

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
    <section
      id={`pg-${group.period}`}
      className={`period-group${highlighted ? ' is-highlighted' : ''}`}
    >
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
            purpose={purpose}
          />
        ))}
        {group.items.length === 0 && (
          <p className="pg-empty">
            {isPlanner ? '이 날짜에 할 일이 없습니다.' : '이 기간에 키워드가 없습니다.'}
          </p>
        )}
      </div>

      {adding ? (
        <div className="pg-add">
          <input
            autoFocus
            value={newKw}
            placeholder={isPlanner ? '할 일 입력 후 Enter' : '키워드 입력 후 Enter'}
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
          {isPlanner ? '+ 할 일 추가' : '+ 키워드 추가'}
        </button>
      )}
    </section>
  )
}
