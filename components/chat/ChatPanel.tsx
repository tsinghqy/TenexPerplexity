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
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Sources
      </p>
      <ul className="space-y-2">
        {citations.map((citation, index) => (
          <li key={`${citation.url}-${index}`}>
            <a
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-white/10 bg-base-100/60 px-3 py-2 transition hover:border-primary/40 hover:bg-base-100"
            >
              <span className="line-clamp-1 text-sm font-medium text-foreground">
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-base-200/40">
      <div className="border-b border-white/10 p-3">
        <Button
          type="button"
          className="w-full"
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
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No saved chats yet. Send a message to create one.
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
                    'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                    activeChatId === chat.id
                      ? 'bg-primary/20 text-foreground'
                      : 'text-muted-foreground hover:bg-base-100 hover:text-foreground'
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
}

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        Loading conversation…
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Ask anything. Conversations are saved and reload after refresh.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
            message.role === 'user'
              ? 'ml-auto bg-primary text-primary-foreground'
              : 'mr-auto border border-white/10 bg-base-200/90 text-foreground'
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
}: ChatComposerProps) {
  return (
    <form
      className="border-t border-white/10 bg-base-100/80 p-4 backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={useWebSearch}
            disabled={disabled || isStreaming}
            onChange={(event) => onToggleWebSearch(event.target.checked)}
          />
          Web search
          <span className="text-muted-foreground/70">
            {useWebSearch ? 'Live sources enabled' : 'Answer from model knowledge only'}
          </span>
        </label>
        <div className="flex gap-3">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Message Tenexity…"
            rows={2}
            disabled={disabled}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-base-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSubmit()
              }
            }}
          />
          {isStreaming ? (
            <Button type="button" variant="outline" className="min-h-[44px] self-end" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              className="min-h-[44px] self-end"
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
