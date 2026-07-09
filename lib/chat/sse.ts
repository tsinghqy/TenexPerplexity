import { STREAM_EVENT } from '@/lib/chat/constants'
import type { Citation } from '@/lib/llm/citations'

export function createSseDataLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export function createChunkEvent(content: string): string {
  return createSseDataLine({ type: STREAM_EVENT.CHUNK, content })
}

export function createCitationsEvent(citations: Citation[]): string {
  return createSseDataLine({ type: STREAM_EVENT.CITATIONS, citations })
}

export function createErrorEvent(errorMessage: string): string {
  return createSseDataLine({ type: STREAM_EVENT.ERROR, error: errorMessage })
}

export function createCompleteEvent(params: {
  content: string
  modelId: string
  citations?: Citation[]
  chatId?: string
  title?: string | null
  userMessageId?: string
  assistantMessageId?: string
}): string {
  return createSseDataLine({
    type: STREAM_EVENT.COMPLETE,
    content: params.content,
    modelId: params.modelId,
    citations: params.citations ?? [],
    chatId: params.chatId,
    title: params.title ?? null,
    userMessageId: params.userMessageId,
    assistantMessageId: params.assistantMessageId,
  })
}

export function createDoneEvent(): string {
  return `data: ${STREAM_EVENT.DONE}\n\n`
}

export function createJsonErrorResponse(errorMessage: string, statusCode: number): Response {
  return Response.json({ success: false, error: errorMessage }, { status: statusCode })
}
