import OpenAI from 'openai'
import {
  extractCitationsFromMarkdown,
  extractCitationsFromResponsesOutput,
  mergeCitations,
} from '../citations'
import { getModelById, getModelsByProvider, modelSupportsCapability } from '../models'
import { simulateStreamingChunks, streamOpenAICompatibleChat } from '../stream-openai-compatible'
import {
  appendWebSearchInstruction,
  buildOpenAIWebSearchTools,
  resolveOpenAIWebSearchApiKey,
  resolveOpenAIWebSearchModelId,
} from '../web-search'
import type { ChatGenerationResult, ChatMessage, LLMProvider, StreamChatOptions } from '../types'

function buildConversationText(messages: ChatMessage[]): string {
  return messages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n\n')
}

function extractResponseTextFromOutput(output: unknown): string {
  if (!Array.isArray(output)) {
    return ''
  }

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const record = item as Record<string, unknown>
    if (record.type !== 'message' || !Array.isArray(record.content)) {
      continue
    }

    for (const part of record.content) {
      if (!part || typeof part !== 'object') {
        continue
      }

      const partRecord = part as Record<string, unknown>
      if (partRecord.type === 'output_text' && typeof partRecord.text === 'string') {
        return partRecord.text
      }
    }
  }

  return ''
}

export class OpenAIProvider implements LLMProvider {
  readonly providerId = 'openai'
  private client: OpenAI | null = null
  private webSearchClient: OpenAI | null = null

  private ensureClients(): void {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY
      if (apiKey) {
        this.client = new OpenAI({ apiKey })
      }
    }

    if (!this.webSearchClient) {
      const webSearchApiKey = process.env.OPENAI_WEB_SEARCH_API_KEY
      if (webSearchApiKey) {
        this.webSearchClient = new OpenAI({ apiKey: webSearchApiKey })
      }
    }
  }

  isAvailable(): boolean {
    this.ensureClients()
    return this.client !== null
  }

  getSupportedModels() {
    return getModelsByProvider('openai')
  }

  private getClientForWebSearch(): OpenAI {
    this.ensureClients()
    if (this.webSearchClient) {
      return this.webSearchClient
    }
    return this.client!
  }

  private async streamWithWebSearch(options: StreamChatOptions): Promise<ChatGenerationResult> {
    this.ensureClients()
    const model = getModelById(options.modelId)
    if (!model || !this.client) {
      throw new Error(`Invalid model ID: ${options.modelId}`)
    }

    const webSearchApiKey = resolveOpenAIWebSearchApiKey()
    if (!webSearchApiKey) {
      return streamOpenAICompatibleChat(this.client, options)
    }

    const systemPrompt = appendWebSearchInstruction(
      options.systemPrompt || 'You are Tenexity, a helpful AI assistant.'
    )
    const webSearchModelId = resolveOpenAIWebSearchModelId(options.modelId)
    const inputText = `${systemPrompt}\n\n${buildConversationText(options.messages)}`

    try {
      const response = await this.getClientForWebSearch().responses.create({
        model: webSearchModelId,
        input: inputText,
        tools: buildOpenAIWebSearchTools(),
        text: { format: { type: 'text' } },
        temperature: options.temperature ?? model.defaultTemperature,
        max_output_tokens: options.maxTokens ?? model.defaultMaxTokens,
        store: false,
      })

      const content = extractResponseTextFromOutput(response.output) || 'No response generated'
      const citations = mergeCitations(
        extractCitationsFromResponsesOutput(response.output),
        extractCitationsFromMarkdown(content)
      )

      if (citations.length > 0) {
        await options.onCitations?.(citations)
      }

      await simulateStreamingChunks(content, options.onChunk, options.signal)

      return { content, citations }
    } catch (error) {
      console.warn('[OpenAI Provider] Web search failed, falling back to standard chat:', error)
      return streamOpenAICompatibleChat(this.client, {
        ...options,
        systemPrompt,
      })
    }
  }

  async streamChat(options: StreamChatOptions): Promise<ChatGenerationResult> {
    this.ensureClients()
    if (!this.client) {
      throw new Error('OpenAI API key not configured')
    }

    const shouldUseWebSearch =
      Boolean(options.useWebSearch) && modelSupportsCapability(options.modelId, 'supportsWebSearch')

    if (shouldUseWebSearch) {
      return this.streamWithWebSearch(options)
    }

    return streamOpenAICompatibleChat(this.client, options)
  }
}

export const openAIProvider = new OpenAIProvider()
