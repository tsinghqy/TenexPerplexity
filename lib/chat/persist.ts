import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, MessageRole } from '@/lib/supabase/database.types'
import { generateChatTitleFromFirstMessage } from '@/lib/chat/title'

export type AppSupabaseClient = SupabaseClient<Database>

export interface PersistedMessageNode {
  id: string
  chat_id: string
  user_id: string
  parent_id: string | null
  role: MessageRole
  content: string
  created_at: string
}

export interface PersistedChat {
  id: string
  user_id: string
  title: string | null
  root_node_id: string | null
  position_x?: number | null
  position_y?: number | null
  research_run_id?: string | null
  confidence?: number | null
  created_at: string
  updated_at: string
}

export interface PersistedChatWithMessages extends PersistedChat {
  nodes: PersistedMessageNode[]
}

const MESSAGE_NODE_SELECT =
  'id, chat_id, user_id, parent_id, role, content, created_at' as const

export async function createChat(
  supabase: AppSupabaseClient,
  userId: string
): Promise<PersistedChat | null> {
  const { data, error } = await supabase
    .from('chats')
    .insert({ user_id: userId, title: null })
    .select('id, user_id, title, root_node_id, created_at, updated_at')
    .single()

  if (error || !data) {
    console.error('[persist] createChat failed:', error?.message)
    return null
  }

  return data
}

export async function verifyChatOwnership(
  supabase: AppSupabaseClient,
  chatId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', userId)
    .single()

  return !error && Boolean(data)
}

export async function resolveParentIdForNewUserMessage(
  supabase: AppSupabaseClient,
  chatId: string,
  userId: string,
  explicitParentId?: string | null
): Promise<string | null> {
  if (explicitParentId) {
    return explicitParentId
  }

  const { data, error } = await supabase
    .from('chats')
    .select('root_node_id')
    .eq('id', chatId)
    .eq('user_id', userId)
    .single()

  if (error || !data?.root_node_id) {
    return null
  }

  return data.root_node_id
}

export async function insertUserMessage(
  supabase: AppSupabaseClient,
  params: {
    chatId: string
    userId: string
    content: string
    parentId: string | null
    embedding?: number[] | null
  }
): Promise<PersistedMessageNode | null> {
  const { data, error } = await supabase
    .from('nodes')
    .insert({
      chat_id: params.chatId,
      user_id: params.userId,
      parent_id: params.parentId,
      role: 'user',
      content: params.content,
      embedding: params.embedding ?? null,
    })
    .select(MESSAGE_NODE_SELECT)
    .single()

  if (error || !data) {
    console.error('[persist] insertUserMessage failed:', error?.message)
    return null
  }

  if (params.parentId === null) {
    const { error: rootError } = await supabase
      .from('chats')
      .update({ root_node_id: data.id })
      .eq('id', params.chatId)
      .eq('user_id', params.userId)

    if (rootError) {
      console.error('[persist] failed to set root_node_id:', rootError.message)
    }
  } else {
    // First message in a forked chat still becomes this chat's root, even when parent is cross-chat.
    const { data: chat } = await supabase
      .from('chats')
      .select('root_node_id')
      .eq('id', params.chatId)
      .eq('user_id', params.userId)
      .single()

    if (chat && !chat.root_node_id) {
      await supabase
        .from('chats')
        .update({ root_node_id: data.id })
        .eq('id', params.chatId)
        .eq('user_id', params.userId)
    }
  }

  return data
}

export async function updateNodeEmbedding(
  supabase: AppSupabaseClient,
  params: {
    nodeId: string
    userId: string
    embedding: number[]
  }
): Promise<void> {
  const { error } = await supabase
    .from('nodes')
    .update({ embedding: params.embedding })
    .eq('id', params.nodeId)
    .eq('user_id', params.userId)

  if (error) {
    console.error('[persist] updateNodeEmbedding failed:', error.message)
  }
}

export async function insertAssistantMessage(
  supabase: AppSupabaseClient,
  params: {
    chatId: string
    userId: string
    content: string
    parentId: string
  }
): Promise<PersistedMessageNode | null> {
  const { data, error } = await supabase
    .from('nodes')
    .insert({
      chat_id: params.chatId,
      user_id: params.userId,
      parent_id: params.parentId,
      role: 'assistant',
      content: params.content,
      embedding: null,
    })
    .select(MESSAGE_NODE_SELECT)
    .single()

  if (error || !data) {
    console.error('[persist] insertAssistantMessage failed:', error?.message)
    return null
  }

  await supabase
    .from('chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.chatId)
    .eq('user_id', params.userId)

  return data
}

export async function persistTitleForNewChat(
  supabase: AppSupabaseClient,
  chatId: string,
  userMessageContent: string
): Promise<string | null> {
  const title = generateChatTitleFromFirstMessage([
    { role: 'user', content: userMessageContent },
  ])

  if (!title || title === 'New Chat') {
    return null
  }

  const { error } = await supabase.from('chats').update({ title }).eq('id', chatId)
  if (error) {
    console.error('[persist] title update failed:', error.message)
    return null
  }

  return title
}

export async function listChatsForUser(
  supabase: AppSupabaseClient,
  userId: string
): Promise<PersistedChat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select(
      'id, user_id, title, root_node_id, position_x, position_y, research_run_id, confidence, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (!error) {
    return data ?? []
  }

  // Fallback for databases without the p8_research.sql migration: never let a
  // missing column blank out the user's chat list.
  console.error('[persist] listChatsForUser failed, retrying legacy columns:', error.message)
  const { data: legacyData, error: legacyError } = await supabase
    .from('chats')
    .select('id, user_id, title, root_node_id, position_x, position_y, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (legacyError) {
    console.error('[persist] listChatsForUser legacy retry failed:', legacyError.message)
    return []
  }

  return legacyData ?? []
}

export async function getChatWithMessages(
  supabase: AppSupabaseClient,
  chatId: string,
  userId: string
): Promise<PersistedChatWithMessages | null> {
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id, user_id, title, root_node_id, created_at, updated_at')
    .eq('id', chatId)
    .eq('user_id', userId)
    .single()

  if (chatError || !chat) {
    return null
  }

  const { data: nodes, error: nodesError } = await supabase
    .from('nodes')
    .select(MESSAGE_NODE_SELECT)
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (nodesError) {
    console.error('[persist] getChatWithMessages nodes failed:', nodesError.message)
    return { ...chat, nodes: [] }
  }

  return {
    ...chat,
    nodes: nodes ?? [],
  }
}
