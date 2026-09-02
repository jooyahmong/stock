import { describe, it, expect, vi, afterEach } from 'vitest'
import { GoogleImageProvider } from '../providers/googleImageProvider'
import type { ImageProvider } from '../types'

function record(over: Partial<ImageProvider> = {}): ImageProvider {
  return {
    id: 'p1',
    name: 'Google',
    providerType: 'google',
    apiKey: 'AIza-test',
    model: 'imagen-3.0-generate-002',
    isDefault: true,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

afterEach(() => vi.unstubAllGlobals())

function reqUrl(fetchMock: { mock: { calls: unknown[][] } }): string {
  return String(fetchMock.mock.calls[0]?.[0] ?? '')
}

describe('GoogleImageProvider.generateImage', () => {
  it('imagen-* models hit :predict and read predictions[0].bytesBase64Encoded', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        predictions: [{ bytesBase64Encoded: 'QUJD', mimeType: 'image/png' }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const img = await new GoogleImageProvider(record()).generateImage({
      prompt: '벚꽃 봄소풍',
      size: '1024x1024',
    })
    expect(img.dataUrl).toBe('data:image/png;base64,QUJD')
    expect(img.model).toBe('imagen-3.0-generate-002')
    expect(reqUrl(fetchMock)).toContain(':predict')
    expect(reqUrl(fetchMock)).toContain('key=AIza-test')
  })

  it('gemini-* models hit :generateContent and read inlineData.data', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: 'here' },
                { inlineData: { mimeType: 'image/png', data: 'WlpaWg==' } },
              ],
            },
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const img = await new GoogleImageProvider(
      record({ model: 'gemini-2.5-flash-image-preview' }),
    ).generateImage({ prompt: 'x' })
    expect(img.dataUrl).toBe('data:image/png;base64,WlpaWg==')
    expect(reqUrl(fetchMock)).toContain(':generateContent')
  })

  it('wraps an API error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'invalid prompt' } }),
      })),
    )
    await expect(
      new GoogleImageProvider(record()).generateImage({ prompt: 'x' }),
    ).rejects.toThrowError(/400.*invalid prompt/)
  })

  it('explains a browser CORS/network block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(
      new GoogleImageProvider(record()).generateImage({ prompt: 'x' }),
    ).rejects.toThrowError(/CORS|프록시/)
  })

  it('errors when the response has no image data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ predictions: [{}] }) })),
    )
    await expect(
      new GoogleImageProvider(record()).generateImage({ prompt: 'x' }),
    ).rejects.toThrowError(/이미지 데이터/)
  })
})

describe('GoogleImageProvider.testConnection', () => {
  it('403 → invalid key / permission', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    const res = await new GoogleImageProvider(record()).testConnection()
    expect(res.ok).toBe(false)
  })
  it('200 → success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })))
    expect((await new GoogleImageProvider(record()).testConnection()).ok).toBe(true)
  })
  it('requires an api key', async () => {
    expect(
      (await new GoogleImageProvider(record({ apiKey: '' })).testConnection()).ok,
    ).toBe(false)
  })
})
