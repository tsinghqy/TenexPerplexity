/** Budgets and model knobs for automatic research runs. */

/** Parallel branch streams on the client orchestrator. */
export const RESEARCH_BRANCH_CONCURRENCY = 2

export const RESEARCH_MIN_BRANCHES = 2
export const RESEARCH_MAX_BRANCHES_HARD_CAP = 6

/**
 * Server-side: max sub-question branches per run (env-tunable, hard-capped).
 * Default favors a narrow first layer — depth adds more value than breadth.
 */
export function resolveMaxBranchesPerRun(): number {
  const parsed = Number.parseInt(process.env.RESEARCH_MAX_BRANCHES || '', 10)
  if (!Number.isFinite(parsed)) {
    return 4
  }
  return Math.min(Math.max(parsed, RESEARCH_MIN_BRANCHES), RESEARCH_MAX_BRANCHES_HARD_CAP)
}

/** Server-side: model used for planning sub-questions and judging branches. */
export function resolveResearchModelId(): string {
  return process.env.RESEARCH_MODEL || 'gpt-4o-mini'
}

/**
 * Recursive deepening: after each level of branches is answered and verified,
 * the strongest branch is expanded with follow-up questions, down to this depth.
 * Depth 1 = the initial sub-question fan-out; 2 and 3 drill into the best path.
 */
export const RESEARCH_MAX_DEPTH = 3

export const RESEARCH_FOLLOWUPS_HARD_CAP = 3

/** Marker prefix for branch synthesis messages (excluded from judging). */
export const BRANCH_SYNTHESIS_PREFIX = '**Branch synthesis'

/** Server-side: follow-up branches when deepening the strongest path. */
export function resolveFollowUpsPerDeepen(): number {
  const parsed = Number.parseInt(process.env.RESEARCH_FOLLOWUPS || '', 10)
  if (!Number.isFinite(parsed)) {
    return 2
  }
  return Math.min(Math.max(parsed, 1), RESEARCH_FOLLOWUPS_HARD_CAP)
}
