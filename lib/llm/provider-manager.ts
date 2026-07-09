import { getModelById } from './models'
import { openAIProvider } from './providers/openai'
import { openRouterProvider } from './providers/openrouter'
import type { ChatGenerationResult, LLMProvider, StreamChatOptions } from './types'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'

class LLMProviderManager {
  private providers: Map<string, LLMProvider> = new Map()

  constructor() {
    this.providers.set(openAIProvider.providerId, openAIProvider)
    this.providers.set(openRouterProvider.providerId, openRouterProvider)
  }

  private getProviderForModel(modelId: string): LLMProvider | null {
    const model = getModelById(modelId)
    if (!model) {
      return null
    }
    return this.providers.get(model.provider) ?? null
  }

  hasAnyAvailableProvider(): boolean {
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        return true
      }
    }
    return false
  }

  async streamChat(options: StreamChatOptions): Promise<ChatGenerationResult> {
    const provider = this.getProviderForModel(options.modelId)

    if (!provider) {
      throw new Error(`No provider found for model: ${options.modelId}`)
    }

    if (!provider.isAvailable()) {
      throw new Error(CHAT_ERROR_MESSAGE.NO_PROVIDER)
    }

    return provider.streamChat(options)
  }
}

export const llmProviderManager = new LLMProviderManager()
