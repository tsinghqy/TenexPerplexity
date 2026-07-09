'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  forkFromNode,
  getChat,
  getChats,
  getGraphEdges,
  type ChatSummary,
  type GraphEdgeSummary,
} from '@/lib/api/chat'
import { sendMessageStreaming } from '@/lib/api/chat-stream'
import { verifyNode, type NodeClaim } from '@/lib/api/verify'
import { CLIENT_DEFAULT_MODEL_ID } from '@/lib/llm/client-defaults'
import { extractCitationsFromMarkdown, type Citation } from '@/lib/llm/citations'
import { computeGroundedScore } from '@/lib/verify/score'
import type { ChatMessage } from '@/lib/llm/types'

export interface ChatThreadMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  claims?: NodeClaim[]
  /** 0–100 grounded score from claim verification. */
  confidence?: number | null
  isStreaming?: boolean
  isVerifying?: boolean
}

function confidenceFromClaims(claims: NodeClaim[]): number | null {
  return computeGroundedScore(
    claims.map((claim) => ({ text: claim.claim_text, verdict: claim.verdict }))
  )
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
  const [edges, setEdges] = useState<GraphEdgeSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [branchParentNodeId, setBranchParentNodeId] = useState<string | null>(null)
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState(initialModelId || CLIENT_DEFAULT_MODEL_ID)
  const [useWebSearch, setUseWebSearch] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const refreshChats = useCallback(async () => {
    const [chatsResult, edgesResult] = await Promise.all([getChats(), getGraphEdges()])
    if (!chatsResult.success) {
      setErrorMessage(chatsResult.error || 'Failed to load chats')
      return
    }
    setChats(chatsResult.chats || [])
    if (edgesResult.success) {
      setEdges(edgesResult.edges || [])
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadInitialChats() {
      setIsLoadingChats(true)
      const [chatsResult, edgesResult] = await Promise.all([getChats(), getGraphEdges()])
      if (cancelled) {
        return
      }

      if (!chatsResult.success) {
        setErrorMessage(chatsResult.error || 'Failed to load chats')
        setIsLoadingChats(false)
        return
      }

      setChats(chatsResult.chats || [])
      if (edgesResult.success) {
        setEdges(edgesResult.edges || [])
      }
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
      setBranchParentNodeId(null)
      setIsLoadingMessages(true)
      setActiveChatId(chatId)

      const result = await getChat(chatId)
      setIsLoadingMessages(false)

      if (!result.success || !result.chat) {
        setErrorMessage(result.error || 'Failed to load chat')
        return
      }

      const claimsByNode = new Map<string, NodeClaim[]>()
      for (const claim of result.claims ?? []) {
        const list = claimsByNode.get(claim.node_id) || []
        list.push(claim)
        claimsByNode.set(claim.node_id, list)
      }

      setMessages(
        result.chat.nodes.map((node) => {
          const claims = claimsByNode.get(node.id)
          return {
            id: node.id,
            role: node.role,
            content: node.content,
            citations:
              node.role === 'assistant'
                ? extractCitationsFromMarkdown(node.content)
                : undefined,
            claims,
            confidence: claims ? confidenceFromClaims(claims) : undefined,
          }
        })
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
    setBranchParentNodeId(null)
    setMessages([])
    setErrorMessage(null)
  }, [isStreaming, stopStreaming])

  const branchFromMessage = useCallback(
    async (nodeId: string) => {
      if (isStreaming) {
        return
      }

      setErrorMessage(null)
      const result = await forkFromNode(nodeId)
      if (!result.success || !result.chatId || !result.parentNodeId) {
        setErrorMessage(result.error || 'Failed to create branch')
        return
      }

      setActiveChatId(result.chatId)
      setBranchParentNodeId(result.parentNodeId)
      setMessages([])
      await refreshChats()
    },
    [isStreaming, refreshChats]
  )

  const verifyMessage = useCallback(async (nodeId: string) => {
    setErrorMessage(null)
    setMessages((current) =>
      current.map((message) =>
        message.id === nodeId ? { ...message, isVerifying: true } : message
      )
    )

    const result = await verifyNode(nodeId)

    setMessages((current) =>
      current.map((message) => {
        if (message.id !== nodeId) {
          return message
        }
        if (!result.success) {
          return { ...message, isVerifying: false }
        }
        return {
          ...message,
          isVerifying: false,
          claims: result.claims ?? [],
          confidence: result.confidence ?? null,
        }
      })
    )

    if (!result.success) {
      setErrorMessage(result.error || 'Verification failed')
    }
    return result
  }, [])

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
      const parentIdForRequest = branchParentNodeId || undefined

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
          parentId: parentIdForRequest,
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
            setBranchParentNodeId(null)

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
    [
      activeChatId,
      branchParentNodeId,
      isStreaming,
      messages,
      refreshChats,
      selectedModelId,
      useWebSearch,
    ]
  )

  return {
    messages,
    chats,
    edges,
    activeChatId,
    branchParentNodeId,
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
    branchFromMessage,
    verifyMessage,
    refreshChats,
  }
}
