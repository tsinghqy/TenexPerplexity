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

  it('extracts web_search_call action sources', () => {
    const citations = extractCitationsFromResponsesOutput([
      {
        type: 'web_search_call',
        action: {
          sources: [
            { type: 'url', url: 'https://espn.com/fifa' },
            { type: 'url', url: 'https://reuters.com/sports' },
          ],
        },
      },
    ])

    expect(citations).toEqual([
      {
        url: 'https://espn.com/fifa',
        title: 'espn.com',
        snippet: undefined,
      },
      {
        url: 'https://reuters.com/sports',
        title: 'reuters.com',
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
