import {
  GenerationError,
  type GeneratedImage,
  type GenerateImageParams,
  type ImageGenerationProvider,
  type ImageProvider,
  type TestConnectionResult,
} from '../types'
import { apiErrorMessage, browserBlockedMessage } from './http'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Suggested model IDs, gemini-* first — those run on the FREE Gemini API tier.
 * `imagen-*` needs a billing-enabled Google Cloud project.
 *
 * Google renames these previews often; the real source of truth is the live
 * `ListModels` call, which `testConnection()` surfaces to the user.
 */
export const GOOGLE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-image-preview',
  'gemini-2.0-flash-preview-image-generation',
  'imagen-4.0-generate-001',
  'imagen-3.0-generate-002',
]

const DEFAULT_MODEL = 'gemini-2.5-flash-image'

/**
 * Google — Gemini API image generation.
 *
 *  - `imagen-*` models  → `:predict` endpoint (dedicated text-to-image)
 *  - `gemini-*` models  → `:generateContent` with responseModalities: [TEXT, IMAGE]
 *
 * Auth is the Gemini API key as `?key=`. The generativelanguage endpoint is meant
 * for client SDKs, so browser calls usually work; if a given key/region blocks
 * CORS the error surfaces just like OpenAI's.
 */
export class GoogleImageProvider implements ImageGenerationProvider {
  readonly id: string
  readonly name: string
  private apiKey: string
  private model: string

  constructor(record: ImageProvider) {
    this.id = record.id
    this.name = record.name
    this.apiKey = record.apiKey.trim()
    this.model = record.model.trim() || DEFAULT_MODEL
  }

  async testConnection(signal?: AbortSignal): Promise<TestConnectionResult> {
    if (!this.apiKey) return { ok: false, message: 'API Key를 입력하세요.' }
    try {
      const res = await fetch(
        `${API_BASE}/models?key=${encodeURIComponent(this.apiKey)}`,
        { signal },
      )
      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403)
          return { ok: false, message: 'API Key가 올바르지 않거나 권한이 없습니다.' }
        return { ok: false, message: `연결 실패 (HTTP ${res.status})` }
      }
      const models = await imageModelsFromResponse(res)
      return {
        ok: true,
        message: models.length
          ? `연결 성공 — 이 키에서 쓸 수 있는 이미지 모델: ${models.join(', ')}`
          : '연결 성공 (이 키에서 쓸 수 있는 이미지 생성 모델을 찾지 못했습니다. 결제 활성화 또는 다른 키가 필요할 수 있습니다.)',
      }
    } catch (err) {
      return { ok: false, message: browserBlockedMessage(err) }
    }
  }

  async generateImage(params: GenerateImageParams): Promise<GeneratedImage> {
    if (!this.apiKey) throw new GenerationError('API Key가 설정되지 않았습니다.')
    return this.model.startsWith('imagen')
      ? this.viaImagen(params)
      : this.viaGemini(params)
  }

  /** Extra guidance appended to a failed-response error, by HTTP status. */
  private async statusHint(status: number): Promise<string> {
    if (status === 404) return this.notFoundHint()
    if (status === 429)
      return (
        ` — 무료 등급(free tier) Gemini 키는 이미지 생성 허용량이 0입니다. ` +
        `이미지 생성을 쓰려면 Google Cloud에서 결제(빌링)를 활성화한 유료 키가 필요합니다. ` +
        `API 대신 사이트에서 직접 생성하려면 "내 생성 사이트" 방식을 이용하세요.`
      )
    return ''
  }

  /**
   * 404 on Google means the model name isn't valid for this key + endpoint.
   * Ask the API which image models the key *can* use and name them.
   */
  private async notFoundHint(): Promise<string> {
    const models = await this.availableImageModels()
    const head = this.model.startsWith('imagen')
      ? ` — Imagen 모델은 결제(빌링)가 활성화된 Google Cloud 프로젝트에서만 쓸 수 있습니다.`
      : ` — 이 API 키로 "${this.model}" 모델을 호출할 수 없습니다.`
    return models.length
      ? `${head} 이 키에서 쓸 수 있는 이미지 모델: ${models.join(', ')} — Model 값을 이 중 하나로 바꾸세요.`
      : `${head} 설정 → 생성에서 "연결 테스트"를 눌러 사용 가능한 모델을 확인하세요. 없다면 무료 등급에서는 이미지 생성이 불가능한 키입니다.`
  }

  private async availableImageModels(): Promise<string[]> {
    try {
      const res = await fetch(
        `${API_BASE}/models?key=${encodeURIComponent(this.apiKey)}`,
      )
      if (!res.ok) return []
      return imageModelsFromResponse(res)
    } catch {
      return []
    }
  }

  private aspectRatio(size?: string): string {
    const [w, h] = (size ?? '').split('x').map(Number)
    if (!w || !h) return '1:1'
    const r = w / h
    if (r >= 1.6) return '16:9'
    if (r <= 0.62) return '9:16'
    if (r >= 1.2) return '4:3'
    if (r <= 0.83) return '3:4'
    return '1:1'
  }

  private async viaImagen({
    prompt,
    size,
    signal,
  }: GenerateImageParams): Promise<GeneratedImage> {
    const url = `${API_BASE}/models/${this.model}:predict?key=${encodeURIComponent(
      this.apiKey,
    )}`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: this.aspectRatio(size) },
        }),
        signal,
      })
    } catch (err) {
      throw new GenerationError(browserBlockedMessage(err), err)
    }
    if (!res.ok)
      throw new GenerationError(
        (await apiErrorMessage(res)) +
          await this.statusHint(res.status),
      )

    const json = (await res.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }
    const p = json?.predictions?.[0]
    if (!p?.bytesBase64Encoded)
      throw new GenerationError('응답에 이미지 데이터가 없습니다.')
    return this.result(
      `data:${p.mimeType || 'image/png'};base64,${p.bytesBase64Encoded}`,
    )
  }

  private async viaGemini({
    prompt,
    signal,
  }: GenerateImageParams): Promise<GeneratedImage> {
    const url = `${API_BASE}/models/${this.model}:generateContent?key=${encodeURIComponent(
      this.apiKey,
    )}`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal,
      })
    } catch (err) {
      throw new GenerationError(browserBlockedMessage(err), err)
    }
    if (!res.ok)
      throw new GenerationError(
        (await apiErrorMessage(res)) +
          await this.statusHint(res.status),
      )

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> }
      }>
    }
    const parts = json?.candidates?.[0]?.content?.parts ?? []
    const img = parts.map((x) => x.inlineData).find((d) => d?.data)
    if (!img?.data) throw new GenerationError('응답에 이미지 데이터가 없습니다.')
    return this.result(`data:${img.mimeType || 'image/png'};base64,${img.data}`)
  }

  async getAvailableModels(): Promise<string[]> {
    const live = await this.availableImageModels()
    return live.length ? live : GOOGLE_MODELS
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

/** Pull image-capable model IDs out of a `ListModels` response (best effort). */
async function imageModelsFromResponse(res: Response): Promise<string[]> {
  try {
    const json = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
    }
    return (json.models ?? [])
      .filter((m) =>
        m.supportedGenerationMethods?.some(
          (x) => x === 'generateContent' || x === 'predict',
        ),
      )
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter((id) => /image|imagen/i.test(id))
  } catch {
    return []
  }
}
