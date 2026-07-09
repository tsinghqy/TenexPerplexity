import type { ChatSummary, GraphEdgeSummary } from '@/lib/api/chat'

export const GRAPH_NODE_WIDTH = 240
export const GRAPH_NODE_HEIGHT = 160
export const GRAPH_HORIZONTAL_GAP = 80
export const GRAPH_VERTICAL_GAP = 48
export const GRAPH_ORIGIN_X = 48
export const GRAPH_ORIGIN_Y = 48

const COLUMN_STRIDE = GRAPH_NODE_WIDTH + GRAPH_HORIZONTAL_GAP
const ROW_STRIDE = GRAPH_NODE_HEIGHT + GRAPH_VERTICAL_GAP

export interface GraphPoint {
  x: number
  y: number
}

function hasSavedPosition(chat: ChatSummary): chat is ChatSummary & {
  position_x: number
  position_y: number
} {
  return (
    typeof chat.position_x === 'number' &&
    typeof chat.position_y === 'number' &&
    Number.isFinite(chat.position_x) &&
    Number.isFinite(chat.position_y)
  )
}

function rectanglesOverlap(
  a: GraphPoint,
  b: GraphPoint,
  width = GRAPH_NODE_WIDTH,
  height = GRAPH_NODE_HEIGHT,
  padding = 16
): boolean {
  return !(
    a.x + width + padding <= b.x ||
    b.x + width + padding <= a.x ||
    a.y + height + padding <= b.y ||
    b.y + height + padding <= a.y
  )
}

function isFree(candidate: GraphPoint, occupied: GraphPoint[]): boolean {
  return occupied.every((point) => !rectanglesOverlap(candidate, point))
}

/**
 * Find the next open slot on a grid, scanning column-major then row-major.
 */
export function findOpenGridPosition(occupied: GraphPoint[]): GraphPoint {
  for (let row = 0; row < 80; row += 1) {
    for (let col = 0; col < 40; col += 1) {
      const candidate = {
        x: GRAPH_ORIGIN_X + col * COLUMN_STRIDE,
        y: GRAPH_ORIGIN_Y + row * ROW_STRIDE,
      }
      if (isFree(candidate, occupied)) {
        return candidate
      }
    }
  }

  return {
    x: GRAPH_ORIGIN_X + occupied.length * COLUMN_STRIDE,
    y: GRAPH_ORIGIN_Y,
  }
}

function preferredBranchPosition(
  parentPosition: GraphPoint | undefined,
  siblingIndex: number
): GraphPoint {
  if (!parentPosition) {
    return findOpenGridPosition([])
  }

  return {
    x: parentPosition.x + COLUMN_STRIDE,
    y: parentPosition.y + siblingIndex * ROW_STRIDE,
  }
}

/**
 * Place chats without overlapping. Saved DB positions win; new chats get a free slot.
 * Branch chats prefer a slot to the right of their parent when free.
 */
export function layoutChats(
  chats: ChatSummary[],
  edges: GraphEdgeSummary[]
): Map<string, GraphPoint> {
  const positions = new Map<string, GraphPoint>()
  const occupied: GraphPoint[] = []
  const childrenByParent = new Map<string, string[]>()
  const parentByChild = new Map<string, string>()

  for (const edge of edges) {
    parentByChild.set(edge.targetChatId, edge.sourceChatId)
    const list = childrenByParent.get(edge.sourceChatId) || []
    list.push(edge.targetChatId)
    childrenByParent.set(edge.sourceChatId, list)
  }

  // Stable child order so sibling slots don't jump between loads.
  for (const [parentId, childIds] of childrenByParent) {
    childIds.sort((a, b) => a.localeCompare(b))
    childrenByParent.set(parentId, childIds)
  }

  // 1) Lock in persisted positions first.
  for (const chat of chats) {
    if (!hasSavedPosition(chat)) {
      continue
    }
    const point = { x: chat.position_x, y: chat.position_y }
    positions.set(chat.id, point)
    occupied.push(point)
  }

  // 2) Place remaining chats: branches near parent when possible, else open grid.
  const unplaced = chats
    .filter((chat) => !positions.has(chat.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const chat of unplaced) {
    const parentId = parentByChild.get(chat.id)
    let candidate: GraphPoint | null = null

    if (parentId) {
      const siblings = childrenByParent.get(parentId) || []
      const siblingIndex = Math.max(0, siblings.indexOf(chat.id))
      const preferred = preferredBranchPosition(positions.get(parentId), siblingIndex)
      if (isFree(preferred, occupied)) {
        candidate = preferred
      }
    }

    if (!candidate) {
      candidate = findOpenGridPosition(occupied)
    }

    positions.set(chat.id, candidate)
    occupied.push(candidate)
  }

  return positions
}
