import OpenAI from 'openai'
import { getModelsByProvider } from '../models'
import { streamOpenAICompatibleChat } from '../stream-openai-compatible'
import type { ChatGenerationResult, LLMProvider, StreamChatOptions } from '../types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const OPENROUTER_APP_TITLE = 'Tenexity'

export class OpenRouterProvider implements LLMProvider {
  readonly providerId = 'openrouter'
  private client: OpenAI | null = null

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': OPENROUTER_APP_TITLE,
        },
      })
    }
  }

  isAvailable(): boolean {
    return this.client !== null
  }

  getSupportedModels() {
    return getModelsByProvider('openrouter')
  }

  async streamChat(options: StreamChatOptions): Promise<ChatGenerationResult> {
    if (!this.client) {
      throw new Error('OpenRouter API key not configured')
    }
    return streamOpenAICompatibleChat(this.client, options)
  }
}

export const openRouterProvider = new OpenRouterProvider()
