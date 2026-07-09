import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'
import { insertUserMessage } from '@/lib/chat/persist'
import { generateChatTitleFromFirstMessage } from '@/lib/chat/title'
import { createJsonCompletion } from '@/lib/llm/json-completion'
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  GRAPH_HORIZONTAL_GAP,
  GRAPH_VERTICAL_GAP,
  GRAPH_ORIGIN_X,
  GRAPH_ORIGIN_Y,
} from '@/lib/graph/layout'
import { resolveMaxBranchesPerRun, resolveResearchModelId } from '@/lib/research/config'

const COLUMN_STRIDE = GRAPH_NODE_WIDTH + GRAPH_HORIZONTAL_GAP
const ROW_STRIDE = GRAPH_NODE_HEIGHT + GRAPH_VERTICAL_GAP

export const runtime = 'edge'

const PLANNER_SYSTEM_PROMPT = `
You are a research planner. Given one research question, decompose it into a FEW sharp sub-questions that together answer it from different angles (facts, comparisons, recent developments, counterpoints).

Rules:
- Prefer fewer, sharper branches over broad coverage — later stages will recursively deepen the most promising branch.
- Each sub-question must be independently answerable with a web search.
- Each sub-question gets a short rationale (one sentence).
- Respond with JSON: {"sub_questions":[{"question":"...","rationale":"..."}]}
`.trim()

interface PlannedSubQuestion {
  question: string
  rationale: string
}

function parseSubQuestions(response: Record<string, unknown>, maxBranches: number): PlannedSubQuestion[] {
  if (!Array.isArray(response.sub_questions)) {
    return []
  }

  const parsed: PlannedSubQuestion[] = []
  for (const entry of response.sub_questions) {
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
    if (parsed.length >= maxBranches) {
      break
    }
  }

  return parsed
}

/**
 * Start a research run: plan sub-questions, create the run row, the root chat
 * with the question node, and one empty branch chat per sub-question.
 * The client then streams each branch answer with parentId = root node.
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

  let question = ''
  try {
    const body = (await request.json()) as { question?: unknown }
    question = typeof body.question === 'string' ? body.question.trim() : ''
  } catch {
    // fall through to validation error
  }

  if (!question) {
    return NextResponse.json(
      { success: false, error: 'A research question is required' },
      { status: 400 }
    )
  }

  const maxBranches = resolveMaxBranchesPerRun()

  let subQuestions: PlannedSubQuestion[] = []
  try {
    const response = await createJsonCompletion({
      model: resolveResearchModelId(),
      system: PLANNER_SYSTEM_PROMPT,
      user: `Research question: ${question}\n\nGenerate 2 to ${maxBranches} sub-questions — only as many as truly distinct angles exist.`,
      maxTokens: 1_000,
    })
    subQuestions = parseSubQuestions(response, maxBranches)
  } catch (error) {
    console.error('[research] planner failed:', error instanceof Error ? error.message : error)
  }

  if (subQuestions.length < 2) {
    return NextResponse.json(
      { success: false, error: 'Could not plan sub-questions for this topic. Try rephrasing.' },
      { status: 502 }
    )
  }

  const { data: run, error: runError } = await supabase
    .from('research_runs')
    .insert({ user_id: user.id, question, status: 'running' })
    .select('id')
    .single()

  if (runError || !run) {
    console.error('[research] failed to create run:', runError?.message)
    return NextResponse.json(
      { success: false, error: 'Failed to start the research run' },
      { status: 500 }
    )
  }

  const rootTitle = generateChatTitleFromFirstMessage([{ role: 'user', content: question }])
  const { data: rootChat, error: rootChatError } = await supabase
    .from('chats')
    .insert({ user_id: user.id, title: rootTitle, research_run_id: run.id })
    .select('id')
    .single()

  if (rootChatError || !rootChat) {
    await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
    return NextResponse.json(
      { success: false, error: 'Failed to create the research root chat' },
      { status: 500 }
    )
  }

  const rootNode = await insertUserMessage(supabase, {
    chatId: rootChat.id,
    userId: user.id,
    content: question,
    parentId: null,
  })

  if (!rootNode) {
    await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
    return NextResponse.json(
      { success: false, error: 'Failed to create the research question node' },
      { status: 500 }
    )
  }

  await supabase.from('research_runs').update({ root_chat_id: rootChat.id }).eq('id', run.id)

  const { data: branchChats, error: branchError } = await supabase
    .from('chats')
    .insert(
      subQuestions.map((subQuestion) => ({
        user_id: user.id,
        title: generateChatTitleFromFirstMessage([
          { role: 'user' as const, content: subQuestion.question },
        ]),
        research_run_id: run.id,
      }))
    )
    .select('id')

  if (branchError || !branchChats || branchChats.length !== subQuestions.length) {
    await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
    return NextResponse.json(
      { success: false, error: 'Failed to create research branches' },
      { status: 500 }
    )
  }

  // Lay the run out as a downward tree in a fresh band below existing cards:
  // root centered on top, sub-question branches fanned in the row beneath it.
  const { data: extentRows } = await supabase
    .from('chats')
    .select('position_y')
    .eq('user_id', user.id)
    .not('position_y', 'is', null)
    .order('position_y', { ascending: false })
    .limit(1)

  const maxY = extentRows?.[0]?.position_y
  const treeTopY = typeof maxY === 'number' ? maxY + ROW_STRIDE : GRAPH_ORIGIN_Y
  const rootX = GRAPH_ORIGIN_X + ((subQuestions.length - 1) / 2) * COLUMN_STRIDE

  await supabase
    .from('chats')
    .update({ position_x: rootX, position_y: treeTopY })
    .eq('id', rootChat.id)

  await Promise.all(
    branchChats.map((chat, index) =>
      supabase
        .from('chats')
        .update({
          position_x: GRAPH_ORIGIN_X + index * COLUMN_STRIDE,
          position_y: treeTopY + ROW_STRIDE,
        })
        .eq('id', chat.id)
    )
  )

  return NextResponse.json({
    success: true,
    runId: run.id,
    question,
    rootChatId: rootChat.id,
    rootNodeId: rootNode.id,
    branches: branchChats.map((chat, index) => ({
      chatId: chat.id,
      subQuestion: subQuestions[index].question,
      rationale: subQuestions[index].rationale,
    })),
  })
}
