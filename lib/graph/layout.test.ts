/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { findOpenGridPosition, layoutChats, GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT } from '@/lib/graph/layout'
import type { ChatSummary, GraphEdgeSummary } from '@/lib/api/chat'

function chat(partial: Partial<ChatSummary> & Pick<ChatSummary, 'id'>): ChatSummary {
  return {
    title: partial.title ?? 'Chat',
    created_at: partial.created_at ?? '2026-01-01T00:00:00.000Z',
    updated_at: partial.updated_at ?? '2026-01-01T00:00:00.000Z',
    position_x: partial.position_x ?? null,
    position_y: partial.position_y ?? null,
    ...partial,
    id: partial.id,
  }
}

function overlaps(
  a: { x: number; y: number },
  b: { x: number; y: number }
): boolean {
  const pad = 16
  return !(
    a.x + GRAPH_NODE_WIDTH + pad <= b.x ||
    b.x + GRAPH_NODE_WIDTH + pad <= a.x ||
    a.y + GRAPH_NODE_HEIGHT + pad <= b.y ||
    b.y + GRAPH_NODE_HEIGHT + pad <= a.y
  )
}

describe('graph layout', () => {
  it('places multiple unsaved chats without overlapping', () => {
    const chats = [
      chat({ id: 'a', created_at: '2026-01-01T00:00:00.000Z' }),
      chat({ id: 'b', created_at: '2026-01-01T00:01:00.000Z' }),
      chat({ id: 'c', created_at: '2026-01-01T00:02:00.000Z' }),
    ]

    const positions = layoutChats(chats, [])
    const points = [...positions.values()]

    expect(points).toHaveLength(3)
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        expect(overlaps(points[i], points[j])).toBe(false)
      }
    }
  })

  it('keeps saved positions and places new chats in free space', () => {
    const chats = [
      chat({ id: 'saved', position_x: 48, position_y: 48 }),
      chat({ id: 'new', created_at: '2026-01-02T00:00:00.000Z' }),
    ]

    const positions = layoutChats(chats, [])
    expect(positions.get('saved')).toEqual({ x: 48, y: 48 })
    expect(overlaps(positions.get('saved')!, positions.get('new')!)).toBe(false)
  })

  it('prefers a free slot to the right of a branch parent', () => {
    const chats = [
      chat({ id: 'parent', position_x: 48, position_y: 48 }),
      chat({ id: 'child', created_at: '2026-01-02T00:00:00.000Z' }),
    ]
    const edges: GraphEdgeSummary[] = [
      {
        id: 'e1',
        sourceChatId: 'parent',
        targetChatId: 'child',
        sourceNodeId: 'n1',
        targetNodeId: 'n2',
      },
    ]

    const positions = layoutChats(chats, edges)
    const parent = positions.get('parent')!
    const child = positions.get('child')!
    expect(child.x).toBeGreaterThan(parent.x)
    expect(overlaps(parent, child)).toBe(false)
  })

  it('findOpenGridPosition skips occupied cells', () => {
    const first = findOpenGridPosition([])
    const second = findOpenGridPosition([first])
    expect(overlaps(first, second)).toBe(false)
  })
})
