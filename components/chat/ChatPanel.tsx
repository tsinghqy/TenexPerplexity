'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Citation } from '@/lib/llm/citations'
import type { ChatSummary } from '@/lib/api/chat'
import type { ChatThreadMessage } from '@/lib/hooks/useStreamingChat'

function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) {
    return null
  }

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Sources
      </p>
      <ul className="space-y-2">
        {citations.map((citation, index) => (
          <li key={`${citation.url}-${index}`}>
            <a
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-white/10 bg-base-300/40 px-3 py-2 transition hover:border-primary/40 hover:bg-primary/10"
            >
              <span className="line-clamp-1 text-sm font-medium text-base-content">
                {index + 1}. {citation.title}
              </span>
              <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {citation.url}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ChatSidebarProps {
  chats: ChatSummary[]
  activeChatId: string | null
  isLoading: boolean
  disabled?: boolean
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
}

export function ChatSidebar({
  chats,
  activeChatId,
  isLoading,
  disabled,
  onSelectChat,
  onNewChat,
}: ChatSidebarProps) {
  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-white/10 bg-[var(--sidebar)]">
      <div className="border-b border-white/10 p-3">
        <Button
          type="button"
          className="w-full rounded-full bg-primary text-primary-content hover:brightness-110"
          onClick={onNewChat}
          disabled={disabled}
        >
          New chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading chats…</p>
        ) : chats.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
            No chats yet. Ask something to start your first research thread.
          </p>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectChat(chat.id)}
                  className={cn(
                    'w-full rounded-xl px-3 py-2.5 text-left text-sm transition',
                    activeChatId === chat.id
                      ? 'bg-primary/15 font-medium text-base-content'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-base-content'
                  )}
                >
                  <span className="line-clamp-2">
                    {chat.title?.trim() || 'Untitled chat'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

interface ChatMessageListProps {
  messages: ChatThreadMessage[]
  isLoading?: boolean
  isStreaming?: boolean
  onBranchFromMessage?: (nodeId: string) => void
  emptyHint?: string
}

export function ChatMessageList({
  messages,
  isLoading,
  isStreaming,
  onBranchFromMessage,
  emptyHint,
}: ChatMessageListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        Loading conversation…
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm leading-relaxed text-muted-foreground">
        {emptyHint ||
          'Ask anything. Branch from an answer to open a new research path on the map.'}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed',
            message.role === 'user'
              ? 'ml-auto bg-[var(--bubble-user)] text-primary-content'
              : 'mr-auto border border-white/10 bg-[var(--bubble-assistant)] text-base-content shadow-sm'
          )}
        >
          <div className="whitespace-pre-wrap">
            {message.content || (message.isStreaming ? '…' : '')}
            {message.isStreaming && message.content ? (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current align-middle" />
            ) : null}
          </div>
          {message.role === 'assistant' && message.citations?.length ? (
            <CitationList citations={message.citations} />
          ) : null}
          {message.role === 'assistant' &&
          !message.isStreaming &&
          onBranchFromMessage &&
          !message.id.startsWith('assistant-') ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-white/15 bg-transparent text-primary hover:bg-primary/10"
                disabled={isStreaming}
                onClick={() => onBranchFromMessage(message.id)}
              >
                Branch from here
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

interface ChatComposerProps {
  value: string
  isStreaming: boolean
  disabled?: boolean
  useWebSearch: boolean
  onChange: (value: string) => void
  onToggleWebSearch: (enabled: boolean) => void
  onSubmit: () => void
  onStop: () => void
  compact?: boolean
}

export function ChatComposer({
  value,
  isStreaming,
  disabled,
  useWebSearch,
  onChange,
  onToggleWebSearch,
  onSubmit,
  onStop,
  compact,
}: ChatComposerProps) {
  return (
    <form
      className={cn(
        'border-t border-white/10 bg-base-100/90 backdrop-blur',
        compact ? 'p-3' : 'p-4'
      )}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className={cn('flex w-full flex-col gap-2.5', !compact && 'mx-auto max-w-3xl')}>
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-primary)]"
            checked={useWebSearch}
            disabled={disabled || isStreaming}
            onChange={(event) => onToggleWebSearch(event.target.checked)}
          />
          <span className="font-medium text-base-content/80">Live sources</span>
          <span className={useWebSearch ? 'text-accent' : 'text-muted-foreground'}>
            {useWebSearch ? 'Web search on — answers cite the live web' : 'Model knowledge only'}
          </span>
        </label>
        <div className="flex gap-2">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Message Tenexity…"
            rows={compact ? 2 : 2}
            disabled={disabled}
            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-base-200 px-3.5 py-2.5 text-[15px] text-base-content outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:bg-base-300/60"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSubmit()
              }
            }}
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] self-end rounded-full"
              onClick={onStop}
            >
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              className="min-h-[44px] self-end rounded-full bg-primary px-5 text-primary-content hover:brightness-110"
              disabled={disabled || value.trim().length === 0}
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
