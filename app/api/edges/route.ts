import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'

export const runtime = 'edge'

export interface GraphEdge {
  id: string
  sourceChatId: string
  targetChatId: string
  sourceNodeId: string
  targetNodeId: string
}

/**
 * Fork edges only: a chat's first user message whose parent lives in another chat.
 * Same-chat follow-ups (star topology via root_node_id) must not appear as graph edges.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: CHAT_ERROR_MESSAGE.UNAUTHORIZED },
      { status: 401 }
    )
  }

  const { data: chats, error: chatsError } = await supabase
    .from('chats')
    .select('id, root_node_id')
    .eq('user_id', user.id)

  if (chatsError) {
    return NextResponse.json({ success: false, error: chatsError.message }, { status: 500 })
  }

  const { data: nodes, error: nodesError } = await supabase
    .from('nodes')
    .select('id, chat_id, parent_id, role, created_at')
    .eq('user_id', user.id)
    .eq('role', 'user')
    .not('parent_id', 'is', null)
    .order('created_at', { ascending: true })

  if (nodesError) {
    return NextResponse.json({ success: false, error: nodesError.message }, { status: 500 })
  }

  const rootNodeIds = new Set(
    (chats ?? []).map((chat) => chat.root_node_id).filter(Boolean) as string[]
  )

  // First user message per chat (by created_at) — only these can define a fork edge.
  const firstUserNodeByChat = new Map<string, string>()
  for (const node of nodes ?? []) {
    if (!firstUserNodeByChat.has(node.chat_id)) {
      firstUserNodeByChat.set(node.chat_id, node.id)
    }
  }

  const candidateNodes = (nodes ?? []).filter((node) => {
    const isFirstInChat = firstUserNodeByChat.get(node.chat_id) === node.id
    const isRoot = rootNodeIds.has(node.id)
    return Boolean(node.parent_id) && (isFirstInChat || isRoot)
  })

  const parentIds = Array.from(
    new Set(candidateNodes.map((node) => node.parent_id).filter(Boolean) as string[])
  )

  if (parentIds.length === 0) {
    return NextResponse.json({ success: true, edges: [] as GraphEdge[] })
  }

  const { data: parents, error: parentsError } = await supabase
    .from('nodes')
    .select('id, chat_id')
    .eq('user_id', user.id)
    .in('id', parentIds)

  if (parentsError) {
    return NextResponse.json({ success: false, error: parentsError.message }, { status: 500 })
  }

  const parentChatById = new Map((parents ?? []).map((parent) => [parent.id, parent.chat_id]))
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  for (const node of candidateNodes) {
    if (!node.parent_id) {
      continue
    }
    const sourceChatId = parentChatById.get(node.parent_id)
    if (!sourceChatId || sourceChatId === node.chat_id) {
      continue
    }

    const edgeKey = `${sourceChatId}->${node.chat_id}`
    if (seen.has(edgeKey)) {
      continue
    }
    seen.add(edgeKey)

    edges.push({
      id: edgeKey,
      sourceChatId,
      targetChatId: node.chat_id,
      sourceNodeId: node.parent_id,
      targetNodeId: node.id,
    })
  }

  return NextResponse.json({ success: true, edges })
}
