import { useEffect } from 'react'
import { useUiStore } from '../store/uiStore'

export function Toast() {
  const toast = useUiStore((s) => s.toast)
  const dismiss = useUiStore((s) => s.dismissToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(dismiss, toast.kind === 'error' ? 5000 : 2600)
    return () => clearTimeout(t)
  }, [toast, dismiss])

  if (!toast) return null
  return (
    <div
      className={`toast ${toast.kind === 'error' ? 'toast-error' : ''}`}
      role="status"
      onClick={dismiss}
    >
      {toast.message}
    </div>
  )
}
