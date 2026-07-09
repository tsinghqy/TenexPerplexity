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
  updateNodeEmbedding,
  verifyChatOwnership,
} from '@/lib/chat/persist'
import { generateEmbeddingOrNull } from '@/lib/llm/embeddings'
import { getDefaultModelId, isValidModelId } from '@/lib/llm/models'
import { llmProviderManager } from '@/lib/llm/provider-manager'
import {
  appendContextToSystemPrompt,
  buildContextString,
  contextMessagesToChatMessages,
  retrieveLinearChatContext,
} from '@/lib/rag/retriever'
import { mergeContextMessages, retrieveAncestorPathContext } from '@/lib/rag/path-context'
import { extractCitationsFromMarkdown, type Citation } from '@/lib/llm/citations'
import type { ChatMessage } from '@/lib/llm/types'

export const runtime = 'edge'

function withPersistedSourceLinks(content: string, citations: Citation[]): string {
  if (citations.length === 0) {
    return content
  }

  const alreadyLinked = new Set(
    extractCitationsFromMarkdown(content).map((citation) => citation.url)
  )
  const missing = citations.filter((citation) => !alreadyLinked.has(citation.url))
  if (missing.length === 0) {
    return content
  }

  const lines = missing.map(
    (citation, index) => `${index + 1}. [${citation.title}](${citation.url})`
  )
  return `${content.trimEnd()}\n\nSources:\n${lines.join('\n')}`
}

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

  // Start embedding in parallel with the user-message insert.
  const embeddingPromise = generateEmbeddingOrNull(userMessageContent)

  const userNode = await insertUserMessage(supabase, {
    chatId,
    userId: user.id,
    content: userMessageContent,
    parentId,
    embedding: null,
  })

  if (!userNode) {
    return createJsonErrorResponse('Failed to save user message', 500)
  }

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

        const embedding = await embeddingPromise
        if (embedding) {
          // Fire-and-forget persist so vector search works on later turns.
          void updateNodeEmbedding(supabase, {
            nodeId: userNode.id,
            userId: user.id,
            embedding,
          })
        }

        const linearContext = await retrieveLinearChatContext(supabase, {
          chatId: chatId!,
          userId: user.id,
          excludeNodeId: userNode.id,
          queryEmbedding: embedding,
        })

        const ancestorContext = await retrieveAncestorPathContext(supabase, {
          userId: user.id,
          startParentId: parentId,
          excludeNodeId: userNode.id,
        })

        const contextMessages = mergeContextMessages(ancestorContext, linearContext)

        const conversationMessages: ChatMessage[] = [
          ...contextMessagesToChatMessages(contextMessages),
          { role: 'user', content: userMessageContent },
        ]

        const systemPrompt = appendContextToSystemPrompt(
          DEFAULT_CHAT_SYSTEM_PROMPT,
          buildContextString(contextMessages)
        )

        const result = await llmProviderManager.streamChat({
          modelId,
          messages: conversationMessages,
          systemPrompt,
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
        const contentToPersist = withPersistedSourceLinks(result.content, citations)
        const assistantNode = await insertAssistantMessage(supabase, {
          chatId: chatId!,
          userId: user.id,
          content: contentToPersist,
          parentId: userNode.id,
        })

        enqueue(
          createCompleteEvent({
            content: contentToPersist,
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
