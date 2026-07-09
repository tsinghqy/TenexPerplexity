import OpenAI from 'openai'

let jsonClient: OpenAI | null = null

function getJsonClient(): OpenAI {
  if (jsonClient) {
    return jsonClient
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for structured LLM calls')
  }

  jsonClient = new OpenAI({ apiKey })
  return jsonClient
}

/**
 * Single non-streaming JSON-mode completion.
 * Shared by the claim verifier, research planner, and branch judge.
 */
export async function createJsonCompletion(params: {
  model: string
  system: string
  user: string
  maxTokens?: number
}): Promise<Record<string, unknown>> {
  const response = await getJsonClient().chat.completions.create({
    model: params.model,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: params.maxTokens ?? 2_000,
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error('Empty completion from JSON-mode LLM call')
  }

  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON-mode LLM call did not return an object')
  }

  return parsed as Record<string, unknown>
}
