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
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { updateChatPosition, type ChatSummary, type GraphEdgeSummary } from '@/lib/api/chat'
import { GRAPH_NODE_WIDTH, collectTreeChatIds, layoutChats } from '@/lib/graph/layout'
import { cn } from '@/lib/utils'

/** Request to zoom the canvas onto one chat's fork tree. */
export interface ExploreFocusRequest {
  chatId: string
  /** Changes on every request so refocusing the same tree still animates. */
  token: number
}

interface ExploreCanvasProps {
  chats: ChatSummary[]
  edges: GraphEdgeSummary[]
  activeChatId: string | null
  panelOpen?: boolean
  focusRequest?: ExploreFocusRequest | null
  onOpenChat: (chatId: string) => void
}

function ChatGraphNode({ data, selected }: NodeProps) {
  const label = String(data.label || 'Untitled chat')
  const isBranch = Boolean(data.isBranch)
  const isWinner = Boolean(data.isWinner)
  const preview = typeof data.preview === 'string' ? data.preview : ''
  const confidence = typeof data.confidence === 'number' ? data.confidence : null

  return (
    <div
      className={cn(
        'rounded-2xl border bg-[var(--surface-elevated)] px-3.5 py-3 text-left shadow-md transition',
        'hover:shadow-lg',
        selected ? 'border-primary ring-4 ring-primary/20' : 'border-white/10',
        isWinner && 'border-warning/70 ring-4 ring-warning/25'
      )}
      style={{ width: GRAPH_NODE_WIDTH }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-base-100 !bg-primary"
      />
      <div className="flex flex-wrap items-center gap-1.5">
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
        {isWinner ? (
          <span className="inline-flex rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
            👑 Winner
          </span>
        ) : null}
        {confidence !== null ? (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
              confidence >= 70
                ? 'bg-success/20 text-success'
                : confidence >= 40
                  ? 'bg-warning/20 text-warning'
                  : 'bg-error/20 text-error'
            )}
          >
            {Math.round(confidence)}%
          </span>
        ) : null}
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
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-base-100 !bg-primary"
      />
    </div>
  )
}

const nodeTypes = { chatGraphNode: ChatGraphNode }

export function ExploreCanvas({
  chats,
  edges,
  activeChatId,
  panelOpen = false,
  focusRequest = null,
  onOpenChat,
}: ExploreCanvasProps) {
  const branchedChatIds = useMemo(
    () => new Set(edges.map((edge) => edge.targetChatId)),
    [edges]
  )
  const layout = useMemo(() => layoutChats(chats, edges), [chats, edges])
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const persistedInitialIds = useRef<Set<string>>(new Set())
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const handledFocusTokenRef = useRef<number | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])

  // Zoom onto the requested chat's whole fork tree once its node exists.
  useEffect(() => {
    if (!focusRequest || handledFocusTokenRef.current === focusRequest.token) {
      return
    }
    const instance = flowInstanceRef.current
    if (!instance || !nodes.some((node) => node.id === focusRequest.chatId)) {
      return
    }

    handledFocusTokenRef.current = focusRequest.token
    const treeIds = collectTreeChatIds(focusRequest.chatId, edges)
    void instance.fitView({
      nodes: [...treeIds].map((id) => ({ id })),
      padding: panelOpen ? 0.35 : 0.25,
      duration: 500,
    })
  }, [edges, focusRequest, nodes, panelOpen])

  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  // Persist auto-assigned positions once so new chats keep their free slot.
  useEffect(() => {
    for (const chat of chats) {
      const hasSaved =
        typeof chat.position_x === 'number' &&
        typeof chat.position_y === 'number' &&
        Number.isFinite(chat.position_x) &&
        Number.isFinite(chat.position_y)
      if (hasSaved || persistedInitialIds.current.has(chat.id)) {
        continue
      }
      const point = layout.get(chat.id)
      if (!point) {
        continue
      }
      persistedInitialIds.current.add(chat.id)
      void updateChatPosition(chat.id, point)
    }
  }, [chats, layout])

  useEffect(() => {
    setNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]))

      return chats.map((chat) => {
        const existing = currentById.get(chat.id)
        const layoutPosition = layout.get(chat.id) || { x: 0, y: 0 }
        const hasSaved =
          typeof chat.position_x === 'number' &&
          typeof chat.position_y === 'number' &&
          Number.isFinite(chat.position_x) &&
          Number.isFinite(chat.position_y)

        // Prefer in-session position so chat refreshes don't snap dragged cards.
        const position =
          existing?.position ??
          (hasSaved
            ? { x: chat.position_x as number, y: chat.position_y as number }
            : layoutPosition)

        return {
          id: chat.id,
          type: 'chatGraphNode',
          position,
          data: {
            label: chat.title?.trim() || 'Untitled chat',
            isBranch: branchedChatIds.has(chat.id),
            isWinner: chat.is_winner === true,
            confidence: typeof chat.confidence === 'number' ? chat.confidence : null,
            preview: branchedChatIds.has(chat.id)
              ? 'Forked research path'
              : 'Drag to rearrange · double-click to chat',
          },
          selected: activeChatId === chat.id,
        }
      })
    })
  }, [activeChatId, branchedChatIds, chats, layout])

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceChatId,
        target: edge.targetChatId,
        animated: true,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-primary)' },
        style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
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
        onInit={(instance) => {
          flowInstanceRef.current = instance
        }}
        onNodesChange={onNodesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{
          padding: panelOpen ? 0.35 : 0.2,
          includeHiddenNodes: false,
        }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color="color-mix(in oklch, var(--color-primary) 18%, transparent)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor="color-mix(in oklch, var(--canvas-bg) 75%, black)"
          nodeColor={() => 'var(--color-primary)'}
        />
      </ReactFlow>
    </div>
  )
}
