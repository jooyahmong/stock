import { useState } from 'react'
import type { Plan, PlanType } from '../repo/types'
import { useRepository } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { Modal } from './Modal'
import { PromptDialog } from './PromptDialog'
import { ConfirmDialog } from './ConfirmDialog'

// V1은 계획 유형 선택이 없다. 모든 계획은 날짜(365) 기반.
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
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          activePlan && <span className="plan-current">{activePlan.name}</span>
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
          onConfirm={async (name, type) => {
            setCreating(false)
            const plan = await repo.createPlan({ name, type })
            setActivePlanId(plan.id)
            showToast('계획을 만들었습니다.')
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

function NewPlanDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  // V1은 유형 선택 없이 항상 날짜(365) 계획을 만든다.
  onConfirm: (name: string, type: PlanType) => void
}) {
  const [name, setName] = useState('')
  const submit = () => {
    if (name.trim()) onConfirm(name.trim(), '365')
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
        placeholder="예: 2027 봄 시즌 스톡"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <p className="hint">날짜(YYYY-MM-DD) 기반 계획으로 만들어집니다.</p>
    </Modal>
  )
}
