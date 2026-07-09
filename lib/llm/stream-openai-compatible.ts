import type OpenAI from 'openai'
import { buildChatCompletionMessages } from './message-builder'
import { getModelById } from './models'
import type { ChatGenerationResult, StreamChatOptions } from './types'

export async function streamOpenAICompatibleChat(
  client: OpenAI,
  options: StreamChatOptions
): Promise<ChatGenerationResult> {
  const model = getModelById(options.modelId)
  if (!model) {
    throw new Error(`Invalid model ID: ${options.modelId}`)
  }

  const stream = await client.chat.completions.create({
    model: options.modelId,
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
