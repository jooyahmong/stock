import { useEffect, useState } from 'react'

/**
 * Work-status checkbox. Persistence goes through the repository and is async
 * (IndexedDB now, D1 later), so the box holds an optimistic local value and
 * reconciles when the stored value catches up — no flicker, no lost clicks.
 */
export function StatusCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: (next: boolean) => void
}) {
  const [value, setValue] = useState(checked)
  useEffect(() => setValue(checked), [checked])

  return (
    <label className="status-check">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => {
          setValue(e.target.checked)
          onToggle(e.target.checked)
        }}
      />
      <span>{label}</span>
    </label>
  )
}
