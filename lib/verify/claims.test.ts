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

  it('skips bold section titles and colon-ended list intros', () => {
    const content = [
      '**Software Compatibility:**',
      'The main differences come down to the following factors:',
      'Windows supports a wider range of third-party software than macOS.',
    ].join('\n')

    const claims = segmentClaims(content)

    expect(claims).toHaveLength(1)
    expect(claims[0].text).toBe(
      'Windows supports a wider range of third-party software than macOS.'
    )
  })

  it('does not turn trailing citation parentheticals into claims', () => {
    const content =
      '- **Windows:** More susceptible to malware due to its larger user base. ([tomsguide.com](https://www.tomsguide.com/features/windows-vs-macos-which-is-better-for-you?utm_source=openai))'

    const claims = segmentClaims(content)

    expect(claims).toHaveLength(1)
    expect(claims[0].text).toBe(
      '**Windows:** More susceptible to malware due to its larger user base.'
    )
    expect(content.slice(claims[0].startOffset, claims[0].endOffset)).toBe(claims[0].text)
  })

  it('skips meta/discourse sentences that assert nothing checkable', () => {
    const content = [
      "Here's a concise comparison of Windows and macOS for everyday users.",
      'Let me know if you want a deeper dive into gaming performance.',
      'Apple released macOS Sequoia in September 2024.',
    ].join(' ')

    const claims = segmentClaims(content)

    expect(claims).toHaveLength(1)
    expect(claims[0].text).toBe('Apple released macOS Sequoia in September 2024.')
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
