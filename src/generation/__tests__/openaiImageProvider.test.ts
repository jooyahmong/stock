import { describe, it, expect, vi, afterEach } from 'vitest'
import { OpenAiImageProvider } from '../providers/openaiImageProvider'
import { GenerationError, type ImageProvider } from '../types'

function record(over: Partial<ImageProvider> = {}): ImageProvider {
  return {
    id: 'p1',
    name: 'OpenAI',
    providerType: 'openai',
    apiKey: 'sk-test',
    model: 'gpt-image-1',
    isDefault: true,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

afterEach(() => vi.unstubAllGlobals())

/** Pull the JSON body string out of the first fetch() call. */
function reqBody(fetchMock: { mock: { calls: unknown[][] } }): string {
  const init = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined
  return init?.body ?? '{}'
}

describe('OpenAiImageProvider.generateImage', () => {
  it('returns a PNG data URL from a b64_json response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'QUJD' }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const img = await new OpenAiImageProvider(record()).generateImage({ prompt: '벚꽃' })
    expect(img.dataUrl).toBe('data:image/png;base64,QUJD')
    expect(img.model).toBe('gpt-image-1')
    // gpt-image-* must NOT send response_format
    const body = JSON.parse(reqBody(fetchMock))
    expect(body.response_format).toBeUndefined()
    expect(body).toMatchObject({ model: 'gpt-image-1', prompt: '벚꽃', n: 1 })
  })

  it('requests b64_json for dall-e models', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'QQ==' }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    await new OpenAiImageProvider(record({ model: 'dall-e-3' })).generateImage({
      prompt: 'x',
    })
    const body = JSON.parse(reqBody(fetchMock))
    expect(body.response_format).toBe('b64_json')
  })

  it('wraps an API error body in GenerationError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'content policy' } }),
      })),
    )
    await expect(
      new OpenAiImageProvider(record()).generateImage({ prompt: 'x' }),
    ).rejects.toThrowError(/400.*content policy/)
  })

  it('explains a browser CORS/network block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(
      new OpenAiImageProvider(record()).generateImage({ prompt: 'x' }),
    ).rejects.toThrowError(/CORS|프록시/)
  })
})

describe('OpenAiImageProvider.testConnection', () => {
  it('reports 401 as an invalid key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })))
    const res = await new OpenAiImageProvider(record()).testConnection()
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/401/)
  })

  it('reports success on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })))
    const res = await new OpenAiImageProvider(record()).testConnection()
    expect(res.ok).toBe(true)
  })

  it('requires an api key', async () => {
    const res = await new OpenAiImageProvider(record({ apiKey: '' })).testConnection()
    expect(res.ok).toBe(false)
  })
})

describe('exported error type', () => {
  it('is a GenerationError', () => {
    expect(new GenerationError('x')).toBeInstanceOf(Error)
  })
})
