import { describe, it, expect, vi } from 'vitest'
import { createDirectGenerationService } from '../directGenerationService'
import { GenerationError, type ImageGenerationProvider, type ImageProvider } from '../types'
import type { GenerationConfig } from '../generationConfig'

function provider(over: Partial<ImageProvider>): ImageProvider {
  return {
    id: 'p1',
    name: 'Fake',
    providerType: 'openai',
    apiKey: 'sk-x',
    model: 'gpt-image-1',
    isDefault: true,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

const fakeAdapter = (over: Partial<ImageGenerationProvider> = {}): ImageGenerationProvider => ({
  id: 'p1',
  name: 'Fake',
  testConnection: vi.fn(async () => ({ ok: true, message: 'ok' })),
  generateImage: vi.fn(async () => ({
    dataUrl: 'data:image/png;base64,AAAA',
    model: 'gpt-image-1',
    provider: 'Fake',
    createdAt: '',
  })),
  ...over,
})

describe('DirectGenerationService', () => {
  it('delegates generate() to the resolved provider adapter', async () => {
    const adapter = fakeAdapter()
    const svc = createDirectGenerationService(() => adapter)
    const cfg: GenerationConfig = {
      defaultGenerationMode: 'direct',
      providers: [provider({})],
    }
    const img = await svc.generate(cfg, { prompt: '벚꽃' })
    expect(img.dataUrl).toContain('base64')
    expect(adapter.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: '벚꽃' }),
    )
  })

  it('throws a friendly error when no provider is usable', async () => {
    const svc = createDirectGenerationService(() => fakeAdapter())
    const cfg: GenerationConfig = {
      defaultGenerationMode: 'direct',
      providers: [provider({ apiKey: '' })],
    }
    await expect(svc.generate(cfg, { prompt: 'x' })).rejects.toBeInstanceOf(
      GenerationError,
    )
    expect(svc.hasUsableProvider(cfg)).toBe(false)
  })

  it('resolveProviderRecord picks the default usable provider', () => {
    const svc = createDirectGenerationService(() => fakeAdapter())
    const cfg: GenerationConfig = {
      defaultGenerationMode: 'direct',
      providers: [
        provider({ id: 'a', isDefault: false }),
        provider({ id: 'b', isDefault: true }),
      ],
    }
    expect(svc.resolveProviderRecord(cfg)?.id).toBe('b')
  })

  it('surfaces adapter generate() failures', async () => {
    const adapter = fakeAdapter({
      generateImage: vi.fn(async () => {
        throw new GenerationError('CORS blocked')
      }),
    })
    const svc = createDirectGenerationService(() => adapter)
    const cfg: GenerationConfig = {
      defaultGenerationMode: 'direct',
      providers: [provider({})],
    }
    await expect(svc.generate(cfg, { prompt: 'x' })).rejects.toThrow('CORS blocked')
  })
})
