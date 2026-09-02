import {
  GenerationError,
  type ImageGenerationProvider,
  type ImageProvider,
  type ProviderType,
} from '../types'
import { OpenAiImageProvider } from './openaiImageProvider'
import { GoogleImageProvider, GOOGLE_MODELS } from './googleImageProvider'

type ProviderFactory = (record: ImageProvider) => ImageGenerationProvider

/** Register a new provider type by adding a line here + its adapter file. */
const REGISTRY: Record<ProviderType, ProviderFactory> = {
  openai: (record) => new OpenAiImageProvider(record),
  google: (record) => new GoogleImageProvider(record),
}

export function createProvider(record: ImageProvider): ImageGenerationProvider {
  const factory = REGISTRY[record.providerType]
  if (!factory) {
    throw new GenerationError(`지원하지 않는 Provider: ${record.providerType}`)
  }
  return factory(record)
}

export interface ProviderTypeInfo {
  type: ProviderType
  label: string
  models: string[]
}

export const PROVIDER_TYPES: ProviderTypeInfo[] = [
  { type: 'openai', label: 'OpenAI', models: ['gpt-image-1', 'dall-e-3', 'dall-e-2'] },
  {
    type: 'google',
    label: 'Google (Gemini / Imagen)',
    models: GOOGLE_MODELS,
  },
]
