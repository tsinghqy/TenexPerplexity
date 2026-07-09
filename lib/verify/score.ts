import type { ClaimVerdict } from '@/lib/supabase/database.types'

/**
 * Pure scoring helpers shared by the server verifier and client UI.
 * Kept free of server-only imports so the browser bundle stays clean.
 */

export const VERDICT_WEIGHT: Record<ClaimVerdict, number> = {
  supported: 1,
  partial: 0.5,
  unsupported: 0,
}

/**
 * Grounded score (0–100): verdict values weighted by claim length,
 * so long substantive claims count more than short asides.
 * Returns null when there are no claims to score.
 */
export function computeGroundedScore(
  claims: Array<{ text: string; verdict: ClaimVerdict }>
): number | null {
  if (claims.length === 0) {
    return null
  }

  let weightedSum = 0
  let totalWeight = 0
  for (const claim of claims) {
    const weight = Math.max(claim.text.length, 1)
    weightedSum += weight * VERDICT_WEIGHT[claim.verdict]
    totalWeight += weight
  }

  return Math.round((weightedSum / totalWeight) * 100)
}

/** Hallucination risk is the inverse of the grounded score. */
export function hallucinationRate(groundedScore: number): number {
  return Math.min(Math.max(100 - groundedScore, 0), 100)
}
