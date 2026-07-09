'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Citation } from '@/lib/llm/citations'
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
              {citation.snippet ? (
                <span className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">
                  {citation.snippet}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ChatMessageListProps {
  messages: ChatThreadMessage[]
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Ask a current-events question with web search on to see live sources.
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
