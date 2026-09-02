/**
 * Direct Generate — type contracts.
 *
 * This whole folder (`src/generation/`) is an OPTIONAL layer. It must never be
 * imported by the keyword core domain (`src/domain/*`) or the storage layer
 * (`src/repo/*`). If Direct Generate is removed, the WOOJOO Stock Planner + My GPT
 * paths keep working. See `featureFlags.ts` and README "Direct Generate 제거".
 */

export type GenerationMode = 'direct' | 'my-gpt'

/** Extensible. Add 'flux' | 'stability' | … alongside a matching adapter. */
export type ProviderType = 'openai' | 'google'

export interface ImageProvider {
  id: string
  name: string
  providerType: ProviderType
  apiKey: string
  model: string
  isDefault: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface GenerateImageParams {
  prompt: string
  size?: string
  signal?: AbortSignal
}

/** Result is transient — shown in the modal, downloadable, never persisted. */
export interface GeneratedImage {
  dataUrl: string
  model: string
  provider: string
  createdAt: string
}

export interface TestConnectionResult {
  ok: boolean
  message: string
}

/**
 * Adapter every provider implements. UI code depends on this interface only,
 * never on a concrete SDK / endpoint.
 */
export interface ImageGenerationProvider {
  readonly id: string
  readonly name: string
  testConnection(signal?: AbortSignal): Promise<TestConnectionResult>
  generateImage(params: GenerateImageParams): Promise<GeneratedImage>
  /** Future — chat-style edits / variations. */
  editImage?(
    params: GenerateImageParams & { imageDataUrl: string },
  ): Promise<GeneratedImage>
  /** Future — dynamic model discovery. */
  getAvailableModels?(): Promise<string[]>
}

export class GenerationError extends Error {
  cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'GenerationError'
    this.cause = cause
  }
}
