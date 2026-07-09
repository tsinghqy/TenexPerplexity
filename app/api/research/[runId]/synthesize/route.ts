import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'
import { insertAssistantMessage } from '@/lib/chat/persist'
import { extractCitationsFromMarkdown } from '@/lib/llm/citations'
import { createJsonCompletion } from '@/lib/llm/json-completion'
import { BRANCH_SYNTHESIS_PREFIX, resolveResearchModelId } from '@/lib/research/config'
import { verifyAnswer, type VerifiedClaim } from '@/lib/verify/verifier'
import type { Database } from '@/lib/supabase/database.types'

// Node runtime: the synthesis is immediately verified, which fetches sources.
export const runtime = 'nodejs'
export const maxDuration = 90

const CLAIM_SELECT =
  'id, node_id, user_id, claim_text, start_offset, end_offset, verdict, confidence, source_url, source_title, source_quote, created_at' as const

const SYNTHESIS_SYSTEM_PROMPT = `
You write the final answer at the end of an automatic research run. You receive the original question and several researched BRANCHES, each with a sub-question, a web-sourced answer, and a grounded score (0-100, share of claims its sources actually support).

Tasks:
1. Write the FINAL SYNTHESIS: a direct answer to the original question that combines the branches, favoring the best-grounded ones. Reuse inline markdown links from the branch answers for every factual statement you keep, e.g. [source.com](https://...). Be specific; no meta commentary.
2. Write a QUICK SUMMARY: the conclusion in 1-2 plain sentences (no links), suitable for a hover tooltip.

Respond with JSON: {"quick_summary": "...", "synthesis": "..."}
`.trim()

interface BranchForSynthesis {
  chatId: string
  title: string
  answer: string
  confidence: number | null
}

function claimInsert(
  claim: VerifiedClaim,
  nodeId: string,
  userId: string
): Database['public']['Tables']['node_claims']['Insert'] {
  return {
    node_id: nodeId,
    user_id: userId,
    claim_text: claim.text,
    start_offset: claim.startOffset,
    end_offset: claim.endOffset,
    verdict: claim.verdict,
    confidence: claim.confidence,
    source_url: claim.sourceUrl,
    source_title: claim.sourceTitle,
    source_quote: claim.sourceQuote,
  }
}

/**
 * Combine the run's branches and append a verified synthesis answer to the
 * root chat.
 */
export async function POST(
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

  const { data: run, error: runError } = await supabase
    .from('research_runs')
    .select('id, question, root_chat_id')
    .eq('id', runId)
    .eq('user_id', user.id)
    .single()

  if (runError || !run || !run.root_chat_id) {
    return NextResponse.json({ success: false, error: 'Research run not found' }, { status: 404 })
  }

  await supabase.from('research_runs').update({ status: 'scoring' }).eq('id', run.id)

  try {
    const { data: runChats } = await supabase
      .from('chats')
      .select('id, title, confidence')
      .eq('research_run_id', run.id)
      .eq('user_id', user.id)

    const branchChats = (runChats ?? []).filter((chat) => chat.id !== run.root_chat_id)
    if (branchChats.length === 0) {
      await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
      return NextResponse.json(
        { success: false, error: 'This run has no researched branches to synthesize' },
        { status: 400 }
      )
    }

    const { data: answerNodes } = await supabase
      .from('nodes')
      .select('chat_id, content, created_at')
      .in('chat_id', branchChats.map((chat) => chat.id))
      .eq('user_id', user.id)
      .eq('role', 'assistant')
      .order('created_at', { ascending: true })

    // Latest real assistant answer per branch chat (branch syntheses excluded).
    const answerByChat = new Map<string, string>()
    for (const node of answerNodes ?? []) {
      if (!node.content.startsWith(BRANCH_SYNTHESIS_PREFIX)) {
        answerByChat.set(node.chat_id, node.content)
      }
    }

    const branches: BranchForSynthesis[] = branchChats
      .filter((chat) => answerByChat.has(chat.id))
      .map((chat) => ({
        chatId: chat.id,
        title: chat.title || 'Sub-question',
        answer: answerByChat.get(chat.id)!,
        confidence: typeof chat.confidence === 'number' ? chat.confidence : null,
      }))

    if (branches.length === 0) {
      await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
      return NextResponse.json(
        { success: false, error: 'No branch answers found to synthesize' },
        { status: 400 }
      )
    }

    const branchesBlock = branches
      .map(
        (branch, index) =>
          `BRANCH ${index} (grounded score: ${branch.confidence ?? 'unverified'})\nSub-question: ${branch.title}\nAnswer:\n${branch.answer.slice(0, 3_000)}`
      )
      .join('\n\n---\n\n')

    const synthesized = await createJsonCompletion({
      model: resolveResearchModelId(),
      system: SYNTHESIS_SYSTEM_PROMPT,
      user: `Original question: ${run.question}\n\n${branchesBlock}`,
      maxTokens: 1_800,
    })

    const synthesis =
      typeof synthesized.synthesis === 'string' ? synthesized.synthesis.trim() : ''
    const quickSummary =
      typeof synthesized.quick_summary === 'string' ? synthesized.quick_summary.trim() : ''

    if (!synthesis) {
      await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
      return NextResponse.json(
        { success: false, error: 'The model did not produce a synthesis' },
        { status: 502 }
      )
    }

    // Append the synthesis to the root chat, under the original question node.
    const { data: rootChat } = await supabase
      .from('chats')
      .select('root_node_id')
      .eq('id', run.root_chat_id)
      .eq('user_id', user.id)
      .single()

    if (!rootChat?.root_node_id) {
      await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
      return NextResponse.json(
        { success: false, error: 'Root question node is missing' },
        { status: 500 }
      )
    }

    const synthesisNode = await insertAssistantMessage(supabase, {
      chatId: run.root_chat_id,
      userId: user.id,
      content: synthesis,
      parentId: rootChat.root_node_id,
    })

    if (!synthesisNode) {
      await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
      return NextResponse.json(
        { success: false, error: 'Failed to save the synthesis answer' },
        { status: 500 }
      )
    }

    // The final answer gets the same lie-detector treatment as every branch.
    const verification = await verifyAnswer({
      content: synthesis,
      citations: extractCitationsFromMarkdown(synthesis),
    })

    let synthesisClaims: unknown[] = []
    if (verification.claims.length > 0) {
      const { data: insertedClaims } = await supabase
        .from('node_claims')
        .insert(verification.claims.map((claim) => claimInsert(claim, synthesisNode.id, user.id)))
        .select(CLAIM_SELECT)
      synthesisClaims = insertedClaims ?? []
    }

    // Root chat carries the conclusion: overall confidence + hover summary.
    // Separate updates so a missing summary column (p10 migration not applied
    // yet) can't take the confidence update down with it.
    if (verification.confidence !== null) {
      await supabase
        .from('chats')
        .update({ confidence: verification.confidence })
        .eq('id', run.root_chat_id)
        .eq('user_id', user.id)
    }
    if (quickSummary) {
      await supabase
        .from('chats')
        .update({ summary: quickSummary })
        .eq('id', run.root_chat_id)
        .eq('user_id', user.id)
    }

    await supabase
      .from('research_runs')
      .update({
        status: 'complete',
        overall_confidence: verification.confidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    return NextResponse.json({
      success: true,
      overallConfidence: verification.confidence,
      synthesis,
      quickSummary,
      synthesisNodeId: synthesisNode.id,
      synthesisClaims,
    })
  } catch (error) {
    console.error('[research] synthesize failed:', error instanceof Error ? error.message : error)
    await supabase.from('research_runs').update({ status: 'failed' }).eq('id', run.id)
    return NextResponse.json(
      { success: false, error: 'Failed to synthesize this run' },
      { status: 500 }
    )
  }
}
