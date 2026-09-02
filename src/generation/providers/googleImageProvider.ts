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
    this.model = record.model.trim() || 'imagen-3.0-generate-002'
  }

  async testConnection(signal?: AbortSignal): Promise<TestConnectionResult> {
    if (!this.apiKey) return { ok: false, message: 'API Key를 입력하세요.' }
    try {
      const res = await fetch(
        `${API_BASE}/models?key=${encodeURIComponent(this.apiKey)}`,
        { signal },
      )
      if (res.ok) return { ok: true, message: '연결 성공' }
      if (res.status === 400 || res.status === 401 || res.status === 403)
        return { ok: false, message: 'API Key가 올바르지 않거나 권한이 없습니다.' }
      return { ok: false, message: `연결 실패 (HTTP ${res.status})` }
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
    if (!res.ok) throw new GenerationError(await apiErrorMessage(res))

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
    if (!res.ok) throw new GenerationError(await apiErrorMessage(res))

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
    return [
      'imagen-3.0-generate-002',
      'imagen-4.0-generate-001',
      'gemini-2.5-flash-image-preview',
    ]
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
