/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { appendContextToSystemPrompt, buildContextString } from '@/lib/rag/retriever'

describe('buildContextString', () => {
  it('formats messages and respects token budget', () => {
    const context = buildContextString(
      [
        { role: 'user', content: 'My project is Aurora' },
        { role: 'assistant', content: 'Got it.' },
      ],
      4000
    )

    expect(context).toContain('User: My project is Aurora')
    expect(context).toContain('Assistant: Got it.')
  })

  it('returns empty string for no messages', () => {
    expect(buildContextString([])).toBe('')
  })
})

describe('appendContextToSystemPrompt', () => {
  it('leaves prompt unchanged without context', () => {
    expect(appendContextToSystemPrompt('Base', '')).toBe('Base')
  })

  it('appends context block', () => {
    const result = appendContextToSystemPrompt('Base', 'User: hi')
    expect(result).toContain('Base')
    expect(result).toContain('User: hi')
  })
})
