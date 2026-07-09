import type { ResearchRunStatus } from '@/lib/supabase/database.types'

export interface PlannedBranch {
  chatId: string
  subQuestion: string
  rationale: string
}

export interface PlanResearchResponse {
  success: boolean
  runId?: string
  question?: string
  rootChatId?: string
  rootNodeId?: string
  branches?: PlannedBranch[]
  error?: string
}

export interface ResearchRunRecord {
  id: string
  question: string
  status: ResearchRunStatus
  root_chat_id: string | null
  winning_chat_id: string | null
  overall_confidence: number | null
  created_at: string
}

/** Plan a research run: sub-questions + root chat + empty branch chats. */
export async function planResearch(question: string): Promise<PlanResearchResponse> {
  try {
    const response = await fetch('/api/research/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    const payload = (await response.json()) as PlanResearchResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to plan research',
    }
  }
}

export interface DeepenResearchResponse {
  success: boolean
  parentNodeId?: string
  branches?: PlannedBranch[]
  error?: string
}

/** Plan follow-up branches under the strongest branch's answer node. */
export async function deepenResearch(
  runId: string,
  parentNodeId: string
): Promise<DeepenResearchResponse> {
  try {
    const response = await fetch('/api/research/deepen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, parentNodeId }),
    })
    const payload = (await response.json()) as DeepenResearchResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deepen research',
    }
  }
}

/** Update a run's status (e.g. cancel). */
export async function updateResearchRunStatus(
  runId: string,
  status: 'cancelled' | 'failed' | 'scoring'
): Promise<{ success: boolean; run?: ResearchRunRecord; error?: string }> {
  try {
    const response = await fetch(`/api/research/${encodeURIComponent(runId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const payload = (await response.json()) as {
      success: boolean
      run?: ResearchRunRecord
      error?: string
    }
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update research run',
    }
  }
}
