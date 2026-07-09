import type { AppSupabaseClient } from '@/lib/chat/persist'
import type { ContextMessage } from '@/lib/rag/retriever'

/**
 * Walk ancestor messages via parent_id (works across chats for forks).
 * Prefers get_node_parent_tree RPC when available.
 */
export async function retrieveAncestorPathContext(
  supabase: AppSupabaseClient,
  params: {
    userId: string
    startParentId: string | null
    excludeNodeId?: string
    maxNodes?: number
  }
): Promise<ContextMessage[]> {
  if (!params.startParentId) {
    return []
  }

  const maxNodes = params.maxNodes ?? 40

  const { data: pathRows, error: pathError } = await supabase.rpc('get_node_parent_tree', {
    p_node_id: params.startParentId,
    p_user_id: params.userId,
  })

  if (!pathError && Array.isArray(pathRows) && pathRows.length > 0) {
    return pathRows
      .filter((row) => row.id !== params.excludeNodeId)
      .slice(-maxNodes)
      .map((row) => ({
        id: row.id,
        role: row.role as 'user' | 'assistant',
        content: row.content,
      }))
  }

  // Manual walk fallback if RPC is unavailable.
  const collected: ContextMessage[] = []
  let currentId: string | null = params.startParentId
  const seen = new Set<string>()

  while (currentId && collected.length < maxNodes && !seen.has(currentId)) {
    seen.add(currentId)
    const { data, error } = await supabase
      .from('nodes')
      .select('id, role, content, parent_id')
      .eq('id', currentId)
      .eq('user_id', params.userId)
      .single()

    if (error || !data) {
      break
    }

    const ancestor: {
      id: string
      role: 'user' | 'assistant'
      content: string
      parent_id: string | null
    } = {
      id: data.id,
      role: data.role as 'user' | 'assistant',
      content: data.content,
      parent_id: data.parent_id,
    }

    if (ancestor.id !== params.excludeNodeId) {
      collected.push({
        id: ancestor.id,
        role: ancestor.role,
        content: ancestor.content,
      })
    }

    currentId = ancestor.parent_id
  }

  return collected.reverse()
}

export function mergeContextMessages(
  primary: ContextMessage[],
  secondary: ContextMessage[]
): ContextMessage[] {
  const seen = new Set(primary.map((message) => message.id))
  const merged = [...primary]

  for (const message of secondary) {
    if (seen.has(message.id)) {
      continue
    }
    seen.add(message.id)
    merged.push(message)
  }

  return merged
}
