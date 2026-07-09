import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createChat } from '@/lib/chat/persist'
import { generateChatTitleFromFirstMessage } from '@/lib/chat/title'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'

export const runtime = 'edge'

/**
 * Create a new chat branched from an assistant (or user) message node.
 * The new chat's first message should be streamed with parentId = source node.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
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

  const { nodeId } = await params

  const { data: sourceNode, error: sourceError } = await supabase
    .from('nodes')
    .select('id, chat_id, user_id, role, content')
    .eq('id', nodeId)
    .eq('user_id', user.id)
    .single()

  if (sourceError || !sourceNode) {
    return NextResponse.json({ success: false, error: 'Source message not found' }, { status: 404 })
  }

  const createdChat = await createChat(supabase, user.id)
  if (!createdChat) {
    return NextResponse.json({ success: false, error: 'Failed to create branch chat' }, { status: 500 })
  }

  const branchTitle = generateChatTitleFromFirstMessage([
    { role: 'user', content: `Branch: ${sourceNode.content.slice(0, 40)}` },
  ])

  if (branchTitle && branchTitle !== 'New Chat') {
    await supabase.from('chats').update({ title: branchTitle }).eq('id', createdChat.id)
  }

  // Place the new chat to the right of a simple grid for Explore.
  const { count } = await supabase
    .from('chats')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const index = count ?? 1
  const positionX = 80 + ((index - 1) % 4) * 280
  const positionY = 80 + Math.floor((index - 1) / 4) * 160

  await supabase
    .from('chats')
    .update({ position_x: positionX, position_y: positionY })
    .eq('id', createdChat.id)

  return NextResponse.json({
    success: true,
    chatId: createdChat.id,
    parentNodeId: sourceNode.id,
    sourceChatId: sourceNode.chat_id,
    title: branchTitle,
  })
}
