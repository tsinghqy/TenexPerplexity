// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  prioritizeCitationsForClaims,
  reconcileUnreadInlineSources,
  type VerifiedClaim,
} from '@/lib/verify/verifier'
import type { FetchedSource } from '@/lib/verify/sources'

const CLAIM_WITH_INLINE_SOURCE =
  'Windows is more susceptible to malware due to its larger user base. ([tomsguide.com](https://www.tomsguide.com/features/windows-vs-macos))'

function claim(overrides: Partial<VerifiedClaim>): VerifiedClaim {
  return {
    text: 'A plain claim without any inline citation link.',
    startOffset: 0,
    endOffset: 10,
    verdict: 'unsupported',
    confidence: 0,
    sourceUrl: null,
    sourceTitle: null,
    sourceQuote: null,
    ...overrides,
  }
}

function source(url: string, fetched: boolean): FetchedSource {
  return { url, title: url, text: fetched ? 'page text' : '', fetched }
}

describe('prioritizeCitationsForClaims', () => {
  it('moves citations that claims inline-cite to the front of the fetch order', () => {
    const citations = [
      { url: 'https://a.com/', title: 'a' },
      { url: 'https://b.com/', title: 'b' },
      { url: 'https://www.tomsguide.com/features/windows-vs-macos', title: 'tomsguide' },
    ]
    const spans = [
      { text: CLAIM_WITH_INLINE_SOURCE, startOffset: 0, endOffset: 10 },
    ]

    const ordered = prioritizeCitationsForClaims(citations, spans)

    expect(ordered[0].url).toBe('https://www.tomsguide.com/features/windows-vs-macos')
    expect(ordered).toHaveLength(3)
  })
})

describe('reconcileUnreadInlineSources', () => {
  it('downgrades unsupported to partial when the claim cites a source we could not read', () => {
    const claims = [claim({ text: CLAIM_WITH_INLINE_SOURCE, verdict: 'unsupported' })]
    const sources = [source('https://www.tomsguide.com/features/windows-vs-macos', false)]

    const [result] = reconcileUnreadInlineSources(claims, sources)

    expect(result.verdict).toBe('partial')
    expect(result.sourceUrl).toBe('https://www.tomsguide.com/features/windows-vs-macos')
    expect(result.sourceQuote).toBeNull()
  })

  it('keeps unsupported when the inline-cited source WAS read and still had no support', () => {
    const claims = [claim({ text: CLAIM_WITH_INLINE_SOURCE, verdict: 'unsupported' })]
    const sources = [source('https://www.tomsguide.com/features/windows-vs-macos', true)]

    const [result] = reconcileUnreadInlineSources(claims, sources)

    expect(result.verdict).toBe('unsupported')
  })

  it('keeps unsupported for claims without any inline citation', () => {
    const claims = [claim({ verdict: 'unsupported' })]
    const sources = [source('https://a.com/', false)]

    const [result] = reconcileUnreadInlineSources(claims, sources)

    expect(result.verdict).toBe('unsupported')
  })

  it('never touches supported or partial claims', () => {
    const claims = [
      claim({ text: CLAIM_WITH_INLINE_SOURCE, verdict: 'supported', confidence: 0.9 }),
    ]
    const sources = [source('https://www.tomsguide.com/features/windows-vs-macos', false)]

    const [result] = reconcileUnreadInlineSources(claims, sources)

    expect(result.verdict).toBe('supported')
    expect(result.confidence).toBe(0.9)
  })
})
