import { STREAM_EVENT } from '@/lib/chat/constants'
import type { ChatMessage } from '@/lib/llm/types'

export interface StreamChatClientRequest {
  message: string
  history: ChatMessage[]
  modelId?: string
  signal?: AbortSignal
  onChunk: (chunk: string) => void
  onComplete?: (content: string, modelId: string) => void
  onError?: (errorMessage: string) => void
}

interface StreamEventPayload {
  type?: string
  content?: string
  error?: string
  modelId?: string
}

function parseSseDataLine(line: string): StreamEventPayload | null {
  if (!line.startsWith('data: ')) {
    return null
  }

  const data = line.slice(6).trim()
  if (!data || data === STREAM_EVENT.DONE) {
    return { type: STREAM_EVENT.DONE }
  }

  try {
    return JSON.parse(data) as StreamEventPayload
  } catch {
    return null
  }
}

export async function sendMessageStreaming(request: StreamChatClientRequest): Promise<void> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: request.message,
      history: request.history,
      modelId: request.modelId,
    }),
    signal: request.signal,
  })

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) {
        errorMessage = payload.error
      }
    } catch {
      // keep default error message
    }
    request.onError?.(errorMessage)
    throw new Error(errorMessage)
  }

  if (!response.body) {
    const errorMessage = 'Streaming response body was empty'
    request.onError?.(errorMessage)
    throw new Error(errorMessage)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completedContent = ''
  let completedModelId = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const payload = parseSseDataLine(line.trim())
      if (!payload?.type) {
        continue
      }

      if (payload.type === STREAM_EVENT.CHUNK && payload.content) {
        request.onChunk(payload.content)
      }

      if (payload.type === STREAM_EVENT.COMPLETE) {
        completedContent = payload.content || ''
        completedModelId = payload.modelId || ''
        request.onComplete?.(completedContent, completedModelId)
      }

      if (payload.type === STREAM_EVENT.ERROR && payload.error) {
        request.onError?.(payload.error)
        throw new Error(payload.error)
      }
    }
  }
}
