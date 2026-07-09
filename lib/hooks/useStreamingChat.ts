'use client'

import { useCallback, useRef, useState } from 'react'
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
  const [isStreaming, setIsStreaming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState(initialModelId || CLIENT_DEFAULT_MODEL_ID)
  const [useWebSearch, setUseWebSearch] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsStreaming(false)
  }, [])

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const messageContent = rawMessage.trim()
      if (!messageContent || isStreaming) {
        return
      }

      setErrorMessage(null)

      const userMessage: ChatThreadMessage = {
        id: createMessageId('user'),
        role: 'user',
        content: messageContent,
      }
      const assistantMessageId = createMessageId('assistant')
      const assistantPlaceholder: ChatThreadMessage = {
        id: assistantMessageId,
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
          signal: abortController.signal,
          onChunk: (chunk) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: message.content + chunk }
                  : message
              )
            )
          },
          onCitations: (citations) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId ? { ...message, citations } : message
              )
            )
          },
          onComplete: (content, _modelId, citations) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content,
                      citations: citations.length > 0 ? citations : message.citations,
                      isStreaming: false,
                    }
                  : message
              )
            )
          },
          onError: (streamErrorMessage) => {
            setErrorMessage(streamErrorMessage)
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
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
              message.id === assistantMessageId ? { ...message, isStreaming: false } : message
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
    [isStreaming, messages, selectedModelId, useWebSearch]
  )

  const clearMessages = useCallback(() => {
    stopStreaming()
    setMessages([])
    setErrorMessage(null)
  }, [stopStreaming])

  return {
    messages,
    isStreaming,
    errorMessage,
    selectedModelId,
    setSelectedModelId,
    useWebSearch,
    setUseWebSearch,
    sendMessage,
    stopStreaming,
    clearMessages,
  }
}
