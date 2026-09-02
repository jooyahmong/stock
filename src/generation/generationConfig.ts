import type { GenerationMode, ImageProvider, ProviderType } from './types'

/**
 * Direct Generate configuration store.
 *
 * Deliberately NOT part of the app `Repository` (API config must not be coupled
 * to the keyword core / storage layer). Backed by localStorage, per browser.
 *
 * SYNC POLICY (future Sync Mode):
 *  - LOCAL ONLY, never uploaded to an account / Cloudflare D1, never in an Excel
 *    backup:  `apiKey`  (a personal secret; re-entered on each device).
 *  - Syncable later:  `defaultGenerationMode`, provider `name` / `providerType`
 *    / `model`, and the My GPT list (name + chatgpt.com URL — not secrets).
 * Keep any real sync implementation splitting `apiKey` out from the rest.
 */

const STORAGE_KEY = 'woojoo.generation.config.v1'

export interface GenerationConfig {
  defaultGenerationMode: GenerationMode
  providers: ImageProvider[]
}

export const DEFAULT_CONFIG: GenerationConfig = {
  defaultGenerationMode: 'my-gpt',
  providers: [],
}

export interface SaveProviderInput {
  id?: string
  name: string
  providerType: ProviderType
  apiKey: string
  model: string
  enabled?: boolean
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'gp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export class GenerationConfigStore {
  private storage: Storage | undefined
  private cache: GenerationConfig
  private listeners = new Set<() => void>()

  constructor(storage?: Storage) {
    this.storage =
      storage ??
      (typeof localStorage !== 'undefined' ? localStorage : undefined)
    this.cache = this.read()
  }

  private read(): GenerationConfig {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY)
      if (!raw) return { ...DEFAULT_CONFIG }
      const parsed = JSON.parse(raw) as Partial<GenerationConfig>
      return {
        defaultGenerationMode:
          parsed.defaultGenerationMode === 'direct' ? 'direct' : 'my-gpt',
        providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  private write(next: GenerationConfig) {
    this.cache = next
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* private mode / disabled storage — keep in-memory copy only */
    }
    this.listeners.forEach((l) => {
      try {
        l()
      } catch (err) {
        console.error('generation config listener failed', err)
      }
    })
  }

  // useSyncExternalStore-compatible
  getSnapshot = (): GenerationConfig => this.cache
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setDefaultMode(mode: GenerationMode) {
    this.write({ ...this.cache, defaultGenerationMode: mode })
  }

  saveProvider(input: SaveProviderInput): ImageProvider {
    const ts = new Date().toISOString()
    const providers = [...this.cache.providers]
    const idx = input.id ? providers.findIndex((p) => p.id === input.id) : -1

    let saved: ImageProvider
    if (idx >= 0) {
      saved = {
        ...providers[idx],
        name: input.name.trim() || providers[idx].name,
        providerType: input.providerType,
        apiKey: input.apiKey,
        model: input.model.trim(),
        enabled: input.enabled ?? providers[idx].enabled,
        updatedAt: ts,
      }
      providers[idx] = saved
    } else {
      saved = {
        id: newId(),
        name: input.name.trim() || 'My API',
        providerType: input.providerType,
        apiKey: input.apiKey,
        model: input.model.trim(),
        isDefault: providers.length === 0,
        enabled: input.enabled ?? true,
        createdAt: ts,
        updatedAt: ts,
      }
      providers.push(saved)
    }
    if (!providers.some((p) => p.isDefault) && providers[0]) {
      providers[0] = { ...providers[0], isDefault: true }
    }
    this.write({ ...this.cache, providers })
    return saved
  }

  setEnabled(id: string, enabled: boolean) {
    this.write({
      ...this.cache,
      providers: this.cache.providers.map((p) =>
        p.id === id ? { ...p, enabled, updatedAt: new Date().toISOString() } : p,
      ),
    })
  }

  setDefaultProvider(id: string) {
    this.write({
      ...this.cache,
      providers: this.cache.providers.map((p) => ({
        ...p,
        isDefault: p.id === id,
      })),
    })
  }

  removeProvider(id: string) {
    const providers = this.cache.providers.filter((p) => p.id !== id)
    if (!providers.some((p) => p.isDefault) && providers[0]) {
      providers[0] = { ...providers[0], isDefault: true }
    }
    this.write({ ...this.cache, providers })
  }
}

// -- selectors (pure) -------------------------------------------------------

export function providerIsUsable(p: ImageProvider): boolean {
  return p.enabled && p.apiKey.trim().length > 0 && p.model.trim().length > 0
}

export function defaultUsableProvider(cfg: GenerationConfig): ImageProvider | null {
  const usable = cfg.providers.filter(providerIsUsable)
  if (usable.length === 0) return null
  return usable.find((p) => p.isDefault) ?? usable[0]
}

export function hasUsableProvider(cfg: GenerationConfig): boolean {
  return defaultUsableProvider(cfg) !== null
}
