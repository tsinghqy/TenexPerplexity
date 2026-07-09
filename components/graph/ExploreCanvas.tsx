'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { updateChatPosition, type ChatSummary, type GraphEdgeSummary } from '@/lib/api/chat'
import { cn } from '@/lib/utils'

interface ExploreCanvasProps {
  chats: ChatSummary[]
  edges: GraphEdgeSummary[]
  activeChatId: string | null
  onOpenChat: (chatId: string) => void
}

function ChatGraphNode({ data, selected }: NodeProps) {
  const label = String(data.label || 'Untitled chat')
  const isBranch = Boolean(data.isBranch)
  const preview = typeof data.preview === 'string' ? data.preview : ''

  return (
    <div
      className={cn(
        'w-[240px] rounded-2xl border bg-[var(--surface-elevated)] px-3.5 py-3 text-left shadow-md transition',
        'hover:shadow-lg',
        selected ? 'border-primary ring-4 ring-primary/20' : 'border-white/10'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-base-100 !bg-primary"
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            isBranch
              ? 'bg-primary/20 text-primary'
              : 'bg-base-300/80 text-muted-foreground'
          )}
        >
          {isBranch ? 'Branch' : 'Chat'}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-base-content">
        {label}
      </p>
      {preview ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {preview}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground/80">Double-click to open</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-base-100 !bg-primary"
      />
    </div>
  )
}

const nodeTypes = { chatGraphNode: ChatGraphNode }

function layoutChats(
  chats: ChatSummary[],
  edges: GraphEdgeSummary[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const children = new Map<string, string[]>()
  const targets = new Set(edges.map((edge) => edge.targetChatId))

  for (const edge of edges) {
    const list = children.get(edge.sourceChatId) || []
    list.push(edge.targetChatId)
    children.set(edge.sourceChatId, list)
  }

  const roots = chats.filter((chat) => !targets.has(chat.id))
  let forestX = 40

  for (const root of roots) {
    const queue: Array<{ id: string; depth: number }> = [{ id: root.id, depth: 0 }]
    const slotsAtDepth = new Map<number, number>()
    const visited = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.id)) {
        continue
      }
      visited.add(current.id)

      const slot = slotsAtDepth.get(current.depth) || 0
      slotsAtDepth.set(current.depth, slot + 1)
      positions.set(current.id, {
        x: forestX + current.depth * 280,
        y: 40 + slot * 140,
      })

      for (const childId of children.get(current.id) || []) {
        queue.push({ id: childId, depth: current.depth + 1 })
      }
    }

    forestX += Math.max(1, (slotsAtDepth.get(0) || 1)) * 40 + 320
  }

  for (const chat of chats) {
    if (!positions.has(chat.id)) {
      const index = positions.size
      positions.set(chat.id, {
        x: 40 + (index % 3) * 280,
        y: 40 + Math.floor(index / 3) * 140,
      })
    }
    if (
      typeof chat.position_x === 'number' &&
      typeof chat.position_y === 'number' &&
      Number.isFinite(chat.position_x) &&
      Number.isFinite(chat.position_y)
    ) {
      positions.set(chat.id, { x: chat.position_x, y: chat.position_y })
    }
  }

  return positions
}

export function ExploreCanvas({
  chats,
  edges,
  activeChatId,
  onOpenChat,
}: ExploreCanvasProps) {
  const branchedChatIds = useMemo(
    () => new Set(edges.map((edge) => edge.targetChatId)),
    [edges]
  )
  const layout = useMemo(() => layoutChats(chats, edges), [chats, edges])
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const [nodes, setNodes] = useState<Node[]>([])

  useEffect(() => {
    setNodes(
      chats.map((chat) => ({
        id: chat.id,
        type: 'chatGraphNode',
        position: layout.get(chat.id) || { x: 0, y: 0 },
        data: {
          label: chat.title?.trim() || 'Untitled chat',
          isBranch: branchedChatIds.has(chat.id),
          preview: branchedChatIds.has(chat.id)
            ? 'Forked research path'
            : 'Drag to rearrange · double-click to chat',
        },
        selected: activeChatId === chat.id,
      }))
    )
  }, [activeChatId, branchedChatIds, chats, layout])

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceChatId,
        target: edge.targetChatId,
        animated: true,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: 'oklch(0.72 0.1 255)' },
        style: { stroke: 'oklch(0.72 0.1 255)', strokeWidth: 2 },
      })),
    [edges]
  )

  const persistPosition = useCallback((chatId: string, position: { x: number; y: number }) => {
    const existing = saveTimers.current.get(chatId)
    if (existing) {
      clearTimeout(existing)
    }
    const timer = setTimeout(() => {
      void updateChatPosition(chatId, position)
      saveTimers.current.delete(chatId)
    }, 350)
    saveTimers.current.set(chatId, timer)
  }, [])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current))

      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          persistPosition(change.id, change.position)
        }
      }
    },
    [persistPosition]
  )

  const handleNodeDoubleClick: NodeMouseHandler = (_event, node) => {
    onOpenChat(node.id)
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--canvas-bg)] px-6 text-center text-sm text-muted-foreground">
        Start a chat, then use Branch from here. Your research map will grow here — drag cards
        anywhere you like.
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-[var(--canvas-bg)]">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color="rgba(167,199,255,0.12)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(20,18,32,0.72)"
          nodeColor={() => 'oklch(0.72 0.1 255)'}
        />
      </ReactFlow>
    </div>
  )
}
