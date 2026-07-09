import OpenAI from 'openai'
import { extractCitationsFromMarkdown } from '../citations'
import { getModelsByProvider, modelSupportsCapability } from '../models'
import { streamOpenAICompatibleChat } from '../stream-openai-compatible'
import { appendWebSearchInstruction } from '../web-search'
import type { ChatGenerationResult, LLMProvider, StreamChatOptions } from '../types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const OPENROUTER_APP_TITLE = 'Tenexity'

export class OpenRouterProvider implements LLMProvider {
  readonly providerId = 'openrouter'
  private client: OpenAI | null = null

  private ensureClient(): void {
    if (this.client) {
      return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': OPENROUTER_APP_TITLE,
      },
    })
  }

  isAvailable(): boolean {
    this.ensureClient()
    return this.client !== null
  }

  getSupportedModels() {
    return getModelsByProvider('openrouter')
  }

  async streamChat(options: StreamChatOptions): Promise<ChatGenerationResult> {
    this.ensureClient()
    if (!this.client) {
      throw new Error('OpenRouter API key not configured')
    }

    const shouldUseWebSearch =
      Boolean(options.useWebSearch) && modelSupportsCapability(options.modelId, 'supportsWebSearch')

    const systemPrompt = shouldUseWebSearch
      ? appendWebSearchInstruction(options.systemPrompt || 'You are Tenexity, a helpful AI assistant.')
      : options.systemPrompt

    const modelIdWithVariant = shouldUseWebSearch ? `${options.modelId}:online` : options.modelId

    const result = await streamOpenAICompatibleChat(
      this.client,
      {
        ...options,
        systemPrompt,
      },
      modelIdWithVariant
    )

    const citations = shouldUseWebSearch ? extractCitationsFromMarkdown(result.content) : []
    if (citations.length > 0) {
      await options.onCitations?.(citations)
    }

    return {
      ...result,
      citations: citations.length > 0 ? citations : undefined,
    }
  }
}

export const openRouterProvider = new OpenRouterProvider()
