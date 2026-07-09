export const DEFAULT_CHAT_SYSTEM_PROMPT =
  'You are Tenexity, a helpful AI assistant. Provide clear, accurate, and concise answers.'

export const STREAM_EVENT = {
  CHUNK: 'chunk',
  CITATIONS: 'citations',
  ERROR: 'error',
  COMPLETE: 'complete',
  DONE: '[DONE]',
} as const

export const CHAT_ERROR_MESSAGE = {
  UNAUTHORIZED: 'Authentication required',
  MISSING_MESSAGE: 'Message content is required',
  INVALID_MODEL: 'Invalid model ID',
  NO_PROVIDER: 'No LLM provider is configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY in .env.local.',
  STREAM_FAILED: 'Failed to generate a response',
} as const
