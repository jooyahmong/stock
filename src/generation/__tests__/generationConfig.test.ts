import { describe, it, expect, beforeEach } from 'vitest'
import {
  GenerationConfigStore,
  defaultUsableProvider,
  hasUsableProvider,
  providerIsUsable,
} from '../generationConfig'

class MemStorage implements Storage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  clear() {
    this.m.clear()
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
}

let storage: MemStorage
let store: GenerationConfigStore

beforeEach(() => {
  storage = new MemStorage()
  store = new GenerationConfigStore(storage)
})

describe('GenerationConfigStore', () => {
  it('defaults to my-gpt with no providers', () => {
    expect(store.getSnapshot()).toEqual({
      defaultGenerationMode: 'my-gpt',
      providers: [],
    })
  })

  it('persists the default generation mode and notifies subscribers', () => {
    let hits = 0
    store.subscribe(() => hits++)
    store.setDefaultMode('direct')
    expect(hits).toBe(1)
    expect(store.getSnapshot().defaultGenerationMode).toBe('direct')
    // survives a reload
    const reloaded = new GenerationConfigStore(storage)
    expect(reloaded.getSnapshot().defaultGenerationMode).toBe('direct')
  })

  it('first saved provider becomes default + enabled', () => {
    const p = store.saveProvider({
      name: 'My OpenAI',
      providerType: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-image-1',
    })
    expect(p.isDefault).toBe(true)
    expect(p.enabled).toBe(true)
    expect(store.getSnapshot().providers).toHaveLength(1)
  })

  it('updates an existing provider by id without duplicating', () => {
    const p = store.saveProvider({
      name: 'A',
      providerType: 'openai',
      apiKey: 'sk-a',
      model: 'dall-e-3',
    })
    store.saveProvider({
      id: p.id,
      name: 'A renamed',
      providerType: 'openai',
      apiKey: 'sk-a2',
      model: 'gpt-image-1',
    })
    const list = store.getSnapshot().providers
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('A renamed')
    expect(list[0].apiKey).toBe('sk-a2')
  })

  it('removing the default promotes another provider', () => {
    const a = store.saveProvider({
      name: 'A',
      providerType: 'openai',
      apiKey: 'sk-a',
      model: 'm',
    })
    const b = store.saveProvider({
      name: 'B',
      providerType: 'openai',
      apiKey: 'sk-b',
      model: 'm',
    })
    store.removeProvider(a.id)
    const list = store.getSnapshot().providers
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(b.id)
    expect(list[0].isDefault).toBe(true)
  })

  it('tolerates a disabled / throwing storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    const s = new GenerationConfigStore(broken)
    expect(() => s.setDefaultMode('direct')).not.toThrow()
    expect(s.getSnapshot().defaultGenerationMode).toBe('direct') // in-memory
  })
})

describe('usable-provider selectors', () => {
  const base = {
    id: 'x',
    name: 'x',
    providerType: 'openai' as const,
    isDefault: true,
    createdAt: '',
    updatedAt: '',
  }
  it('needs enabled + apiKey + model', () => {
    expect(providerIsUsable({ ...base, apiKey: 'k', model: 'm', enabled: true })).toBe(true)
    expect(providerIsUsable({ ...base, apiKey: '', model: 'm', enabled: true })).toBe(false)
    expect(providerIsUsable({ ...base, apiKey: 'k', model: '', enabled: true })).toBe(false)
    expect(providerIsUsable({ ...base, apiKey: 'k', model: 'm', enabled: false })).toBe(false)
  })
  it('hasUsableProvider / defaultUsableProvider reflect config', () => {
    const cfg = {
      defaultGenerationMode: 'direct' as const,
      providers: [
        { ...base, id: '1', apiKey: '', model: 'm', enabled: true, isDefault: true },
        { ...base, id: '2', apiKey: 'k', model: 'm', enabled: true, isDefault: false },
      ],
    }
    expect(hasUsableProvider(cfg)).toBe(true)
    expect(defaultUsableProvider(cfg)?.id).toBe('2')
  })
})
