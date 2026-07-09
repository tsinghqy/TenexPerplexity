/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import {
  extractCitationsFromMarkdown,
  extractCitationsFromResponsesOutput,
  mergeCitations,
} from '@/lib/llm/citations'

describe('citations', () => {
  it('extracts markdown links', () => {
    const citations = extractCitationsFromMarkdown(
      'See [OpenAI](https://openai.com/blog) and [OpenAI](https://openai.com/blog) again.'
    )

    expect(citations).toEqual([
      {
        url: 'https://openai.com/blog',
        title: 'OpenAI',
        snippet: undefined,
      },
    ])
  })

  it('extracts Responses API url_citation annotations', () => {
    const citations = extractCitationsFromResponsesOutput([
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: 'Hello',
            annotations: [
              {
                type: 'url_citation',
                url: 'https://example.com/news',
                title: 'Example News',
              },
            ],
          },
        ],
      },
    ])

    expect(citations).toEqual([
      {
        url: 'https://example.com/news',
        title: 'Example News',
        snippet: undefined,
      },
    ])
  })

  it('merges and dedupes citations', () => {
    const merged = mergeCitations(
      [{ url: 'https://example.com/a', title: 'A' }],
      [
        { url: 'https://example.com/a', title: 'A again' },
        { url: 'https://example.com/b', title: 'B' },
      ]
    )

    expect(merged).toEqual([
      { url: 'https://example.com/a', title: 'A', snippet: undefined },
      { url: 'https://example.com/b', title: 'B', snippet: undefined },
    ])
  })
})
