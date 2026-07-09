export interface ModelCapabilities {
  supportsStreaming: boolean
  supportsWebSearch: boolean
}

export interface ModelConfig {
  id: string
  name: string
  provider: 'openai' | 'openrouter'
  capabilities: ModelCapabilities
  defaultTemperature: number
  defaultMaxTokens: number
}

export const ModelId = {
  GPT_4O_MINI: 'gpt-4o-mini',
  GPT_4O: 'gpt-4o',
  OPENROUTER_GEMINI_FLASH: 'google/gemini-2.5-flash-lite',
  OPENROUTER_CLAUDE_SONNET: 'anthropic/claude-sonnet-4',
} as const

export type ModelIdType = (typeof ModelId)[keyof typeof ModelId]

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  [ModelId.GPT_4O_MINI]: {
    id: ModelId.GPT_4O_MINI,
    name: 'GPT-4o Mini',
    provider: 'openai',
    capabilities: { supportsStreaming: true, supportsWebSearch: true },
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  [ModelId.GPT_4O]: {
    id: ModelId.GPT_4O,
    name: 'GPT-4o',
    provider: 'openai',
    capabilities: { supportsStreaming: true, supportsWebSearch: true },
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  [ModelId.OPENROUTER_GEMINI_FLASH]: {
    id: ModelId.OPENROUTER_GEMINI_FLASH,
    name: 'Gemini 2.5 Flash Lite',
    provider: 'openrouter',
    capabilities: { supportsStreaming: true, supportsWebSearch: true },
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  },
  [ModelId.OPENROUTER_CLAUDE_SONNET]: {
    id: ModelId.OPENROUTER_CLAUDE_SONNET,
    name: 'Claude Sonnet 4',
    provider: 'openrouter',
    capabilities: { supportsStreaming: true, supportsWebSearch: true },
    defaultTemperature: 0.7,
    defaultMaxTokens: 4000,
  },
}

const FALLBACK_DEFAULT_MODEL_ID = ModelId.GPT_4O_MINI

export function getDefaultModelId(): string {
  const configuredModelId = process.env.DEFAULT_MODEL_ID
  if (configuredModelId && isValidModelId(configuredModelId)) {
    return configuredModelId
  }

  if (process.env.OPENROUTER_API_KEY) {
    return ModelId.OPENROUTER_GEMINI_FLASH
  }

  if (process.env.OPENAI_API_KEY) {
    return ModelId.GPT_4O_MINI
  }

  return FALLBACK_DEFAULT_MODEL_ID
}

export function getModelById(modelId: string): ModelConfig | null {
  return MODEL_REGISTRY[modelId] ?? null
}

export function isValidModelId(modelId: string): boolean {
  return modelId in MODEL_REGISTRY
}

export function getChatModels(): ModelConfig[] {
  return Object.values(MODEL_REGISTRY)
}

export function getModelsByProvider(provider: ModelConfig['provider']): ModelConfig[] {
  return getChatModels().filter((model) => model.provider === provider)
}
