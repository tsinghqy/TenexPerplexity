import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHAT_ERROR_MESSAGE } from '@/lib/chat/constants'
import { extractCitationsFromMarkdown } from '@/lib/llm/citations'
import { verifyAnswer, type VerifiedClaim } from '@/lib/verify/verifier'
import type { Database } from '@/lib/supabase/database.types'

// Node runtime: verification fetches external source pages.
export const runtime = 'nodejs'
export const maxDuration = 60

type NodeClaimRow = Database['public']['Tables']['node_claims']['Row']

const CLAIM_SELECT =
  'id, node_id, user_id, claim_text, start_offset, end_offset, verdict, confidence, source_url, source_title, source_quote, created_at' as const

function toClaimInsert(
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

/** Run claim verification for one assistant message and persist the verdicts. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
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

  const { nodeId } = await params

  const { data: node, error: nodeError } = await supabase
    .from('nodes')
    .select('id, chat_id, user_id, role, content')
    .eq('id', nodeId)
    .eq('user_id', user.id)
    .single()

  if (nodeError || !node) {
    return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 })
  }

  if (node.role !== 'assistant') {
    return NextResponse.json(
      { success: false, error: 'Only assistant messages can be verified' },
      { status: 400 }
    )
  }

  try {
    const citations = extractCitationsFromMarkdown(node.content)
    const result = await verifyAnswer({ content: node.content, citations })

    // Replace any previous verification for this message.
    await supabase.from('node_claims').delete().eq('node_id', node.id).eq('user_id', user.id)

    let claims: NodeClaimRow[] = []
    if (result.claims.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('node_claims')
        .insert(result.claims.map((claim) => toClaimInsert(claim, node.id, user.id)))
        .select(CLAIM_SELECT)

      if (insertError) {
        console.error('[verify] failed to persist claims:', insertError.message)
        return NextResponse.json(
          { success: false, error: 'Failed to save verification results' },
          { status: 500 }
        )
      }
      claims = inserted ?? []
    }

    // Branch confidence reflects the latest verified answer in the chat.
    if (result.confidence !== null) {
      await supabase
        .from('chats')
        .update({ confidence: result.confidence })
        .eq('id', node.chat_id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      success: true,
      claims,
      confidence: result.confidence,
      sourcesChecked: result.sourcesChecked,
      sourcesFetched: result.sourcesFetched,
    })
  } catch (error) {
    console.error('[verify] verification failed:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: 'Verification failed. Please try again.' },
      { status: 500 }
    )
  }
}

/** Load previously persisted claims for one message. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
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

  const { nodeId } = await params

  const { data: claims, error } = await supabase
    .from('node_claims')
    .select(CLAIM_SELECT)
    .eq('node_id', nodeId)
    .eq('user_id', user.id)
    .order('start_offset', { ascending: true })

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to load verification results' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, claims: claims ?? [] })
}
