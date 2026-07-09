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
    return NextResponse.json({ success: true, chat })
  }

  const chats = await listChatsForUser(supabase, user.id)
  return NextResponse.json({ success: true, chats })
}
