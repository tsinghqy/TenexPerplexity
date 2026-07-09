import { createClient } from '@/lib/supabase/server'
import { parseStreamChatRequestBody } from '@/lib/chat/request'
import {
  createChunkEvent,
  createCitationsEvent,
  createCompleteEvent,
  createDoneEvent,
  createErrorEvent,
  createJsonErrorResponse,
} from '@/lib/chat/sse'
import { CHAT_ERROR_MESSAGE, DEFAULT_CHAT_SYSTEM_PROMPT } from '@/lib/chat/constants'
import {
  createChat,
  insertAssistantMessage,
  insertUserMessage,
  persistTitleForNewChat,
  resolveParentIdForNewUserMessage,
  verifyChatOwnership,
} from '@/lib/chat/persist'
import { getDefaultModelId, isValidModelId } from '@/lib/llm/models'
import { llmProviderManager } from '@/lib/llm/provider-manager'
import type { Citation } from '@/lib/llm/citations'
import type { ChatMessage } from '@/lib/llm/types'

export const runtime = 'edge'

async function authenticateRequestUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null }
  }

  return { supabase, user }
}

function resolveModelId(requestedModelId?: string): {
  isValid: boolean
  modelId?: string
  errorMessage?: string
} {
  const modelId = requestedModelId || getDefaultModelId()
  if (!isValidModelId(modelId)) {
    return { isValid: false, errorMessage: `${CHAT_ERROR_MESSAGE.INVALID_MODEL}: ${modelId}` }
  }
  return { isValid: true, modelId }
}

function buildConversationMessages(
  history: ChatMessage[] | undefined,
  userMessage: string
): ChatMessage[] {
  return [...(history ?? []), { role: 'user', content: userMessage }]
}

export async function POST(request: Request) {
  const { supabase, user } = await authenticateRequestUser()
  if (!user) {
    return createJsonErrorResponse(CHAT_ERROR_MESSAGE.UNAUTHORIZED, 401)
  }

  if (!llmProviderManager.hasAnyAvailableProvider()) {
    return createJsonErrorResponse(CHAT_ERROR_MESSAGE.NO_PROVIDER, 503)
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400)
  }

  const parsedBody = parseStreamChatRequestBody(rawBody)
  if (!parsedBody.isValid || !parsedBody.data) {
    return createJsonErrorResponse(parsedBody.errorMessage || CHAT_ERROR_MESSAGE.MISSING_MESSAGE, 400)
  }

  const modelResolution = resolveModelId(parsedBody.data.modelId)
  if (!modelResolution.isValid || !modelResolution.modelId) {
    return createJsonErrorResponse(modelResolution.errorMessage || CHAT_ERROR_MESSAGE.INVALID_MODEL, 400)
  }

  const modelId = modelResolution.modelId
  const useWebSearch = parsedBody.data.useWebSearch === true
  const userMessageContent = parsedBody.data.message
  let chatId = parsedBody.data.chatId
  let isNewChat = false

  if (chatId) {
    const ownsChat = await verifyChatOwnership(supabase, chatId, user.id)
    if (!ownsChat) {
      return createJsonErrorResponse('Chat not found', 404)
    }
  } else {
    const createdChat = await createChat(supabase, user.id)
    if (!createdChat) {
      return createJsonErrorResponse('Failed to create chat', 500)
    }
    chatId = createdChat.id
    isNewChat = true
  }

  const parentId = await resolveParentIdForNewUserMessage(
    supabase,
    chatId,
    user.id,
    parsedBody.data.parentId
  )

  const userNode = await insertUserMessage(supabase, {
    chatId,
    userId: user.id,
    content: userMessageContent,
    parentId,
  })

  if (!userNode) {
    return createJsonErrorResponse('Failed to save user message', 500)
  }

  const conversationMessages = buildConversationMessages(
    parsedBody.data.history,
    userMessageContent
  )

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (text: string) => controller.enqueue(encoder.encode(text))
      let streamedCitations: Citation[] = []
      let persistedTitle: string | null = null

      try {
        if (isNewChat) {
          persistedTitle = await persistTitleForNewChat(supabase, chatId!, userMessageContent)
        }

        const result = await llmProviderManager.streamChat({
          modelId,
          messages: conversationMessages,
          systemPrompt: DEFAULT_CHAT_SYSTEM_PROMPT,
          useWebSearch,
          signal: request.signal,
          onChunk: async (chunk) => {
            enqueue(createChunkEvent(chunk))
          },
          onCitations: async (citations) => {
            streamedCitations = citations
            enqueue(createCitationsEvent(citations))
          },
        })

        const citations = result.citations?.length ? result.citations : streamedCitations
        const assistantNode = await insertAssistantMessage(supabase, {
          chatId: chatId!,
          userId: user.id,
          content: result.content,
          parentId: userNode.id,
        })

        enqueue(
          createCompleteEvent({
            content: result.content,
            modelId,
            citations,
            chatId,
            title: persistedTitle,
            userMessageId: userNode.id,
            assistantMessageId: assistantNode?.id,
          })
        )
        enqueue(createDoneEvent())
        controller.close()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : CHAT_ERROR_MESSAGE.STREAM_FAILED
        enqueue(createErrorEvent(errorMessage))
        enqueue(createDoneEvent())
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
