import type { AppSupabaseClient } from '@/lib/chat/persist'
import type { ChatMessage } from '@/lib/llm/types'

export interface ContextMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  similarity?: number
}

/**
 * Build a token-capped prose context block for the system prompt.
 */
export function buildContextString(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number = 4000
): string {
  if (messages.length === 0) {
    return ''
  }

  let context = ''
  let estimatedTokens = 0

  for (const message of messages) {
    const messageText = `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}\n\n`
    const messageTokens = Math.ceil(messageText.length / 4)

    if (estimatedTokens + messageTokens > maxTokens) {
      break
    }

    context += messageText
    estimatedTokens += messageTokens
  }

  return context.trim()
}

export function appendContextToSystemPrompt(systemPrompt: string, contextString: string): string {
  if (!contextString) {
    return systemPrompt
  }

  return `${systemPrompt}\n\nUse the following conversation context to inform your response:\n\n${contextString}`
}

/**
 * Load prior messages for a linear chat from the database (source of truth for follow-ups).
 * Optionally merges vector-similar user messages from the same chat.
 */
export async function retrieveLinearChatContext(
  supabase: AppSupabaseClient,
  params: {
    chatId: string
    userId: string
    excludeNodeId?: string
    queryEmbedding?: number[] | null
    maxMessages?: number
  }
): Promise<ContextMessage[]> {
  const maxMessages = params.maxMessages ?? 40

  const { data: nodes, error } = await supabase
    .from('nodes')
    .select('id, role, content, created_at')
    .eq('chat_id', params.chatId)
    .eq('user_id', params.userId)
    .order('created_at', { ascending: true })
    .limit(maxMessages + 5)

  if (error) {
    console.error('[rag] failed to load chat nodes:', error.message)
    return []
  }

  const chronological = (nodes ?? [])
    .filter((node) => node.id !== params.excludeNodeId)
    .slice(-maxMessages)
    .map((node) => ({
      id: node.id,
      role: node.role as 'user' | 'assistant',
      content: node.content,
    }))

  if (!params.queryEmbedding) {
    return chronological
  }

  const { data: similarNodes, error: searchError } = await supabase.rpc('search_chat_nodes_safe', {
    p_user_id: params.userId,
    p_chat_id: params.chatId,
    p_query_embedding: params.queryEmbedding,
    p_limit: 5,
    p_similarity_threshold: 0.7,
  })

  if (searchError) {
    // RPC may be missing until P5 SQL is applied — chronological context still works.
    console.warn('[rag] vector search unavailable:', searchError.message)
    return chronological
  }

  const seenIds = new Set(chronological.map((message) => message.id))
  const extras: ContextMessage[] = []

  for (const node of similarNodes ?? []) {
    if (node.id === params.excludeNodeId || seenIds.has(node.id)) {
      continue
    }
    extras.push({
      id: node.id,
      role: node.role as 'user' | 'assistant',
      content: node.content,
      similarity: node.similarity,
    })
    seenIds.add(node.id)
  }

  if (extras.length === 0) {
    return chronological
  }

  // Keep chronological order for the main thread; append high-similarity extras at the end.
  return [...chronological, ...extras]
}

export function contextMessagesToChatMessages(messages: ContextMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}
