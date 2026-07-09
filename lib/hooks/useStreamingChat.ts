'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getChat, getChats, type ChatSummary } from '@/lib/api/chat'
import { sendMessageStreaming } from '@/lib/api/chat-stream'
import { CLIENT_DEFAULT_MODEL_ID } from '@/lib/llm/client-defaults'
import type { Citation } from '@/lib/llm/citations'
import type { ChatMessage } from '@/lib/llm/types'

export interface ChatThreadMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  isStreaming?: boolean
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toHistoryMessages(messages: ChatThreadMessage[]): ChatMessage[] {
  return messages
    .filter((message) => !message.isStreaming && message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
}

export function useStreamingChat(initialModelId?: string) {
  const [messages, setMessages] = useState<ChatThreadMessage[]>([])
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState(initialModelId || CLIENT_DEFAULT_MODEL_ID)
  const [useWebSearch, setUseWebSearch] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const refreshChats = useCallback(async () => {
    const result = await getChats()
    if (!result.success) {
      setErrorMessage(result.error || 'Failed to load chats')
      return
    }
    setChats(result.chats || [])
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadInitialChats() {
      setIsLoadingChats(true)
      const result = await getChats()
      if (cancelled) {
        return
      }

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to load chats')
        setIsLoadingChats(false)
        return
      }

      setChats(result.chats || [])
      setIsLoadingChats(false)
    }

    void loadInitialChats()
    return () => {
      cancelled = true
    }
  }, [])

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsStreaming(false)
  }, [])

  const selectChat = useCallback(
    async (chatId: string) => {
      if (isStreaming) {
        return
      }

      setErrorMessage(null)
      setIsLoadingMessages(true)
      setActiveChatId(chatId)

      const result = await getChat(chatId)
      setIsLoadingMessages(false)

      if (!result.success || !result.chat) {
        setErrorMessage(result.error || 'Failed to load chat')
        return
      }

      setMessages(
        result.chat.nodes.map((node) => ({
          id: node.id,
          role: node.role,
          content: node.content,
        }))
      )
    },
    [isStreaming]
  )

  const startNewChat = useCallback(() => {
    if (isStreaming) {
      return
    }
    stopStreaming()
    setActiveChatId(null)
    setMessages([])
    setErrorMessage(null)
  }, [isStreaming, stopStreaming])

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const messageContent = rawMessage.trim()
      if (!messageContent || isStreaming) {
        return
      }

      setErrorMessage(null)

      const tempUserId = createMessageId('user')
      const tempAssistantId = createMessageId('assistant')
      const userMessage: ChatThreadMessage = {
        id: tempUserId,
        role: 'user',
        content: messageContent,
      }
      const assistantPlaceholder: ChatThreadMessage = {
        id: tempAssistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }

      const history = toHistoryMessages(messages)

      setMessages((current) => [...current, userMessage, assistantPlaceholder])
      setIsStreaming(true)

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        await sendMessageStreaming({
          message: messageContent,
          history,
          modelId: selectedModelId,
          useWebSearch,
          chatId: activeChatId || undefined,
          signal: abortController.signal,
          onChunk: (chunk) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === tempAssistantId
                  ? { ...message, content: message.content + chunk }
                  : message
              )
            )
          },
          onCitations: (citations) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === tempAssistantId ? { ...message, citations } : message
              )
            )
          },
          onComplete: (payload) => {
            if (payload.chatId) {
              setActiveChatId(payload.chatId)
            }

            setMessages((current) =>
              current.map((message) => {
                if (message.id === tempUserId && payload.userMessageId) {
                  return { ...message, id: payload.userMessageId }
                }
                if (message.id === tempAssistantId) {
                  return {
                    ...message,
                    id: payload.assistantMessageId || message.id,
                    content: payload.content,
                    citations:
                      payload.citations.length > 0 ? payload.citations : message.citations,
                    isStreaming: false,
                  }
                }
                return message
              })
            )

            void refreshChats()
          },
          onError: (streamErrorMessage) => {
            setErrorMessage(streamErrorMessage)
            setMessages((current) =>
              current.map((message) =>
                message.id === tempAssistantId
                  ? {
                      ...message,
                      content: message.content || 'Sorry — something went wrong.',
                      isStreaming: false,
                    }
                  : message
              )
            )
          },
        })
      } catch (error) {
        if (abortController.signal.aborted) {
          setMessages((current) =>
            current.map((message) =>
              message.id === tempAssistantId ? { ...message, isStreaming: false } : message
            )
          )
          return
        }

        const fallbackError =
          error instanceof Error ? error.message : 'Failed to stream chat response'
        setErrorMessage(fallbackError)
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [activeChatId, isStreaming, messages, refreshChats, selectedModelId, useWebSearch]
  )

  return {
    messages,
    chats,
    activeChatId,
    isLoadingChats,
    isLoadingMessages,
    isStreaming,
    errorMessage,
    selectedModelId,
    setSelectedModelId,
    useWebSearch,
    setUseWebSearch,
    sendMessage,
    stopStreaming,
    selectChat,
    startNewChat,
    refreshChats,
  }
}
