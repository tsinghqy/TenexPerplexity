'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { ChatComposer, ChatMessageList, ChatSidebar } from '@/components/chat/ChatPanel'
import { useAuth } from '@/context/AuthContext'
import { useStreamingChat } from '@/lib/hooks/useStreamingChat'
import { getChatModels } from '@/lib/llm/models'

export default function HomePage() {
  const { user, loading: isAuthLoading, signOut, configError } = useAuth()
  const {
    messages,
    chats,
    activeChatId,
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
  } = useStreamingChat()
  const [draftMessage, setDraftMessage] = useState('')
  const availableModels = getChatModels()

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </main>
    )
  }

  if (configError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
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

  return (
    <main className="flex h-screen flex-col bg-base-100">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Phase 4</p>
          <h1 className="text-lg font-semibold">Tenexity</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="min-h-[44px] rounded-lg border border-white/10 bg-base-200 px-3 text-sm"
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
            <p className="px-4 pt-3 text-xs text-muted-foreground">{user?.email}</p>
            {errorMessage ? (
              <div className="px-4 pt-3">
                <ErrorMessage message={errorMessage} />
              </div>
            ) : null}
            <ChatMessageList messages={messages} isLoading={isLoadingMessages} />
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
      </div>
    </main>
  )
}
