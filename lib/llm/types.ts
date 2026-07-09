export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface StreamChatOptions {
  modelId: string
  messages: ChatMessage[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onChunk: (chunk: string) => void | Promise<void>
}

export interface ChatGenerationResult {
  content: string
  tokenUsage?: TokenUsage
}

export interface LLMProvider {
  readonly providerId: string
  isAvailable(): boolean
  streamChat(options: StreamChatOptions): Promise<ChatGenerationResult>
}
