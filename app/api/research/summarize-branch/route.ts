import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'
import { insertAssistantMessage } from '@/lib/chat/persist'
import { createJsonCompletion } from '@/lib/llm/json-completion'
import { BRANCH_SYNTHESIS_PREFIX, resolveResearchModelId } from '@/lib/research/config'

export const runtime = 'edge'

const SUMMARIZE_SYSTEM_PROMPT = `
You summarize one research branch's findings.

Rules:
- 2-3 sentences, strictly factual, drawn only from the provided answer.
- Lead with the direct finding for the sub-question, then the strongest supporting fact.
- No meta commentary ("this branch found...", "the answer says...").
- Respond with JSON: {"summary":"..."}
`.trim()

/**
 * Append a short synthesis message to a completed research branch chat and
 * store it as the chat's hover summary.
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

  let chatId = ''
  try {
    const body = (await request.json()) as { chatId?: unknown }
    chatId = typeof body.chatId === 'string' ? body.chatId : ''
  } catch {
    // fall through to validation error
  }

  if (!chatId) {
    return NextResponse.json({ success: false, error: 'chatId is required' }, { status: 400 })
  }

  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id, title, confidence, research_run_id')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single()

  if (chatError || !chat) {
    return NextResponse.json({ success: false, error: 'Branch chat not found' }, { status: 404 })
  }

  const { data: answerNodes } = await supabase
    .from('nodes')
    .select('id, content, created_at')
    .eq('chat_id', chat.id)
    .eq('user_id', user.id)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(5)

  const answerNode = (answerNodes ?? []).find(
    (node) => !node.content.startsWith(BRANCH_SYNTHESIS_PREFIX)
  )

  if (!answerNode) {
    return NextResponse.json(
      { success: false, error: 'This branch has no answer to summarize yet' },
      { status: 400 }
    )
  }

  let summary = ''
  try {
    const response = await createJsonCompletion({
      model: resolveResearchModelId(),
      system: SUMMARIZE_SYSTEM_PROMPT,
      user: `Sub-question: ${chat.title || ''}\n\nAnswer:\n${answerNode.content.slice(0, 3_500)}`,
      maxTokens: 300,
    })
    summary = typeof response.summary === 'string' ? response.summary.trim() : ''
  } catch (error) {
    console.error(
      '[research] branch summarize failed:',
      error instanceof Error ? error.message : error
    )
  }

  if (!summary) {
    return NextResponse.json(
      { success: false, error: 'Could not summarize this branch' },
      { status: 502 }
    )
  }

  const confidenceLabel =
    typeof chat.confidence === 'number' ? ` (${Math.round(chat.confidence)}% grounded)` : ''
  const synthesisContent = `${BRANCH_SYNTHESIS_PREFIX}${confidenceLabel}:** ${summary}`

  const synthesisNode = await insertAssistantMessage(supabase, {
    chatId: chat.id,
    userId: user.id,
    content: synthesisContent,
    parentId: answerNode.id,
  })

  if (!synthesisNode) {
    return NextResponse.json(
      { success: false, error: 'Failed to save the branch synthesis' },
      { status: 500 }
    )
  }

  await supabase.from('chats').update({ summary }).eq('id', chat.id).eq('user_id', user.id)

  return NextResponse.json({ success: true, summary, synthesisNodeId: synthesisNode.id })
}
