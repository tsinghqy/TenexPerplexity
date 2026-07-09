import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'

export const runtime = 'edge'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
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

  const { chatId } = await params
  let body: { position_x?: unknown; position_y?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.position_x !== 'number' || typeof body.position_y !== 'number') {
    return NextResponse.json(
      { success: false, error: 'position_x and position_y must be numbers' },
      { status: 400 }
    )
  }

  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single()

  if (chatError || !chat) {
    return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('chats')
    .update({
      position_x: body.position_x,
      position_y: body.position_y,
    })
    .eq('id', chatId)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
