import type { PlanSnapshot } from '../repo/types'
import { useUiStore } from '../store/uiStore'

export function Toolbar({
  snapshot,
  visibleCount,
  allVisibleSelected,
  onToggleSelectAllVisible,
  hideSelection,
}: {
  snapshot: PlanSnapshot
  visibleCount: number
  allVisibleSelected: boolean
  onToggleSelectAllVisible: (checked: boolean) => void
  /** Planner plans don't offer bulk selection — see docs/specs/general-planner.md §6. */
  hideSelection?: boolean
}) {
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)
  const filter = useUiStore((s) => s.filter)
  const setFilter = useUiStore((s) => s.setFilter)

  const visibleCols = snapshot.statusColumns.filter((c) => c.isVisible)
  const filterValue =
    filter.kind === 'all' ? 'all' : `${filter.want}:${filter.columnId}`

  const onFilterChange = (value: string) => {
    if (value === 'all') return setFilter({ kind: 'all' })
    const [want, columnId] = value.split(':')
    setFilter({ kind: 'status', columnId, want: want as 'done' | 'todo' })
  }

  return (
    <div className="toolbar">
      {!hideSelection && (
        <label className="select-all" title="현재 보이는 키워드를 모두 선택">
          <input
            type="checkbox"
            checked={visibleCount > 0 && allVisibleSelected}
            disabled={visibleCount === 0}
            onChange={(e) => onToggleSelectAllVisible(e.target.checked)}
          />
          전체 선택
        </label>
      )}

      <input
        className="search"
        type="search"
        placeholder="키워드 / 날짜 검색…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        className="filter-select"
        value={filterValue}
        onChange={(e) => onFilterChange(e.target.value)}
      >
        <option value="all">전체</option>
        {visibleCols.map((c) => (
          <optgroup key={c.id} label={c.name}>
            <option value={`todo:${c.id}`}>{c.name} 미완료</option>
            <option value={`done:${c.id}`}>{c.name} 완료</option>
          </optgroup>
        ))}
      </select>
    </div>
  )
}

export function PlanActions({
  onOpenImport, onOpenSettings, onAddPeriod, periodNoun,
  onDownloadTemplate, onFullExport, onOpenGpt,
}: {
  onOpenImport: () => void
  onOpenSettings: () => void
  onAddPeriod: () => void
  periodNoun: string
  onDownloadTemplate: () => void
  onFullExport: () => void
  onOpenGpt?: () => void
}) {
  return (
    <div className="plan-actions" role="group" aria-label="계획 도구">
      {onOpenGpt && (
        <button
          className="btn btn-sm btn-gpt"
          onClick={onOpenGpt}
          title="기본 생성 사이트를 새 탭으로 열기"
        >
          생성 사이트 열기
        </button>
      )}
      <button className="btn btn-sm" onClick={onAddPeriod}>
        + {periodNoun} 추가
      </button>
      <button className="btn btn-sm" onClick={onDownloadTemplate}>
        Template
      </button>
      <button className="btn btn-sm" onClick={onOpenImport}>
        Import Excel
      </button>
      <button className="btn btn-sm" onClick={onFullExport}>
        Full Export
      </button>
      <button className="btn btn-sm" onClick={onOpenSettings} title="설정">
        ⚙ 설정
      </button>
    </div>
  )
}
