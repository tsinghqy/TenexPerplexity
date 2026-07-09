import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'

export const runtime = 'edge'

const RUN_SELECT =
  'id, question, status, root_chat_id, overall_confidence, created_at' as const

/** List the user's research runs, newest first, for the research history sidebar. */
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

  const { data: runs, error } = await supabase
    .from('research_runs')
    .select(RUN_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[research] list runs failed:', error.message)
    return NextResponse.json(
      { success: false, error: 'Failed to load research history' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, runs: runs ?? [] })
}
