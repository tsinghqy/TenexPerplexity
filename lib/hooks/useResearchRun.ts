'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deepenResearch,
  listResearchRuns,
  loadResearchRun,
  planResearch,
  summarizeBranch,
  updateResearchRunStatus,
  type PlannedBranch,
  type ResearchRunRecord,
} from '@/lib/api/research'
import { sendMessageStreaming } from '@/lib/api/chat-stream'
import type { NodeClaim } from '@/lib/api/verify'
import { RESEARCH_BRANCH_CONCURRENCY, RESEARCH_MAX_DEPTH } from '@/lib/research/config'

export type ResearchBranchStatus =
  | 'queued'
  | 'answering'
  | 'verifying'
  | 'done'
  | 'failed'
  | 'cancelled'

export interface ResearchBranch {
  chatId: string
  subQuestion: string
  rationale: string
  status: ResearchBranchStatus
  /** 1 = initial fan-out, 2+ = recursive deep dives under the strongest branch. */
  depth: number
  /** Node the branch streams from: root question (depth 1) or parent answer (depth 2+). */
  parentNodeId: string
  /** Streamed answer text (live preview). */
  preview: string
  /** 0–100 grounded score once the branch is verified. */
  confidence: number | null
  /** Short synthesis of the branch's findings, written into the branch chat. */
  summary: string | null
  assistantNodeId: string | null
  error: string | null
}

export type ResearchRunPhase =
  | 'planning'
  | 'running'
  | 'scoring'
  | 'complete'
  | 'failed'
  | 'cancelled'

export interface ResearchRunState {
  runId: string
  question: string
  phase: ResearchRunPhase
  rootChatId: string
  rootNodeId: string
  branches: ResearchBranch[]
  overallConfidence: number | null
  synthesis: string | null
  synthesisClaims: NodeClaim[]
  /** Judge's 1–2 sentence conclusion for hover tooltips. */
  quickSummary: string | null
  error: string | null
}

interface UseResearchRunOptions {
  modelId: string
  /** Called whenever chats/edges changed server-side so Explore can re-render live. */
  onGraphChanged?: () => void
  /** P10 hook-in: verify one finished branch answer, return its grounded score. */
  verifyBranch?: (assistantNodeId: string) => Promise<number | null>
  /** P10 hook-in: synthesize the final answer once all branches finish. */
  synthesizeRun?: (runId: string) => Promise<{
    overallConfidence: number | null
    synthesis: string | null
    synthesisClaims: NodeClaim[]
    quickSummary: string | null
  } | null>
}

function toQueuedBranch(
  planned: PlannedBranch,
  depth: number,
  parentNodeId: string
): ResearchBranch {
  return {
    chatId: planned.chatId,
    subQuestion: planned.subQuestion,
    rationale: planned.rationale,
    status: 'queued',
    depth,
    parentNodeId,
    preview: '',
    confidence: null,
    summary: null,
    assistantNodeId: null,
    error: null,
  }
}

/** Strongest completed branch at a given depth: highest verified confidence wins. */
export function pickStrongestBranch(
  branches: ResearchBranch[],
  depth: number
): ResearchBranch | null {
  const candidates = branches.filter(
    (branch) => branch.depth === depth && branch.status === 'done' && branch.assistantNodeId
  )
  if (candidates.length === 0) {
    return null
  }

  return candidates.reduce((best, candidate) => {
    const bestScore = best.confidence ?? -1
    const candidateScore = candidate.confidence ?? -1
    return candidateScore > bestScore ? candidate : best
  })
}

export function useResearchRun(options: UseResearchRunOptions) {
  const [run, setRun] = useState<ResearchRunState | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [runs, setRuns] = useState<ResearchRunRecord[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(true)
  const [isLoadingRun, setIsLoadingRun] = useState(false)
  const cancelledRef = useRef(false)
  const abortControllersRef = useRef(new Map<string, AbortController>())
  const optionsRef = useRef(options)
  optionsRef.current = options

  const refreshRuns = useCallback(async () => {
    const result = await listResearchRuns()
    if (result.success) {
      setRuns(result.runs ?? [])
    }
    setIsLoadingRuns(false)
  }, [])

  useEffect(() => {
    void refreshRuns()
  }, [refreshRuns])

  /** Hydrate a past run from the database into the panel. */
  const selectRun = useCallback(
    async (runId: string) => {
      if (isRunning || run?.runId === runId) {
        return
      }

      setIsLoadingRun(true)
      const loaded = await loadResearchRun(runId)
      setIsLoadingRun(false)
      if (!loaded.success || !loaded.run) {
        return
      }

      // A non-terminal status on a loaded run means it was abandoned
      // mid-flight (e.g. page refresh); it can't resume, so show it cancelled.
      const phase: ResearchRunPhase =
        loaded.run.status === 'complete' || loaded.run.status === 'failed'
          ? loaded.run.status
          : 'cancelled'

      setRun({
        runId: loaded.run.id,
        question: loaded.run.question,
        phase,
        rootChatId: loaded.run.root_chat_id ?? '',
        rootNodeId: loaded.rootNodeId ?? '',
        branches: (loaded.branches ?? []).map((branch) => ({
          chatId: branch.chatId,
          subQuestion: branch.subQuestion,
          rationale: '',
          status: branch.status === 'done' ? 'done' : 'cancelled',
          depth: branch.depth,
          parentNodeId: branch.parentNodeId,
          preview: branch.preview,
          confidence: branch.confidence,
          summary: branch.summary,
          assistantNodeId: branch.assistantNodeId,
          error: null,
        })),
        overallConfidence: loaded.run.overall_confidence,
        synthesis: loaded.synthesis ?? null,
        synthesisClaims: loaded.synthesisClaims ?? [],
        quickSummary: loaded.quickSummary ?? null,
        error: null,
      })
    },
    [isRunning, run?.runId]
  )

  const updateBranch = useCallback(
    (chatId: string, patch: Partial<ResearchBranch>) => {
      setRun((current) => {
        if (!current) {
          return current
        }
        return {
          ...current,
          branches: current.branches.map((branch) =>
            branch.chatId === chatId ? { ...branch, ...patch } : branch
          ),
        }
      })
    },
    []
  )

  const appendBranchPreview = useCallback((chatId: string, chunk: string) => {
    setRun((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        branches: current.branches.map((branch) =>
          branch.chatId === chatId
            ? { ...branch, preview: branch.preview + chunk }
            : branch
        ),
      }
    })
  }, [])

  const streamBranch = useCallback(
    async (branch: ResearchBranch): Promise<ResearchBranch> => {
      const abortController = new AbortController()
      abortControllersRef.current.set(branch.chatId, abortController)
      updateBranch(branch.chatId, { status: 'answering', preview: '', error: null })

      let notifiedGraph = false
      let assistantNodeId: string | null = null

      try {
        await sendMessageStreaming({
          message: branch.subQuestion,
          history: [],
          modelId: optionsRef.current.modelId,
          useWebSearch: true,
          chatId: branch.chatId,
          parentId: branch.parentNodeId,
          signal: abortController.signal,
          onChunk: (chunk) => {
            appendBranchPreview(branch.chatId, chunk)
            if (!notifiedGraph) {
              // First chunk means the fork edge exists server-side.
              notifiedGraph = true
              optionsRef.current.onGraphChanged?.()
            }
          },
          onComplete: (payload) => {
            assistantNodeId = payload.assistantMessageId ?? null
          },
          onError: () => {
            // handled by the catch below via thrown error
          },
        })
      } catch (error) {
        if (abortController.signal.aborted || cancelledRef.current) {
          updateBranch(branch.chatId, { status: 'cancelled' })
          return { ...branch, status: 'cancelled' }
        }
        const errorMessage = error instanceof Error ? error.message : 'Branch answer failed'
        updateBranch(branch.chatId, { status: 'failed', error: errorMessage })
        return { ...branch, status: 'failed', error: errorMessage }
      } finally {
        abortControllersRef.current.delete(branch.chatId)
      }

      updateBranch(branch.chatId, { assistantNodeId })
      optionsRef.current.onGraphChanged?.()

      let confidence: number | null = null
      if (assistantNodeId && optionsRef.current.verifyBranch && !cancelledRef.current) {
        updateBranch(branch.chatId, { status: 'verifying' })
        try {
          confidence = await optionsRef.current.verifyBranch(assistantNodeId)
        } catch {
          // Verification failure should not fail the branch answer itself.
        }
      }

      // Branch-level synthesis: short findings summary appended to the branch chat.
      let summary: string | null = null
      if (assistantNodeId && !cancelledRef.current) {
        const summarized = await summarizeBranch(branch.chatId)
        summary = summarized.success ? (summarized.summary ?? null) : null
      }

      updateBranch(branch.chatId, { status: 'done', confidence, summary })
      optionsRef.current.onGraphChanged?.()
      return { ...branch, status: 'done', assistantNodeId, confidence, summary }
    },
    [appendBranchPreview, updateBranch]
  )

  /** Bounded-concurrency worker pool over a branch queue. */
  const runBranchPool = useCallback(
    async (branches: ResearchBranch[]): Promise<ResearchBranch[]> => {
      const queue = [...branches]
      const results: ResearchBranch[] = []
      const workers = Array.from(
        { length: Math.min(RESEARCH_BRANCH_CONCURRENCY, queue.length) },
        async () => {
          while (queue.length > 0 && !cancelledRef.current) {
            const nextBranch = queue.shift()
            if (nextBranch) {
              results.push(await streamBranch(nextBranch))
            }
          }
        }
      )
      await Promise.all(workers)
      return results
    },
    [streamBranch]
  )

  const startResearch = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim()
      if (!question || isRunning) {
        return
      }

      cancelledRef.current = false
      setIsRunning(true)
      setRun({
        runId: '',
        question,
        phase: 'planning',
        rootChatId: '',
        rootNodeId: '',
        branches: [],
        overallConfidence: null,
        synthesis: null,
        synthesisClaims: [],
        quickSummary: null,
        error: null,
      })

      const plan = await planResearch(question)
      if (!plan.success || !plan.runId || !plan.rootNodeId || !plan.branches?.length) {
        setRun((current) =>
          current
            ? { ...current, phase: 'failed', error: plan.error || 'Planning failed' }
            : current
        )
        setIsRunning(false)
        return
      }

      void refreshRuns()

      const branches = plan.branches.map((planned) =>
        toQueuedBranch(planned, 1, plan.rootNodeId!)
      )
      setRun({
        runId: plan.runId,
        question,
        phase: 'running',
        rootChatId: plan.rootChatId || '',
        rootNodeId: plan.rootNodeId,
        branches,
        overallConfidence: null,
        synthesis: null,
        synthesisClaims: [],
        quickSummary: null,
        error: null,
      })
      optionsRef.current.onGraphChanged?.()

      let levelResults = await runBranchPool(branches)

      // Recursive deepening: expand the strongest branch of each level with
      // follow-up questions until the depth budget is exhausted.
      for (let depth = 2; depth <= RESEARCH_MAX_DEPTH && !cancelledRef.current; depth += 1) {
        const strongest = pickStrongestBranch(levelResults, depth - 1)
        if (!strongest?.assistantNodeId) {
          break
        }

        const deepened = await deepenResearch(plan.runId, strongest.assistantNodeId)
        if (!deepened.success || !deepened.branches?.length || cancelledRef.current) {
          break
        }

        const deeperBranches = deepened.branches.map((planned) =>
          toQueuedBranch(planned, depth, strongest.assistantNodeId!)
        )
        setRun((current) =>
          current
            ? { ...current, branches: [...current.branches, ...deeperBranches] }
            : current
        )
        optionsRef.current.onGraphChanged?.()

        levelResults = await runBranchPool(deeperBranches)
      }

      if (cancelledRef.current) {
        setIsRunning(false)
        return
      }

      const synthesize = optionsRef.current.synthesizeRun
      if (synthesize) {
        setRun((current) => (current ? { ...current, phase: 'scoring' } : current))
        try {
          const result = await synthesize(plan.runId)
          if (result) {
            setRun((current) =>
              current
                ? {
                    ...current,
                    phase: 'complete',
                    overallConfidence: result.overallConfidence,
                    synthesis: result.synthesis,
                    synthesisClaims: result.synthesisClaims,
                    quickSummary: result.quickSummary,
                  }
                : current
            )
            optionsRef.current.onGraphChanged?.()
            setIsRunning(false)
            void refreshRuns()
            return
          }
        } catch {
          // fall through to completing without synthesis
        }
        setRun((current) =>
          current
            ? {
                ...current,
                phase: 'complete',
                error: 'Branches finished, but the final synthesis failed.',
              }
            : current
        )
        setIsRunning(false)
        void refreshRuns()
        return
      }

      setRun((current) => (current ? { ...current, phase: 'complete' } : current))
      setIsRunning(false)
      void refreshRuns()
    },
    [isRunning, refreshRuns, runBranchPool]
  )

  const cancelResearch = useCallback(async () => {
    if (!run || cancelledRef.current) {
      return
    }

    cancelledRef.current = true
    for (const controller of abortControllersRef.current.values()) {
      controller.abort()
    }
    abortControllersRef.current.clear()

    setRun((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        phase: 'cancelled',
        branches: current.branches.map((branch) =>
          branch.status === 'queued' || branch.status === 'answering'
            ? { ...branch, status: 'cancelled' }
            : branch
        ),
      }
    })
    setIsRunning(false)

    if (run.runId) {
      await updateResearchRunStatus(run.runId, 'cancelled')
      void refreshRuns()
    }
  }, [refreshRuns, run])

  const retryBranch = useCallback(
    async (chatId: string) => {
      if (!run || isRunning) {
        return
      }
      const branch = run.branches.find((candidate) => candidate.chatId === chatId)
      if (!branch || (branch.status !== 'failed' && branch.status !== 'cancelled')) {
        return
      }

      cancelledRef.current = false
      setIsRunning(true)
      await streamBranch(branch)
      setIsRunning(false)
    },
    [isRunning, run, streamBranch]
  )

  const resetResearch = useCallback(() => {
    if (isRunning) {
      return
    }
    setRun(null)
  }, [isRunning])

  return {
    run,
    isRunning,
    runs,
    isLoadingRuns,
    isLoadingRun,
    selectRun,
    startResearch,
    cancelResearch,
    retryBranch,
    resetResearch,
  }
}
