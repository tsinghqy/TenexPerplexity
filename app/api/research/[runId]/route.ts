import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'
import type { ResearchRunStatus } from '@/lib/supabase/database.types'

export const runtime = 'edge'

const RUN_SELECT =
  'id, question, status, root_chat_id, winning_chat_id, overall_confidence, created_at' as const

const CLIENT_UPDATABLE_STATUSES: ResearchRunStatus[] = ['cancelled', 'failed', 'scoring']

/** Load one research run. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
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

  const { runId } = await params
  const { data: run, error } = await supabase
    .from('research_runs')
    .select(RUN_SELECT)
    .eq('id', runId)
    .eq('user_id', user.id)
    .single()

  if (error || !run) {
    return NextResponse.json({ success: false, error: 'Research run not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, run })
}

/** Update a run's status (cancel from the client, or mark scoring/failed). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
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

  let status: ResearchRunStatus | null = null
  try {
    const body = (await request.json()) as { status?: unknown }
    if (
      typeof body.status === 'string' &&
      CLIENT_UPDATABLE_STATUSES.includes(body.status as ResearchRunStatus)
    ) {
      status = body.status as ResearchRunStatus
    }
  } catch {
    // fall through to validation error
  }

  if (!status) {
    return NextResponse.json(
      { success: false, error: 'status must be one of: cancelled, failed, scoring' },
      { status: 400 }
    )
  }

  const { runId } = await params
  const { data: run, error } = await supabase
    .from('research_runs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('user_id', user.id)
    .select(RUN_SELECT)
    .single()

  if (error || !run) {
    return NextResponse.json({ success: false, error: 'Research run not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, run })
}
