import type { NodeClaim } from '@/lib/api/verify'
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
  overall_confidence: number | null
  created_at: string
}

export interface ResearchRunListResponse {
  success: boolean
  runs?: ResearchRunRecord[]
  error?: string
}

/** List the user's past research runs, newest first. */
export async function listResearchRuns(): Promise<ResearchRunListResponse> {
  try {
    const response = await fetch('/api/research', { method: 'GET' })
    const payload = (await response.json()) as ResearchRunListResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load research history',
    }
  }
}

export interface LoadedResearchBranch {
  chatId: string
  subQuestion: string
  status: 'queued' | 'done' | 'cancelled'
  depth: number
  parentNodeId: string
  preview: string
  confidence: number | null
  summary: string | null
  assistantNodeId: string | null
}

export interface LoadResearchRunResponse {
  success: boolean
  run?: ResearchRunRecord
  rootNodeId?: string | null
  branches?: LoadedResearchBranch[]
  synthesis?: string | null
  synthesisClaims?: NodeClaim[]
  quickSummary?: string | null
  error?: string
}

/** Load one past research run with its branches and final synthesis. */
export async function loadResearchRun(runId: string): Promise<LoadResearchRunResponse> {
  try {
    const response = await fetch(`/api/research/${encodeURIComponent(runId)}`, {
      method: 'GET',
    })
    const payload = (await response.json()) as LoadResearchRunResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load research run',
    }
  }
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

export interface SynthesizeResearchResponse {
  success: boolean
  overallConfidence?: number | null
  synthesis?: string
  quickSummary?: string
  synthesisNodeId?: string
  synthesisClaims?: NodeClaim[]
  error?: string
}

/** Append a short synthesis message + hover summary to a completed branch. */
export async function summarizeBranch(
  chatId: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const response = await fetch('/api/research/summarize-branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId }),
    })
    const payload = (await response.json()) as {
      success: boolean
      summary?: string
      error?: string
    }
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to summarize branch',
    }
  }
}

/** Combine the run's branches into the verified final synthesis. */
export async function synthesizeResearch(runId: string): Promise<SynthesizeResearchResponse> {
  try {
    const response = await fetch(`/api/research/${encodeURIComponent(runId)}/synthesize`, {
      method: 'POST',
    })
    const payload = (await response.json()) as SynthesizeResearchResponse
    if (!response.ok) {
      return { success: false, error: payload.error || `Request failed (${response.status})` }
    }
    return payload
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to synthesize research',
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
