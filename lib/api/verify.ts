import type { ClaimVerdict } from '@/lib/supabase/database.types'

/** Persisted claim verdict row as returned by the verify endpoints. */
export interface NodeClaim {
  id: string
  node_id: string
  claim_text: string
  start_offset: number
  end_offset: number
  verdict: ClaimVerdict
  confidence: number
  source_url: string | null
  source_title: string | null
  source_quote: string | null
  created_at: string
}

export interface VerifyNodeResponse {
  success: boolean
  claims?: NodeClaim[]
  confidence?: number | null
  sourcesChecked?: number
  sourcesFetched?: number
  error?: string
}

/** Run claim verification for one assistant message. */
export async function verifyNode(nodeId: string): Promise<VerifyNodeResponse> {
  try {
    const response = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/verify`, {
      method: 'POST',
    })
    const payload = (await response.json()) as VerifyNodeResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }
  }
}
