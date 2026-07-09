import OpenAI from 'openai'
import { getModelsByProvider } from '../models'
import { streamOpenAICompatibleChat } from '../stream-openai-compatible'
import type { ChatGenerationResult, LLMProvider, StreamChatOptions } from '../types'

export class OpenAIProvider implements LLMProvider {
  readonly providerId = 'openai'
  private client: OpenAI | null = null

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      this.client = new OpenAI({ apiKey })
    }
  }

  isAvailable(): boolean {
    return this.client !== null
  }

  getSupportedModels() {
    return getModelsByProvider('openai')
  }

  async streamChat(options: StreamChatOptions): Promise<ChatGenerationResult> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured')
    }
    return streamOpenAICompatibleChat(this.client, options)
  }
}

export const openAIProvider = new OpenAIProvider()
