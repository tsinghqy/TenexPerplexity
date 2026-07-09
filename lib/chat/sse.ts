import { STREAM_EVENT } from '@/lib/chat/constants'

export function createSseDataLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export function createChunkEvent(content: string): string {
  return createSseDataLine({ type: STREAM_EVENT.CHUNK, content })
}

export function createErrorEvent(errorMessage: string): string {
  return createSseDataLine({ type: STREAM_EVENT.ERROR, error: errorMessage })
}

export function createCompleteEvent(content: string, modelId: string): string {
  return createSseDataLine({
    type: STREAM_EVENT.COMPLETE,
    content,
    modelId,
  })
}

export function createDoneEvent(): string {
  return `data: ${STREAM_EVENT.DONE}\n\n`
}

export function createJsonErrorResponse(errorMessage: string, statusCode: number): Response {
  return Response.json({ success: false, error: errorMessage }, { status: statusCode })
}
