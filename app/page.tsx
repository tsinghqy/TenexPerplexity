'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { ChatComposer, ChatMessageList, ChatSidebar } from '@/components/chat/ChatPanel'
import { ExploreCanvas, type ExploreFocusRequest } from '@/components/graph/ExploreCanvas'
import { ResearchPanel } from '@/components/research/ResearchPanel'
import { useAuth } from '@/context/AuthContext'
import { verifyNode } from '@/lib/api/verify'
import { useResearchRun } from '@/lib/hooks/useResearchRun'
import { useStreamingChat } from '@/lib/hooks/useStreamingChat'
import { getChatModels } from '@/lib/llm/models'
import { cn } from '@/lib/utils'

type WorkspaceView = 'chat' | 'research' | 'explore'

const WORKSPACE_VIEWS: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'research', label: 'Research' },
  { id: 'explore', label: 'Explore' },
]

export default function HomePage() {
  const { user, loading: isAuthLoading, signOut, configError } = useAuth()
  const {
    messages,
    chats,
    edges,
    activeChatId,
    branchParentNodeId,
    isLoadingChats,
    isLoadingMessages,
    isStreaming,
    errorMessage,
    selectedModelId,
    setSelectedModelId,
    useWebSearch,
    setUseWebSearch,
    sendMessage,
    stopStreaming,
    selectChat,
    startNewChat,
    branchFromMessage,
    verifyMessage,
    refreshChats,
  } = useStreamingChat()
  const [draftMessage, setDraftMessage] = useState('')
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('chat')
  const [explorePanelOpen, setExplorePanelOpen] = useState(false)
  const [exploreFocus, setExploreFocus] = useState<ExploreFocusRequest | null>(null)
  const availableModels = getChatModels()

  const focusTreeInExplore = (chatId: string) => {
    setExploreFocus({ chatId, token: Date.now() })
  }

  const {
    run: researchRun,
    isRunning: isResearchRunning,
    startResearch,
    cancelResearch,
    retryBranch,
    resetResearch,
  } = useResearchRun({
    modelId: selectedModelId,
    onGraphChanged: () => {
      void refreshChats()
    },
    // Research mode fact-checks every branch automatically (no Verify click).
    verifyBranch: async (assistantNodeId) => {
      const result = await verifyNode(assistantNodeId)
      return result.success ? (result.confidence ?? null) : null
    },
  })

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base-100 text-sm text-muted-foreground">
        Loading…
      </main>
    )
  }

  if (configError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base-100 px-6">
        <div className="w-full max-w-lg">
          <ErrorMessage message={configError} />
        </div>
      </main>
    )
  }

  const handleSubmit = async () => {
    const content = draftMessage
    setDraftMessage('')
    await sendMessage(content)
  }

  const openChatInExplore = async (chatId: string) => {
    setExplorePanelOpen(true)
    await selectChat(chatId)
  }

  const openResearchChat = async (chatId: string) => {
    setWorkspaceView('explore')
    setExplorePanelOpen(true)
    focusTreeInExplore(chatId)
    await selectChat(chatId)
  }

  const handleBranch = async (nodeId: string) => {
    await branchFromMessage(nodeId)
    setWorkspaceView('explore')
    setExplorePanelOpen(true)
  }

  const activeChatTitle =
    chats.find((chat) => chat.id === activeChatId)?.title || 'Conversation'

  return (
    <main className="flex h-screen flex-col bg-base-100 text-base-content">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-base-200/80 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-content">
            T
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-base-content">
              Tenexity
            </h1>
            <p className="text-xs text-muted-foreground">Search · branch · explore</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-base-300/60 p-1">
            {WORKSPACE_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                className={cn(
                  'min-h-[36px] rounded-full px-4 text-sm font-medium transition',
                  workspaceView === view.id
                    ? 'bg-base-100 text-base-content shadow-sm'
                    : 'text-muted-foreground hover:text-base-content'
                )}
                onClick={() => setWorkspaceView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </div>

          <select
            className="min-h-[40px] rounded-full border border-white/10 bg-base-200 px-3 text-sm text-base-content"
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
            disabled={isStreaming}
            aria-label="Model"
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="outline"
            className="rounded-full border-white/10"
            onClick={async () => {
              await signOut()
              window.location.href = '/auth/signin'
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {workspaceView === 'chat' ? (
          <>
            <ChatSidebar
              chats={chats}
              activeChatId={activeChatId}
              isLoading={isLoadingChats}
              disabled={isStreaming}
              onSelectChat={(chatId) => {
                void selectChat(chatId)
              }}
              onNewChat={startNewChat}
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-3">
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  {activeChatId ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => {
                        setWorkspaceView('explore')
                        setExplorePanelOpen(true)
                        focusTreeInExplore(activeChatId)
                      }}
                    >
                      View on map
                    </button>
                  ) : null}
                </div>
                {branchParentNodeId ? (
                  <p className="px-4 pt-2 text-xs text-primary">
                    Branching from a parent answer — your next message inherits that path’s context.
                  </p>
                ) : null}
                {errorMessage ? (
                  <div className="px-4 pt-3">
                    <ErrorMessage message={errorMessage} />
                  </div>
                ) : null}
                <ChatMessageList
                  messages={messages}
                  isLoading={isLoadingMessages}
                  isStreaming={isStreaming}
                  onBranchFromMessage={(nodeId) => {
                    void handleBranch(nodeId)
                  }}
                  onVerifyMessage={(nodeId) => {
                    void verifyMessage(nodeId)
                  }}
                />
              </div>

              <ChatComposer
                value={draftMessage}
                isStreaming={isStreaming}
                useWebSearch={useWebSearch}
                onChange={setDraftMessage}
                onToggleWebSearch={setUseWebSearch}
                onSubmit={handleSubmit}
                onStop={stopStreaming}
              />
            </div>
          </>
        ) : workspaceView === 'research' ? (
          <ResearchPanel
            run={researchRun}
            isRunning={isResearchRunning}
            onStart={(question) => {
              void startResearch(question)
            }}
            onCancel={() => {
              void cancelResearch()
            }}
            onRetryBranch={(chatId) => {
              void retryBranch(chatId)
            }}
            onReset={resetResearch}
            onOpenChat={(chatId) => {
              void openResearchChat(chatId)
            }}
          />
        ) : (
          <div className="relative flex min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <ExploreCanvas
                chats={chats}
                edges={edges}
                activeChatId={activeChatId}
                panelOpen={explorePanelOpen}
                focusRequest={exploreFocus}
                onOpenChat={(chatId) => {
                  void openChatInExplore(chatId)
                }}
              />
            </div>

            {explorePanelOpen ? (
              <div className="absolute inset-y-3 right-3 z-20 flex w-[min(420px,92vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-base-200 shadow-2xl shadow-black/40">
                <div className="flex shrink-0 items-start gap-3 border-b border-white/10 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Open chat
                    </p>
                    <p
                      className="truncate text-sm font-semibold text-base-content"
                      title={activeChatTitle}
                    >
                      {activeChatTitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full whitespace-nowrap"
                      onClick={() => {
                        setWorkspaceView('chat')
                      }}
                    >
                      Full chat
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full whitespace-nowrap"
                      onClick={() => setExplorePanelOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>

                {branchParentNodeId ? (
                  <p className="shrink-0 border-b border-white/10 bg-primary/15 px-4 py-2 text-xs text-primary">
                    New branch ready — send a follow-up to grow this path.
                  </p>
                ) : null}

                {errorMessage ? (
                  <div className="px-4 pt-3">
                    <ErrorMessage message={errorMessage} />
                  </div>
                ) : null}

                <ChatMessageList
                  messages={messages}
                  isLoading={isLoadingMessages}
                  isStreaming={isStreaming}
                  emptyHint="This branch is empty. Ask a follow-up to continue from the parent answer."
                  onBranchFromMessage={(nodeId) => {
                    void handleBranch(nodeId)
                  }}
                  onVerifyMessage={(nodeId) => {
                    void verifyMessage(nodeId)
                  }}
                />

                <ChatComposer
                  compact
                  value={draftMessage}
                  isStreaming={isStreaming}
                  useWebSearch={useWebSearch}
                  onChange={setDraftMessage}
                  onToggleWebSearch={setUseWebSearch}
                  onSubmit={handleSubmit}
                  onStop={stopStreaming}
                />
              </div>
            ) : (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-base-200/95 px-4 py-2 text-xs text-muted-foreground shadow-md">
                Drag cards to rearrange · Double-click a card to open chat
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
