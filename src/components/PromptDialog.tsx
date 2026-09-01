import { useState } from 'react'
import { Modal } from './Modal'

export function PromptDialog({
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel = '저장',
  onConfirm,
  onCancel,
}: {
  title: string
  label?: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const submit = () => {
    const v = value.trim()
    if (v) onConfirm(v)
  }
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            취소
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {label && <label className="field-label">{label}</label>}
      <input
        className="field-input"
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
      />
    </Modal>
  )
}
