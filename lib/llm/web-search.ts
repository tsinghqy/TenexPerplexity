export const WEB_SEARCH_SYSTEM_INSTRUCTION = `
IMPORTANT: You have access to live web search. When the user asks about current events, recent developments, or anything that may have changed since your training data, search the web and ground your answer in those results.

Always cite sources with markdown links when information comes from the web. Prefer primary sources and recent coverage.
`.trim()

export function appendWebSearchInstruction(systemPrompt: string): string {
  return `${systemPrompt}\n\n${WEB_SEARCH_SYSTEM_INSTRUCTION}`
}

export function buildOpenAIWebSearchTools() {
  return [
    {
      type: 'web_search_preview' as const,
      user_location: { type: 'approximate' as const },
      search_context_size: 'medium' as const,
    },
  ]
}

export function resolveOpenAIWebSearchApiKey(): string | undefined {
  return process.env.OPENAI_WEB_SEARCH_API_KEY || process.env.OPENAI_API_KEY || undefined
}

export function resolveOpenAIWebSearchModelId(preferredModelId: string): string {
  return process.env.OPENAI_WEB_SEARCH_MODEL || preferredModelId
}
