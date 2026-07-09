import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'
import { BRANCH_SYNTHESIS_PREFIX } from '@/lib/research/config'
import type { ResearchRunStatus } from '@/lib/supabase/database.types'

export const runtime = 'edge'

const RUN_SELECT =
  'id, question, status, root_chat_id, overall_confidence, created_at' as const

const CLAIM_SELECT =
  'id, node_id, user_id, claim_text, start_offset, end_offset, verdict, confidence, source_url, source_title, source_quote, created_at' as const

const CLIENT_UPDATABLE_STATUSES: ResearchRunStatus[] = ['cancelled', 'failed', 'scoring']

/**
 * Load one research run with everything needed to rebuild its view: branch
 * chats (question, answer preview, confidence, summary, lineage) plus the
 * final synthesis and its verified claims.
 */
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

  const { data: runChats } = await supabase
    .from('chats')
    .select('id, title, confidence, summary, root_node_id, created_at')
    .eq('research_run_id', run.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const rootChat = (runChats ?? []).find((chat) => chat.id === run.root_chat_id) ?? null
  const branchChats = (runChats ?? []).filter((chat) => chat.id !== run.root_chat_id)
  const rootNodeId = rootChat?.root_node_id ?? null

  const chatIds = (runChats ?? []).map((chat) => chat.id)
  const { data: nodes } = chatIds.length
    ? await supabase
        .from('nodes')
        .select('id, chat_id, parent_id, role, content, created_at')
        .in('chat_id', chatIds)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  // Per branch chat: the first user node carries the lineage (parent_id points
  // at the node the branch was spawned from), the last non-synthesis assistant
  // node is the branch's answer.
  const firstUserNodeByChat = new Map<string, { parent_id: string | null }>()
  const answerNodeByChat = new Map<string, { id: string; content: string }>()
  const nodeChatById = new Map<string, string>()
  for (const node of nodes ?? []) {
    nodeChatById.set(node.id, node.chat_id)
    if (node.role === 'user' && !firstUserNodeByChat.has(node.chat_id)) {
      firstUserNodeByChat.set(node.chat_id, { parent_id: node.parent_id })
    }
    if (node.role === 'assistant' && !node.content.startsWith(BRANCH_SYNTHESIS_PREFIX)) {
      answerNodeByChat.set(node.chat_id, { id: node.id, content: node.content })
    }
  }

  // Depth: 1 for branches spawned from the root question node, +1 for each
  // deep-dive level (parent node lives in another branch chat).
  const depthByChat = new Map<string, number>()
  const resolveDepth = (chatId: string, guard = 0): number => {
    const known = depthByChat.get(chatId)
    if (known) {
      return known
    }
    if (guard > 10) {
      return 1
    }
    const parentNodeId = firstUserNodeByChat.get(chatId)?.parent_id ?? null
    let depth = 1
    if (parentNodeId && parentNodeId !== rootNodeId) {
      const parentChatId = nodeChatById.get(parentNodeId)
      if (parentChatId && parentChatId !== run.root_chat_id && parentChatId !== chatId) {
        depth = resolveDepth(parentChatId, guard + 1) + 1
      }
    }
    depthByChat.set(chatId, depth)
    return depth
  }

  const runFinished = ['complete', 'failed', 'cancelled'].includes(run.status)
  const branches = branchChats.map((chat) => {
    const answer = answerNodeByChat.get(chat.id) ?? null
    return {
      chatId: chat.id,
      subQuestion: chat.title || 'Sub-question',
      status: answer ? 'done' : runFinished ? 'cancelled' : 'queued',
      depth: resolveDepth(chat.id),
      parentNodeId: firstUserNodeByChat.get(chat.id)?.parent_id ?? rootNodeId ?? '',
      preview: answer ? answer.content : '',
      confidence: typeof chat.confidence === 'number' ? chat.confidence : null,
      summary: chat.summary ?? null,
      assistantNodeId: answer?.id ?? null,
    }
  })

  // The synthesis is the last assistant answer in the root chat.
  const synthesisNode = run.root_chat_id ? (answerNodeByChat.get(run.root_chat_id) ?? null) : null
  let synthesisClaims: unknown[] = []
  if (synthesisNode) {
    const { data: claims } = await supabase
      .from('node_claims')
      .select(CLAIM_SELECT)
      .eq('node_id', synthesisNode.id)
      .eq('user_id', user.id)
      .order('start_offset', { ascending: true })
    synthesisClaims = claims ?? []
  }

  return NextResponse.json({
    success: true,
    run,
    rootNodeId,
    branches,
    synthesis: synthesisNode?.content ?? null,
    synthesisClaims,
    quickSummary: rootChat?.summary ?? null,
  })
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
