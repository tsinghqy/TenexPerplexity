'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatThreadMessage } from '@/lib/hooks/useStreamingChat'

interface ChatMessageListProps {
  messages: ChatThreadMessage[]
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Ask anything to start streaming a response.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
            message.role === 'user'
              ? 'ml-auto bg-primary text-primary-foreground'
              : 'mr-auto border border-white/10 bg-base-200/90 text-foreground'
          )}
        >
          {message.content || (message.isStreaming ? '…' : '')}
          {message.isStreaming && message.content ? (
            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current align-middle" />
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
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
}

export function ChatComposer({
  value,
  isStreaming,
  disabled,
  onChange,
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
      <div className="mx-auto flex w-full max-w-3xl gap-3">
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
    </form>
  )
}
