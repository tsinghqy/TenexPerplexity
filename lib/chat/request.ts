import type { ChatMessage } from '@/lib/llm/types'

export interface StreamChatRequestBody {
  message: string
  history?: ChatMessage[]
  modelId?: string
  useWebSearch?: boolean
}

export function parseStreamChatRequestBody(body: unknown): {
  isValid: boolean
  errorMessage?: string
  data?: StreamChatRequestBody
} {
  if (!body || typeof body !== 'object') {
    return { isValid: false, errorMessage: 'Request body is required' }
  }

  const record = body as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message.trim() : ''

  if (!message) {
    return { isValid: false, errorMessage: 'Message content is required' }
  }

  const history = Array.isArray(record.history)
    ? (record.history as ChatMessage[]).filter(
        (item) =>
          item &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string'
      )
    : []

  const modelId = typeof record.modelId === 'string' ? record.modelId : undefined
  const useWebSearch = record.useWebSearch === true

  return {
    isValid: true,
    data: {
      message,
      history,
      modelId,
      useWebSearch,
    },
  }
}
