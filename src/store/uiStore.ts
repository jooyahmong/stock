import { create } from 'zustand'

/**
 * Ephemeral UI state only — never persistence. The selection checkboxes
 * (principle 4-1) live here: "selected" means "currently picked for a bulk
 * action", not "done". Work-status checkmarks are separate and go through the
 * repository.
 */

export type Filter =
  | { kind: 'all' }
  | { kind: 'status'; columnId: string; want: 'done' | 'todo' }

export interface ToastState {
  id: number
  message: string
  kind: 'info' | 'error'
}

interface UiState {
  activePlanId: string | null
  setActivePlanId: (id: string | null) => void

  selection: Set<string>
  toggleSelected: (id: string) => void
  setSelected: (id: string, value: boolean) => void
  selectMany: (ids: string[], value: boolean) => void
  clearSelection: () => void

  search: string
  setSearch: (s: string) => void

  filter: Filter
  setFilter: (f: Filter) => void

  toast: ToastState | null
  showToast: (message: string, kind?: 'info' | 'error') => void
  dismissToast: () => void
}

let toastSeq = 0

export const useUiStore = create<UiState>((set, get) => ({
  activePlanId: null,
  setActivePlanId: (id) =>
    set({ activePlanId: id, selection: new Set(), filter: { kind: 'all' }, search: '' }),

  selection: new Set(),
  toggleSelected: (id) => {
    const next = new Set(get().selection)
    next.has(id) ? next.delete(id) : next.add(id)
    set({ selection: next })
  },
  setSelected: (id, value) => {
    const next = new Set(get().selection)
    value ? next.add(id) : next.delete(id)
    set({ selection: next })
  },
  selectMany: (ids, value) => {
    const next = new Set(get().selection)
    for (const id of ids) (value ? next.add(id) : next.delete(id))
    set({ selection: next })
  },
  clearSelection: () => set({ selection: new Set() }),

  search: '',
  setSearch: (s) => set({ search: s }),

  filter: { kind: 'all' },
  setFilter: (f) => set({ filter: f }),

  toast: null,
  showToast: (message, kind = 'info') =>
    set({ toast: { id: ++toastSeq, message, kind } }),
  dismissToast: () => set({ toast: null }),
}))
