import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  GenerationConfigStore,
  DEFAULT_CONFIG,
  type GenerationConfig,
} from './generationConfig'
import {
  createDirectGenerationService,
  type DirectGenerationService,
} from './directGenerationService'

interface GenerationContextValue {
  store: GenerationConfigStore
  service: DirectGenerationService
}

const GenerationContext = createContext<GenerationContextValue | null>(null)

// Singletons — this layer owns its state, separate from the app Repository.
const sharedStore = new GenerationConfigStore()
const sharedService = createDirectGenerationService()

export function GenerationProvider({ children }: { children: ReactNode }) {
  return (
    <GenerationContext.Provider
      value={{ store: sharedStore, service: sharedService }}
    >
      {children}
    </GenerationContext.Provider>
  )
}

/** Safe even when the provider is absent (feature removed) — returns defaults. */
export function useGenerationConfig(): GenerationConfig {
  const ctx = useContext(GenerationContext)
  const store = ctx?.store
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : getDefault,
    store ? store.getSnapshot : getDefault,
  )
}

export function useGenerationStore(): GenerationConfigStore {
  const ctx = useContext(GenerationContext)
  if (!ctx) throw new Error('useGenerationStore requires <GenerationProvider>')
  return ctx.store
}

export function useDirectGenerationService(): DirectGenerationService {
  const ctx = useContext(GenerationContext)
  if (!ctx) throw new Error('useDirectGenerationService requires <GenerationProvider>')
  return ctx.service
}

const noopSubscribe = () => () => {}
const getDefault = () => DEFAULT_CONFIG
