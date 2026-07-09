import type { PersistedMessageNode } from '@/lib/chat/persist'
import type { NodeClaim } from '@/lib/api/verify'

export interface ChatSummary {
  id: string
  title: string | null
  updated_at: string
  created_at: string
  position_x?: number | null
  position_y?: number | null
  research_run_id?: string | null
  confidence?: number | null
  /** Research synthesis summary for hover tooltips (root conclusion or branch finding). */
  summary?: string | null
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
  /** Persisted lie-detector verdicts for the chat's assistant messages. */
  claims?: NodeClaim[]
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

export async function forkFromNode(nodeId: string): Promise<{
  success: boolean
  chatId?: string
  parentNodeId?: string
  title?: string
  error?: string
}> {
  try {
    const response = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/fork`, {
      method: 'POST',
    })
    const payload = (await response.json()) as {
      success: boolean
      chatId?: string
      parentNodeId?: string
      title?: string
      error?: string
    }
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create branch',
    }
  }
}

export interface GraphEdgeSummary {
  id: string
  sourceChatId: string
  targetChatId: string
  sourceNodeId: string
  targetNodeId: string
}

export async function getGraphEdges(): Promise<{
  success: boolean
  edges?: GraphEdgeSummary[]
  error?: string
}> {
  try {
    const response = await fetch('/api/edges')
    const payload = (await response.json()) as {
      success: boolean
      edges?: GraphEdgeSummary[]
      error?: string
    }
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load graph edges',
    }
  }
}

export async function updateChatPosition(
  chatId: string,
  position: { x: number; y: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/chat/${encodeURIComponent(chatId)}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position_x: position.x,
        position_y: position.y,
      }),
    })
    const payload = (await response.json()) as { success: boolean; error?: string }
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save position',
    }
  }
}
