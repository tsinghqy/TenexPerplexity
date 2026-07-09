import type OpenAI from 'openai'
import type { ChatMessage } from './types'
import { DEFAULT_CHAT_SYSTEM_PROMPT } from '@/lib/chat/constants'

export function buildChatCompletionMessages(
  messages: ChatMessage[],
  systemPrompt?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content: systemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT,
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ]
}
