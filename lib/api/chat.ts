import type { Citation } from '@/lib/llm/citations'
import type { ChatMessage } from '@/lib/llm/types'
import type { PersistedMessageNode } from '@/lib/chat/persist'

export interface ChatSummary {
  id: string
  title: string | null
  updated_at: string
  created_at: string
}

export interface ChatWithNodesResponse {
  success: boolean
  chat?: {
    id: string
    title: string | null
    updated_at: string
    created_at: string
    nodes: PersistedMessageNode[]
  }
  error?: string
}

export interface ChatsListResponse {
  success: boolean
  chats?: ChatSummary[]
  error?: string
}

export async function getChats(): Promise<ChatsListResponse> {
  try {
    const response = await fetch('/api/chat', { method: 'GET' })
    const payload = (await response.json()) as ChatsListResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load chats',
    }
  }
}

export async function getChat(chatId: string): Promise<ChatWithNodesResponse> {
  try {
    const response = await fetch(`/api/chat?chatId=${encodeURIComponent(chatId)}`, {
      method: 'GET',
    })
    const payload = (await response.json()) as ChatWithNodesResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load chat',
    }
  }
}

export function persistedNodesToHistory(nodes: PersistedMessageNode[]): ChatMessage[] {
  return nodes.map((node) => ({
    role: node.role,
    content: node.content,
  }))
}

export function persistedNodesToThreadMessages(
  nodes: PersistedMessageNode[]
): Array<{
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}> {
  return nodes.map((node) => ({
    id: node.id,
    role: node.role,
    content: node.content,
  }))
}
