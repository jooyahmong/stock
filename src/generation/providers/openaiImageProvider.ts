import {
  GenerationError,
  type GeneratedImage,
  type GenerateImageParams,
  type ImageGenerationProvider,
  type ImageProvider,
  type TestConnectionResult,
} from '../types'
import { blobToDataUrl, browserBlockedMessage } from './http'

const API_BASE = 'https://api.openai.com/v1'

/**
 * OpenAI Images adapter. First concrete provider; others follow the same
 * `ImageGenerationProvider` shape via `providers/index.ts`.
 */
export class OpenAiImageProvider implements ImageGenerationProvider {
  readonly id: string
  readonly name: string
  private apiKey: string
  private model: string

  constructor(record: ImageProvider) {
    this.id = record.id
    this.name = record.name
    this.apiKey = record.apiKey.trim()
    this.model = record.model.trim() || 'gpt-image-1'
  }

  async testConnection(signal?: AbortSignal): Promise<TestConnectionResult> {
    if (!this.apiKey) return { ok: false, message: 'API Key를 입력하세요.' }
    try {
      const res = await fetch(`${API_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal,
      })
      if (res.ok) return { ok: true, message: '연결 성공' }
      if (res.status === 401)
        return { ok: false, message: 'API Key가 올바르지 않습니다 (401).' }
      return { ok: false, message: `연결 실패 (HTTP ${res.status})` }
    } catch (err) {
      return { ok: false, message: browserBlockedMessage(err) }
    }
  }

  async generateImage({
    prompt,
    size = '1024x1024',
    signal,
  }: GenerateImageParams): Promise<GeneratedImage> {
    if (!this.apiKey) throw new GenerationError('API Key가 설정되지 않았습니다.')

    const body: Record<string, unknown> = { model: this.model, prompt, n: 1, size }
    // dall-e models need an explicit b64 request; gpt-image-* rejects the param.
    if (!this.model.startsWith('gpt-image')) body.response_format = 'b64_json'

    let res: Response
    try {
      res = await fetch(`${API_BASE}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })
    } catch (err) {
      throw new GenerationError(browserBlockedMessage(err), err)
    }

    if (!res.ok) {
      let detail = ''
      try {
        const j = (await res.json()) as { error?: { message?: string } }
        detail = j?.error?.message ?? ''
      } catch {
        /* non-JSON error body */
      }
      throw new GenerationError(
        `이미지 생성 실패 (HTTP ${res.status})${detail ? `: ${detail}` : ''}`,
      )
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>
    }
    const first = json?.data?.[0]
    if (first?.b64_json) {
      return this.result(`data:image/png;base64,${first.b64_json}`)
    }
    if (first?.url) {
      try {
        const blob = await (await fetch(first.url, { signal })).blob()
        return this.result(await blobToDataUrl(blob))
      } catch (err) {
        throw new GenerationError('생성된 이미지를 불러오지 못했습니다.', err)
      }
    }
    throw new GenerationError('응답에 이미지 데이터가 없습니다.')
  }

  async getAvailableModels(): Promise<string[]> {
    return ['gpt-image-1', 'dall-e-3', 'dall-e-2']
  }

  private result(dataUrl: string): GeneratedImage {
    return {
      dataUrl,
      model: this.model,
      provider: this.name,
      createdAt: new Date().toISOString(),
    }
  }
}
