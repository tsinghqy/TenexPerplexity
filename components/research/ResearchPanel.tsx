'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfidenceChip, VerifiedContent } from '@/components/chat/ChatPanel'
import { cn } from '@/lib/utils'
import { hallucinationRate } from '@/lib/verify/score'
import type {
  ResearchBranch,
  ResearchRunPhase,
  ResearchRunState,
} from '@/lib/hooks/useResearchRun'

const PHASE_LABEL: Record<ResearchRunPhase, string> = {
  planning: 'Planning sub-questions…',
  running: 'Researching branches…',
  scoring: 'Scoring branches & synthesizing…',
  complete: 'Research complete',
  failed: 'Research failed',
  cancelled: 'Research cancelled',
}

const BRANCH_STATUS_LABEL: Record<ResearchBranch['status'], string> = {
  queued: 'Queued',
  answering: 'Searching & answering…',
  verifying: 'Verifying claims…',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

function BranchStatusBadge({ status }: { status: ResearchBranch['status'] }) {
  const tone =
    status === 'done'
      ? 'border-success/40 bg-success/15 text-success'
      : status === 'failed'
        ? 'border-error/40 bg-error/15 text-error'
        : status === 'cancelled'
          ? 'border-white/15 bg-white/5 text-muted-foreground'
          : 'border-primary/40 bg-primary/10 text-primary'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        tone
      )}
    >
      {(status === 'answering' || status === 'verifying') && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {BRANCH_STATUS_LABEL[status]}
    </span>
  )
}

function BranchConfidenceBar({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 70 ? 'bg-success' : confidence >= 40 ? 'bg-warning' : 'bg-error'

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${Math.min(Math.max(confidence, 2), 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {confidence}% grounded · {hallucinationRate(confidence)}% hallucination risk
      </p>
    </div>
  )
}

function BranchCard({
  branch,
  isWinner,
  onOpen,
  onRetry,
}: {
  branch: ResearchBranch
  isWinner: boolean
  onOpen: () => void
  onRetry: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-2xl border bg-base-200 p-4 shadow-sm transition',
        isWinner
          ? 'border-warning/60 shadow-warning/10 ring-1 ring-warning/40'
          : 'border-white/10'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-base-content">
          {isWinner ? '👑 ' : ''}
          {branch.depth > 1 ? '↳ ' : ''}
          {branch.subQuestion}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <BranchStatusBadge status={branch.status} />
          {branch.depth > 1 ? (
            <span className="inline-flex rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Deep dive · L{branch.depth}
            </span>
          ) : null}
        </div>
      </div>

      {branch.rationale ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{branch.rationale}</p>
      ) : null}

      {branch.preview ? (
        <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-base-content/80">
          {branch.preview}
        </p>
      ) : null}

      {typeof branch.confidence === 'number' ? (
        <BranchConfidenceBar confidence={branch.confidence} />
      ) : null}

      {branch.error ? <p className="text-xs text-error">{branch.error}</p> : null}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-white/15"
          onClick={onOpen}
        >
          Open branch
        </Button>
        {branch.status === 'failed' || branch.status === 'cancelled' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-white/15 text-warning hover:bg-warning/10"
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}

interface ResearchPanelProps {
  run: ResearchRunState | null
  isRunning: boolean
  onStart: (question: string) => void
  onCancel: () => void
  onRetryBranch: (chatId: string) => void
  onReset: () => void
  onOpenChat: (chatId: string) => void
}

export function ResearchPanel({
  run,
  isRunning,
  onStart,
  onCancel,
  onRetryBranch,
  onReset,
  onOpenChat,
}: ResearchPanelProps) {
  const [question, setQuestion] = useState('')

  if (!run) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
        <div className="w-full max-w-xl space-y-5 text-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-base-content">
              Research mode
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ask one question. Tenexity plans sub-questions, researches each as a live branch
              with web sources, fact-checks every claim, and crowns the strongest path.
            </p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              onStart(question)
            }}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. Is nuclear power the best path to net-zero by 2050?"
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-base-200 px-4 py-3 text-[15px] text-base-content outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:bg-base-300/60"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  onStart(question)
                }
              }}
            />
            <Button
              type="submit"
              className="rounded-full bg-primary px-6 text-primary-content hover:brightness-110"
              disabled={question.trim().length === 0}
            >
              Start research
            </Button>
          </form>
        </div>
      </div>
    )
  }

  const doneCount = run.branches.filter((branch) => branch.status === 'done').length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Research question
            </p>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-base-content">
              {run.question}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isRunning ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-white/15 text-error hover:bg-error/10"
                onClick={onCancel}
              >
                Cancel run
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-white/15"
                onClick={onReset}
              >
                New research
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-base-200/70 px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center gap-2 text-sm font-medium',
              run.phase === 'failed'
                ? 'text-error'
                : run.phase === 'complete'
                  ? 'text-success'
                  : 'text-base-content'
            )}
          >
            {(run.phase === 'planning' || run.phase === 'running' || run.phase === 'scoring') && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            )}
            {PHASE_LABEL[run.phase]}
          </span>
          {run.branches.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {doneCount}/{run.branches.length} branches done
            </span>
          ) : null}
          {typeof run.overallConfidence === 'number' ? (
            <ConfidenceChip confidence={Math.round(run.overallConfidence)} />
          ) : null}
          {run.rootChatId ? (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onOpenChat(run.rootChatId)}
            >
              View tree in Explore
            </button>
          ) : null}
        </div>

        {run.error ? (
          <p className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {run.error}
          </p>
        ) : null}

        {run.branches.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {run.branches.map((branch) => (
              <BranchCard
                key={branch.chatId}
                branch={branch}
                isWinner={run.winningChatId === branch.chatId}
                onOpen={() => onOpenChat(branch.chatId)}
                onRetry={() => onRetryBranch(branch.chatId)}
              />
            ))}
          </div>
        ) : null}

        {run.synthesis ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-base-200 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Final synthesis
              </h3>
              {typeof run.overallConfidence === 'number' ? (
                <ConfidenceChip confidence={Math.round(run.overallConfidence)} />
              ) : null}
            </div>
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-base-content">
              {run.synthesisClaims.length > 0 ? (
                <VerifiedContent content={run.synthesis} claims={run.synthesisClaims} />
              ) : (
                run.synthesis
              )}
            </div>
            {run.rootChatId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-white/15"
                onClick={() => onOpenChat(run.rootChatId)}
              >
                Open full answer
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
