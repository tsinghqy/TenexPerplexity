import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'
import { generateChatTitleFromFirstMessage } from '@/lib/chat/title'
import { createJsonCompletion } from '@/lib/llm/json-completion'
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  GRAPH_HORIZONTAL_GAP,
  GRAPH_VERTICAL_GAP,
} from '@/lib/graph/layout'
import { resolveFollowUpsPerDeepen, resolveResearchModelId } from '@/lib/research/config'

export const runtime = 'edge'

const COLUMN_STRIDE = GRAPH_NODE_WIDTH + GRAPH_HORIZONTAL_GAP
const ROW_STRIDE = GRAPH_NODE_HEIGHT + GRAPH_VERTICAL_GAP

const DEEPEN_SYSTEM_PROMPT = `
You are a research planner deciding how to dig DEEPER into the most promising path of an ongoing investigation.

You get: the original research question, the sub-question this branch explored, and the branch's answer.

Generate follow-up questions that:
- Probe the weakest or most uncertain parts of the answer (unverified numbers, contested points, missing counterarguments)
- Go one level more specific than the sub-question — never re-ask it or the original question
- Are independently answerable with a web search

Each follow-up gets a one-sentence rationale.
Respond with JSON: {"follow_ups":[{"question":"...","rationale":"..."}]}
`.trim()

interface FollowUp {
  question: string
  rationale: string
}

function parseFollowUps(response: Record<string, unknown>, max: number): FollowUp[] {
  if (!Array.isArray(response.follow_ups)) {
    return []
  }

  const parsed: FollowUp[] = []
  for (const entry of response.follow_ups) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const record = entry as Record<string, unknown>
    const question = typeof record.question === 'string' ? record.question.trim() : ''
    if (!question) {
      continue
    }
    parsed.push({
      question,
      rationale: typeof record.rationale === 'string' ? record.rationale.trim() : '',
    })
    if (parsed.length >= max) {
      break
    }
  }

  return parsed
}

/**
 * Recursive deepening step: given the strongest branch's answer node, plan
 * follow-up questions and create empty child branch chats under it. The
 * client then streams each follow-up with parentId = that answer node.
 */
export async function POST(request: Request) {
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

  let runId = ''
  let parentNodeId = ''
  try {
    const body = (await request.json()) as { runId?: unknown; parentNodeId?: unknown }
    runId = typeof body.runId === 'string' ? body.runId : ''
    parentNodeId = typeof body.parentNodeId === 'string' ? body.parentNodeId : ''
  } catch {
    // fall through to validation error
  }

  if (!runId || !parentNodeId) {
    return NextResponse.json(
      { success: false, error: 'runId and parentNodeId are required' },
      { status: 400 }
    )
  }

  const { data: run, error: runError } = await supabase
    .from('research_runs')
    .select('id, question')
    .eq('id', runId)
    .eq('user_id', user.id)
    .single()

  if (runError || !run) {
    return NextResponse.json({ success: false, error: 'Research run not found' }, { status: 404 })
  }

  const { data: parentNode, error: nodeError } = await supabase
    .from('nodes')
    .select('id, chat_id, role, content')
    .eq('id', parentNodeId)
    .eq('user_id', user.id)
    .single()

  if (nodeError || !parentNode || parentNode.role !== 'assistant') {
    return NextResponse.json(
      { success: false, error: 'Branch answer node not found' },
      { status: 404 }
    )
  }

  const { data: parentChat } = await supabase
    .from('chats')
    .select('id, title, position_x, position_y')
    .eq('id', parentNode.chat_id)
    .eq('user_id', user.id)
    .single()

  const maxFollowUps = resolveFollowUpsPerDeepen()

  let followUps: FollowUp[] = []
  try {
    const response = await createJsonCompletion({
      model: resolveResearchModelId(),
      system: DEEPEN_SYSTEM_PROMPT,
      user: [
        `Original research question: ${run.question}`,
        `This branch explored: ${parentChat?.title || 'a sub-question'}`,
        `Branch answer:\n${parentNode.content.slice(0, 4_000)}`,
        `Generate 1 to ${maxFollowUps} follow-up questions.`,
      ].join('\n\n'),
      maxTokens: 800,
    })
    followUps = parseFollowUps(response, maxFollowUps)
  } catch (error) {
    console.error('[research] deepen planner failed:', error instanceof Error ? error.message : error)
  }

  if (followUps.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No useful follow-up questions were found for this branch.' },
      { status: 502 }
    )
  }

  const { data: branchChats, error: branchError } = await supabase
    .from('chats')
    .insert(
      followUps.map((followUp) => ({
        user_id: user.id,
        title: generateChatTitleFromFirstMessage([
          { role: 'user' as const, content: followUp.question },
        ]),
        research_run_id: run.id,
      }))
    )
    .select('id')

  if (branchError || !branchChats || branchChats.length !== followUps.length) {
    return NextResponse.json(
      { success: false, error: 'Failed to create follow-up branches' },
      { status: 500 }
    )
  }

  // Continue the downward tree: children fan out one row below the parent card.
  if (
    typeof parentChat?.position_x === 'number' &&
    typeof parentChat?.position_y === 'number'
  ) {
    const centerOffset = (followUps.length - 1) / 2
    await Promise.all(
      branchChats.map((chat, index) =>
        supabase
          .from('chats')
          .update({
            position_x: parentChat.position_x! + (index - centerOffset) * COLUMN_STRIDE,
            position_y: parentChat.position_y! + ROW_STRIDE,
          })
          .eq('id', chat.id)
      )
    )
  }

  return NextResponse.json({
    success: true,
    parentNodeId: parentNode.id,
    branches: branchChats.map((chat, index) => ({
      chatId: chat.id,
      subQuestion: followUps[index].question,
      rationale: followUps[index].rationale,
    })),
  })
}
