import type { PlanSnapshot } from '../repo/types'
import { computeProgress } from '../domain/progress'

export function ProgressPanel({ snapshot }: { snapshot: PlanSnapshot }) {
  const total = snapshot.keywords.length
  const progress = computeProgress(snapshot, snapshot.keywords)

  if (total === 0) return null

  return (
    <div className="progress-panel">
      <div className="pp-total">
        <strong>{total}</strong> Keywords
      </div>
      <div className="pp-bars">
        {progress.map((p) => (
          <div key={p.column.id} className="pp-item">
            <div className="pp-item-head">
              <span>{p.column.name}</span>
              <span className="pp-frac">
                {p.done} / {p.total}
              </span>
            </div>
            <div className="pp-track">
              <div
                className="pp-fill"
                style={{ width: `${Math.round(p.ratio * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
