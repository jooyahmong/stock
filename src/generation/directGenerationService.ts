import {
  defaultUsableProvider,
  hasUsableProvider,
  type GenerationConfig,
} from './generationConfig'
import { createProvider as realCreateProvider } from './providers'
import {
  GenerationError,
  type GeneratedImage,
  type GenerateImageParams,
  type ImageGenerationProvider,
  type ImageProvider,
  type TestConnectionResult,
} from './types'

/**
 * Orchestrates Direct Generate without knowing any specific API. UI calls this;
 * it resolves the configured provider and delegates to the adapter.
 *
 * `createProviderFn` is injectable so tests can supply a fake adapter.
 */
export interface DirectGenerationService {
  hasUsableProvider(cfg: GenerationConfig): boolean
  resolveProviderRecord(cfg: GenerationConfig): ImageProvider | null
  generate(
    cfg: GenerationConfig,
    params: GenerateImageParams,
  ): Promise<GeneratedImage>
  testConnection(
    record: ImageProvider,
    signal?: AbortSignal,
  ): Promise<TestConnectionResult>
}

export function createDirectGenerationService(
  createProviderFn: (record: ImageProvider) => ImageGenerationProvider = realCreateProvider,
): DirectGenerationService {
  return {
    hasUsableProvider,

    resolveProviderRecord: (cfg) => defaultUsableProvider(cfg),

    async generate(cfg, params) {
      const record = defaultUsableProvider(cfg)
      if (!record) {
        throw new GenerationError(
          'Direct Generate를 사용하려면 API를 먼저 연결하세요.',
        )
      }
      const provider = createProviderFn(record)
      return provider.generateImage(params)
    },

    async testConnection(record, signal) {
      return createProviderFn(record).testConnection(signal)
    },
  }
}
