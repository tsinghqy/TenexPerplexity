import OpenAI from 'openai'

export const EMBEDDING_MODEL_ID = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

let embeddingClient: OpenAI | null = null

function getEmbeddingClient(): OpenAI {
  if (embeddingClient) {
    return embeddingClient
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for embeddings')
  }

  embeddingClient = new OpenAI({ apiKey })
  return embeddingClient
}

/**
 * Generate an embedding for RAG / similarity search.
 * Uses OpenAI text-embedding-3-small (1536 dims) to match nodes.embedding.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Cannot embed empty text')
  }

  const response = await getEmbeddingClient().embeddings.create({
    model: EMBEDDING_MODEL_ID,
    input: trimmed,
  })

  const embedding = response.data[0]?.embedding
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error('Unexpected embedding response from OpenAI')
  }

  return embedding
}

export async function generateEmbeddingOrNull(text: string): Promise<number[] | null> {
  try {
    return await generateEmbedding(text)
  } catch (error) {
    console.warn('[embeddings] failed:', error instanceof Error ? error.message : error)
    return null
  }
}
