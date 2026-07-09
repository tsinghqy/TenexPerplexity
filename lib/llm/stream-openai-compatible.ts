import type OpenAI from 'openai'
import { buildChatCompletionMessages } from './message-builder'
import { getModelById } from './models'
import type { ChatGenerationResult, StreamChatOptions } from './types'

const SIMULATED_CHUNK_SIZE = 24
const SIMULATED_CHUNK_DELAY_MS = 8

export async function streamOpenAICompatibleChat(
  client: OpenAI,
  options: StreamChatOptions,
  modelIdOverride?: string
): Promise<ChatGenerationResult> {
  const model = getModelById(options.modelId)
  if (!model) {
    throw new Error(`Invalid model ID: ${options.modelId}`)
  }

  const stream = await client.chat.completions.create({
    model: modelIdOverride || options.modelId,
    messages: buildChatCompletionMessages(options.messages, options.systemPrompt),
    temperature: options.temperature ?? model.defaultTemperature,
    max_tokens: options.maxTokens ?? model.defaultMaxTokens,
    stream: true,
  })

  let fullContent = ''

  for await (const chunk of stream) {
    if (options.signal?.aborted) {
      break
    }

    const content = chunk.choices[0]?.delta?.content || ''
    if (!content) {
      continue
    }

    fullContent += content
    await options.onChunk(content)
  }

  return { content: fullContent }
}

export async function simulateStreamingChunks(
  text: string,
  onChunk: (chunk: string) => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  for (let index = 0; index < text.length; index += SIMULATED_CHUNK_SIZE) {
    if (signal?.aborted) {
      break
    }

    const chunk = text.slice(index, index + SIMULATED_CHUNK_SIZE)
    await onChunk(chunk)
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_CHUNK_DELAY_MS))
  }
}
