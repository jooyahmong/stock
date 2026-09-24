import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeywordItem, PlanPurpose } from '../repo/types'

const MAX_RESULTS = 25

/**
 * Full-plan search — separate from the Toolbar's in-list-view search/filter
 * (`uiStore.search`/`filter`, month-scoped). This one always searches every
 * item in the currently active plan, regardless of which month/view is on
 * screen. See docs/specs/stock-planner.md / general-planner.md → "Plan
 * search". No new storage: `items` is the same `PlanSnapshot.keywords` App
 * already loads for the active plan, which is already sorted by
 * (period, sortOrder) — filtering preserves that order.
 */
export function PlanSearch({
  items,
  purpose,
  onNavigate,
}: {
  items: KeywordItem[]
  purpose: PlanPurpose
  onNavigate: (period: string) => void
}) {
  const [query, setQuery] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const itemNoun = purpose === 'planner' ? '할 일' : '키워드'

  const trimmed = query.trim()
  const results = useMemo(() => {
    if (!trimmed) return []
    const needle = trimmed.toLowerCase()
    return items.filter((k) => k.keyword.toLowerCase().includes(needle))
  }, [items, trimmed])

  const open = trimmed.length > 0 && !dismissed

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDismissed(true)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  return (
    <div className="plan-search" ref={wrapRef}>
      <div className="plan-search-box">
        <span className="plan-search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          className="plan-search-input"
          placeholder="현재 계획 검색..."
          aria-label={`현재 계획 ${itemNoun} 검색`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setDismissed(false)
          }}
          onFocus={() => setDismissed(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              // type="search" has a native "clear value on Escape" default
              // action in Chromium — block it so Escape only closes the
              // result panel, matching "clicking a result" behavior (which
              // also keeps the query so refocusing reopens the same results).
              e.preventDefault()
              setDismissed(true)
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="plan-search-clear"
            aria-label="검색어 지우기"
            onClick={() => {
              setQuery('')
              setDismissed(false)
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="plan-search-results">
          {results.length === 0 ? (
            <p className="plan-search-empty">현재 계획에서 검색 결과가 없습니다.</p>
          ) : (
            <>
              <ul className="plan-search-list">
                {results.slice(0, MAX_RESULTS).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="plan-search-result"
                      onClick={() => {
                        setDismissed(true)
                        onNavigate(item.period)
                      }}
                    >
                      <span className="plan-search-result-period">{item.period}</span>
                      <span className="plan-search-result-text">{item.keyword}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="plan-search-count">총 {results.length}개 결과</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
