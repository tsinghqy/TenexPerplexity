import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ChatTitleGenerationOptions {
  maxLength?: number
  addEllipsis?: boolean
  fallbackText?: string
}

export function generateChatTitleFromMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
  options: ChatTitleGenerationOptions = {}
): string {
  const {
    maxLength = 50,
    addEllipsis = true,
    fallbackText = 'New Chat',
  } = options

  if (!messages || messages.length === 0) {
    return fallbackText
  }

  const firstUserMessage = messages.find(m => m.role === 'user')
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

  return addEllipsis
    ? content.substring(0, maxLength) + '...'
    : content.substring(0, maxLength)
}

export function generateChatSummary(
  messages: Array<{ role: 'user' | 'assistant'; content: string }> | undefined
): string {
  return generateChatTitleFromMessages(messages, { maxLength: 60, addEllipsis: true })
}

export function areSetsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) return false
  for (const item of set1) {
    if (!set2.has(item)) return false
  }
  return true
}
