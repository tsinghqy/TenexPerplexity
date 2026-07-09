export interface ChatTitleGenerationOptions {
  maxLength?: number
  addEllipsis?: boolean
  fallbackText?: string
}

/**
 * Generate a chat title from the first user message (no LLM call).
 */
export function generateChatTitleFromFirstMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
  options: ChatTitleGenerationOptions = {}
): string {
  const { maxLength = 50, addEllipsis = true, fallbackText = 'New Chat' } = options

  if (!messages || messages.length === 0) {
    return fallbackText
  }

  const firstUserMessage = messages.find((message) => message.role === 'user')
  if (!firstUserMessage) {
    return fallbackText
  }

  const content = firstUserMessage.content.trim()
  if (!content) {
    return fallbackText
  }

  if (content.length <= maxLength) {
    return content
  }

  return addEllipsis ? `${content.slice(0, maxLength)}...` : content.slice(0, maxLength)
}
