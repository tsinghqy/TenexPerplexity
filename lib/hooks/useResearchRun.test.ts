// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { pickStrongestBranch, type ResearchBranch } from '@/lib/hooks/useResearchRun'

function branch(overrides: Partial<ResearchBranch>): ResearchBranch {
  return {
    chatId: 'chat',
    subQuestion: 'q',
    rationale: '',
    status: 'done',
    depth: 1,
    parentNodeId: 'root',
    preview: '',
    confidence: null,
    summary: null,
    assistantNodeId: 'node',
    error: null,
    ...overrides,
  }
}

describe('pickStrongestBranch', () => {
  it('picks the highest-confidence completed branch at the given depth', () => {
    const branches = [
      branch({ chatId: 'a', confidence: 55 }),
      branch({ chatId: 'b', confidence: 91 }),
      branch({ chatId: 'c', confidence: 70 }),
    ]

    expect(pickStrongestBranch(branches, 1)?.chatId).toBe('b')
  })

  it('ignores failed branches and other depths', () => {
    const branches = [
      branch({ chatId: 'failed', confidence: 99, status: 'failed' }),
      branch({ chatId: 'deep', confidence: 95, depth: 2 }),
      branch({ chatId: 'ok', confidence: 40 }),
    ]

    expect(pickStrongestBranch(branches, 1)?.chatId).toBe('ok')
  })

  it('falls back to an unverified done branch when no confidence exists', () => {
    const branches = [branch({ chatId: 'unverified', confidence: null })]
    expect(pickStrongestBranch(branches, 1)?.chatId).toBe('unverified')
  })

  it('returns null when nothing completed at that depth', () => {
    expect(pickStrongestBranch([branch({ status: 'answering' })], 1)).toBeNull()
  })
})
