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
  buildOpenAIWebSearchPreviewTools,
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

  const chunks: string[] = []

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
        chunks.push(partRecord.text)
      }
    }
  }

  return chunks.join('\n\n')
}

function isUnsupportedWebSearchToolError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('web_search') ||
    message.includes('Unknown tool') ||
    message.includes('invalid_tool') ||
    message.includes('not supported')
  )
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

  private async createWebSearchResponse(params: {
    modelId: string
    inputText: string
    maxTokens: number
    tools: ReturnType<typeof buildOpenAIWebSearchTools>
    forceTool: boolean
  }) {
    // Cast: SDK typings may lag the live Responses API (`web_search` + sources include).
    return this.getClientForWebSearch().responses.create({
      model: params.modelId,
      input: params.inputText,
      tools: params.tools,
      tool_choice: params.forceTool ? 'required' : 'auto',
      include: ['web_search_call.action.sources'],
      text: { format: { type: 'text' } },
      max_output_tokens: params.maxTokens,
      store: false,
    } as Parameters<OpenAI['responses']['create']>[0])
  }

  private citationsFromResponse(output: unknown, content: string) {
    return mergeCitations(
      extractCitationsFromResponsesOutput(output),
      extractCitationsFromMarkdown(content)
    )
  }

  private async streamWithWebSearch(options: StreamChatOptions): Promise<ChatGenerationResult> {
    this.ensureClients()
    const model = getModelById(options.modelId)
    if (!model || !this.client) {
      throw new Error(`Invalid model ID: ${options.modelId}`)
    }

    const webSearchApiKey = resolveOpenAIWebSearchApiKey()
    if (!webSearchApiKey) {
      console.warn('[OpenAI Provider] No web search key; answering without live sources')
      return streamOpenAICompatibleChat(this.client, options)
    }

    const systemPrompt = appendWebSearchInstruction(
      options.systemPrompt || 'You are Tenexity, a helpful AI assistant.'
    )
    const webSearchModelId = resolveOpenAIWebSearchModelId(options.modelId)
    const inputText = `${systemPrompt}\n\n${buildConversationText(options.messages)}`
    const maxTokens = options.maxTokens ?? model.defaultMaxTokens

    const attempt = async (
      tools: ReturnType<typeof buildOpenAIWebSearchTools>,
      forceTool: boolean
    ) => {
      const response = await this.createWebSearchResponse({
        modelId: webSearchModelId,
        inputText,
        maxTokens,
        tools,
        forceTool,
      })
      const content = extractResponseTextFromOutput(response.output) || 'No response generated'
      const citations = this.citationsFromResponse(response.output, content)
      return { content, citations }
    }

    try {
      let result: { content: string; citations: ReturnType<typeof mergeCitations> }

      try {
        result = await attempt(buildOpenAIWebSearchTools(), true)
      } catch (primaryError) {
        if (!isUnsupportedWebSearchToolError(primaryError)) {
          throw primaryError
        }
        console.warn(
          '[OpenAI Provider] web_search unsupported; falling back to web_search_preview:',
          primaryError
        )
        result = await attempt(buildOpenAIWebSearchPreviewTools(), true)
      }

      if (result.citations.length > 0) {
        await options.onCitations?.(result.citations)
      } else {
        console.warn('[OpenAI Provider] Web search returned no citations for this answer')
      }

      await simulateStreamingChunks(result.content, options.onChunk, options.signal)
      return result
    } catch (error) {
      console.warn('[OpenAI Provider] Web search failed, retrying with auto tool choice:', error)
      try {
        const retry = await attempt(buildOpenAIWebSearchTools(), false).catch(() =>
          attempt(buildOpenAIWebSearchPreviewTools(), false)
        )
        if (retry.citations.length > 0) {
          await options.onCitations?.(retry.citations)
        }
        await simulateStreamingChunks(retry.content, options.onChunk, options.signal)
        return retry
      } catch (retryError) {
        console.warn('[OpenAI Provider] Web search retry failed:', retryError)
        return streamOpenAICompatibleChat(this.client, {
          ...options,
          systemPrompt,
        })
      }
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
