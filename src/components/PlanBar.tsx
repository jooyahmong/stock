import { useState } from 'react'
import type { Plan, PlanPurpose } from '../repo/types'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { Modal } from './Modal'
import { PromptDialog } from './PromptDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { planPurpose } from '../domain/planPurpose'

const PURPOSE_SUFFIX: Record<PlanPurpose, string> = { stock: '', planner: ' · 일정' }

// V1 has no date-structure (`type`) picker — every plan is date(365) based.
// `purpose` ('stock' | 'planner') is the only choice offered when creating a
// plan; see docs/specs/general-planner.md.
// PlanType('weekly'|'monthly'|'custom')·순수 함수는 재추가 대비 그대로 둔다.

export function PlanBar({
  plans,
  activePlan,
}: {
  plans: Plan[]
  activePlan: Plan | null
}) {
  const repo = useRepository()
  const setActivePlanId = useUiStore((s) => s.setActivePlanId)
  const showToast = useUiStore((s) => s.showToast)

  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="plan-bar">
      <div className="plan-picker">
        {plans.length > 1 ? (
          <select
            className="plan-select"
            value={activePlan?.id ?? ''}
            onChange={(e) => setActivePlanId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{PURPOSE_SUFFIX[planPurpose(p)]}
              </option>
            ))}
          </select>
        ) : (
          activePlan && (
            <span className="plan-current">
              {activePlan.name}
              {PURPOSE_SUFFIX[planPurpose(activePlan)]}
            </span>
          )
        )}

        <button className="btn btn-sm" onClick={() => setCreating(true)}>
          + 새 계획
        </button>
        {activePlan && (
          <>
            <button
              className="btn btn-sm"
              onClick={() => setRenaming(true)}
              title="계획 이름 변경"
            >
              이름
            </button>
            <button
              className="btn btn-sm btn-danger-ghost"
              onClick={() => setDeleting(true)}
              title="계획 삭제"
            >
              삭제
            </button>
          </>
        )}
      </div>

      {creating && (
        <NewPlanDialog
          onCancel={() => setCreating(false)}
          onConfirm={async (name, purpose) => {
            setCreating(false)
            const plan = await repo.createPlan({ name, type: '365', purpose })
            setActivePlanId(plan.id)
            showToast(
              purpose === 'planner' ? '일정 계획을 만들었습니다.' : '계획을 만들었습니다.',
            )
          }}
        />
      )}

      {renaming && activePlan && (
        <PromptDialog
          title="계획 이름 변경"
          initialValue={activePlan.name}
          onCancel={() => setRenaming(false)}
          onConfirm={async (name) => {
            setRenaming(false)
            await repo.renamePlan(activePlan.id, name)
          }}
        />
      )}

      {deleting && activePlan && (
        <ConfirmDialog
          title="계획 삭제"
          danger
          confirmLabel="삭제"
          message={
            <>
              <b>{activePlan.name}</b> 계획과 그 안의 모든 키워드·체크 항목·상태
              기록이 삭제됩니다. 되돌릴 수 없습니다.
            </>
          }
          onCancel={() => setDeleting(false)}
          onConfirm={async () => {
            setDeleting(false)
            await repo.deletePlan(activePlan.id)
            setActivePlanId(null)
            showToast('계획을 삭제했습니다.')
          }}
        />
      )}
    </div>
  )
}

const PURPOSE_OPTIONS: { purpose: PlanPurpose; label: string; hint: string }[] = [
  { purpose: 'stock', label: 'Stock 제작', hint: '스톡 키워드·체크 항목(생성/미캔)으로 시작' },
  { purpose: 'planner', label: '일정 / 다이어리', hint: '빈 Planner — 할 일을 날짜에 바로 추가' },
]

function NewPlanDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  // V1은 날짜(365) 구조 고정, purpose(용도)만 선택한다.
  onConfirm: (name: string, purpose: PlanPurpose) => void
}) {
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState<PlanPurpose>('stock')
  const submit = () => {
    if (name.trim()) onConfirm(name.trim(), purpose)
  }
  return (
    <Modal
      title="새 계획 만들기"
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!name.trim()}
          >
            만들기
          </button>
        </>
      }
    >
      <label className="field-label">계획 이름</label>
      <input
        className="field-input"
        autoFocus
        value={name}
        placeholder={purpose === 'planner' ? '예: 2027 일정' : '예: 2027 봄 시즌 스톡'}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />

      <label className="field-label">용도</label>
      <div className="plan-purpose-options">
        {PURPOSE_OPTIONS.map((o) => (
          <label key={o.purpose} className="gs-radio">
            <input
              type="radio"
              name="plan-purpose"
              checked={purpose === o.purpose}
              onChange={() => setPurpose(o.purpose)}
            />
            <span>
              <b>{o.label}</b>
              <span className="hint"> — {o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="hint">날짜(YYYY-MM-DD) 기반 계획으로 만들어집니다.</p>
    </Modal>
  )
}
