export const WEB_SEARCH_SYSTEM_INSTRUCTION = `
IMPORTANT: You have live web search enabled and MUST use it for this answer.

For current events, sports (including FIFA / World Cup), scores, predictions, news, prices, schedules, or anything time-sensitive:
- Search the live web before answering. Do not rely on training knowledge alone.
- Prefer today's / this week's sources.
- If search results conflict with training data, trust the search results.
- Be specific: name teams, dates, odds or predictions, and what each source says.
- Always include markdown links to the sources you used, e.g. [ESPN](https://...).
- End with a short "Sources:" list of those links when you cited the web.
`.trim()

export function appendWebSearchInstruction(systemPrompt: string): string {
  return `${systemPrompt}\n\n${WEB_SEARCH_SYSTEM_INSTRUCTION}`
}

export type OpenAIWebSearchTool =
  | {
      type: 'web_search'
      user_location: { type: 'approximate' }
      search_context_size: 'high'
    }
  | {
      type: 'web_search_preview'
      user_location: { type: 'approximate' }
      search_context_size: 'high'
    }

/** Prefer the current Responses tool; fall back to preview if the API rejects it. */
export function buildOpenAIWebSearchTools(): OpenAIWebSearchTool[] {
  return [
    {
      type: 'web_search',
      user_location: { type: 'approximate' },
      search_context_size: 'high',
    },
  ]
}

export function buildOpenAIWebSearchPreviewTools(): OpenAIWebSearchTool[] {
  return [
    {
      type: 'web_search_preview',
      user_location: { type: 'approximate' },
      search_context_size: 'high',
    },
  ]
}

export function resolveOpenAIWebSearchApiKey(): string | undefined {
  return process.env.OPENAI_WEB_SEARCH_API_KEY || process.env.OPENAI_API_KEY || undefined
}

export function resolveOpenAIWebSearchModelId(preferredModelId: string): string {
  return process.env.OPENAI_WEB_SEARCH_MODEL || preferredModelId
}
