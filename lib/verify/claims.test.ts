// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findSourcesFooterStart, segmentClaims } from '@/lib/verify/claims'

describe('segmentClaims', () => {
  it('returns spans whose offsets map back to the exact content slice', () => {
    const content =
      'France won the 2018 World Cup in Russia. Argentina won the 2022 edition in Qatar.'

    const claims = segmentClaims(content)

    expect(claims).toHaveLength(2)
    for (const claim of claims) {
      expect(content.slice(claim.startOffset, claim.endOffset)).toBe(claim.text)
    }
    expect(claims[0].text).toBe('France won the 2018 World Cup in Russia.')
    expect(claims[1].text).toBe('Argentina won the 2022 edition in Qatar.')
  })

  it('excludes the appended Sources footer from claims', () => {
    const content =
      'Brazil has won five World Cup titles overall.\n\nSources:\n1. [FIFA](https://fifa.com/history)'

    const claims = segmentClaims(content)

    expect(claims).toHaveLength(1)
    expect(claims[0].text).toBe('Brazil has won five World Cup titles overall.')
  })

  it('skips headers, link-only lines, and code fences', () => {
    const content = [
      '## Findings',
      'The Eiffel Tower is 330 metres tall as of 2022.',
      '- [Wikipedia](https://en.wikipedia.org/wiki/Eiffel_Tower)',
      '```',
      'const height = 330 // metres of factual-looking code',
      '```',
    ].join('\n')

    const claims = segmentClaims(content)

    expect(claims).toHaveLength(1)
    expect(claims[0].text).toBe('The Eiffel Tower is 330 metres tall as of 2022.')
  })

  it('keeps offsets correct for list items with markers', () => {
    const content = '1. The Amazon river is the largest river by discharge volume.'

    const claims = segmentClaims(content)

    expect(claims).toHaveLength(1)
    expect(content.slice(claims[0].startOffset, claims[0].endOffset)).toBe(claims[0].text)
    expect(claims[0].text.startsWith('The Amazon')).toBe(true)
  })

  it('ignores fragments shorter than the minimum claim length', () => {
    const claims = segmentClaims('Yes. Short one. This sentence is long enough to be a verifiable claim.')

    expect(claims).toHaveLength(1)
    expect(claims[0].text).toBe('This sentence is long enough to be a verifiable claim.')
  })
})

describe('findSourcesFooterStart', () => {
  it('finds the footer when present', () => {
    const content = 'Answer body.\n\nSources:\n1. [A](https://a.com)'
    const footerStart = findSourcesFooterStart(content)
    expect(content.slice(0, footerStart)).toContain('Answer body.')
    expect(content.slice(footerStart)).toContain('Sources:')
  })

  it('returns content length when there is no footer', () => {
    expect(findSourcesFooterStart('No footer here.')).toBe('No footer here.'.length)
  })
})
