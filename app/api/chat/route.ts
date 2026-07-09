import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getChatWithMessages, listChatsForUser } from '@/lib/chat/persist'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'

export const runtime = 'edge'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { success: false, error: CHAT_ERROR_MESSAGE.UNAUTHORIZED },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const chatId = searchParams.get('chatId')

  if (chatId) {
    const chat = await getChatWithMessages(supabase, chatId, user.id)
    if (!chat) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 })
    }

    // Include persisted claim verdicts so lie-detector highlights survive reload.
    const nodeIds = chat.nodes.map((node) => node.id)
    let claims: unknown[] = []
    if (nodeIds.length > 0) {
      const { data } = await supabase
        .from('node_claims')
        .select(
          'id, node_id, user_id, claim_text, start_offset, end_offset, verdict, confidence, source_url, source_title, source_quote, created_at'
        )
        .in('node_id', nodeIds)
        .eq('user_id', user.id)
        .order('start_offset', { ascending: true })
      claims = data ?? []
    }

    return NextResponse.json({ success: true, chat, claims })
  }

  const chats = await listChatsForUser(supabase, user.id)

  // Mark research-run winners so Explore/Research views can crown them.
  const { data: winnerRows } = await supabase
    .from('research_runs')
    .select('winning_chat_id')
    .eq('user_id', user.id)
    .not('winning_chat_id', 'is', null)

  const winnerIds = new Set((winnerRows ?? []).map((row) => row.winning_chat_id))
  const chatsWithWinners = chats.map((chat) => ({
    ...chat,
    is_winner: winnerIds.has(chat.id),
  }))

  return NextResponse.json({ success: true, chats: chatsWithWinners })
}
