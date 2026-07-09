// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeGroundedScore, hallucinationRate } from '@/lib/verify/score'

describe('computeGroundedScore', () => {
  it('returns null with no claims', () => {
    expect(computeGroundedScore([])).toBeNull()
  })

  it('returns 100 when everything is supported and 0 when nothing is', () => {
    const supported = [{ text: 'A supported claim about facts.', verdict: 'supported' as const }]
    const unsupported = [{ text: 'A fabricated claim.', verdict: 'unsupported' as const }]

    expect(computeGroundedScore(supported)).toBe(100)
    expect(computeGroundedScore(unsupported)).toBe(0)
  })

  it('weights verdicts by claim length', () => {
    const claims = [
      { text: 'x'.repeat(90), verdict: 'supported' as const },
      { text: 'x'.repeat(10), verdict: 'unsupported' as const },
    ]

    expect(computeGroundedScore(claims)).toBe(90)
  })

  it('scores partial verdicts at half weight', () => {
    const claims = [{ text: 'A partially supported claim.', verdict: 'partial' as const }]
    expect(computeGroundedScore(claims)).toBe(50)
  })
})

describe('hallucinationRate', () => {
  it('is the inverse of the grounded score, clamped to 0-100', () => {
    expect(hallucinationRate(82)).toBe(18)
    expect(hallucinationRate(0)).toBe(100)
    expect(hallucinationRate(120)).toBe(0)
  })
})
