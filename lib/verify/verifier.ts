import type { Citation } from '@/lib/llm/citations'
import type { ClaimVerdict } from '@/lib/supabase/database.types'
import { createJsonCompletion } from '@/lib/llm/json-completion'
import { segmentClaims, type ClaimSpan } from '@/lib/verify/claims'
import { computeGroundedScore } from '@/lib/verify/score'
import { fetchSourceTexts, type FetchedSource } from '@/lib/verify/sources'

export interface VerifiedClaim extends ClaimSpan {
  verdict: ClaimVerdict
  confidence: number
  sourceUrl: string | null
  sourceTitle: string | null
  sourceQuote: string | null
}

export interface VerificationResult {
  claims: VerifiedClaim[]
  /** 0–100 grounded score, or null when the answer had no verifiable claims. */
  confidence: number | null
  sourcesChecked: number
  sourcesFetched: number
}

export function resolveVerifyModelId(): string {
  return process.env.VERIFY_MODEL || 'gpt-4o-mini'
}

function unsupportedClaim(span: ClaimSpan): VerifiedClaim {
  return {
    ...span,
    verdict: 'unsupported',
    confidence: 0,
    sourceUrl: null,
    sourceTitle: null,
    sourceQuote: null,
  }
}

function clampConfidence(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  // Accept either 0–1 or 0–100 scales from the model.
  const normalized = parsed > 1 ? parsed / 100 : parsed
  return Math.min(Math.max(normalized, 0), 1)
}

function parseVerdict(value: unknown): ClaimVerdict {
  return value === 'supported' || value === 'partial' || value === 'unsupported'
    ? value
    : 'unsupported'
}

function buildVerifierPrompt(claims: ClaimSpan[], sources: FetchedSource[]): string {
  const claimsBlock = claims
    .map((claim, index) => `CLAIM ${index}: ${claim.text}`)
    .join('\n')

  const sourcesBlock = sources
    .map((source, index) => {
      const header = `SOURCE ${index}: ${source.title} (${source.url})`
      if (!source.text) {
        return `${header}\n[Content unavailable — judge from title/URL only]`
      }
      const mode = source.fetched ? 'Full text excerpt' : 'Snippet only'
      return `${header}\n${mode}:\n${source.text}`
    })
    .join('\n\n')

  return `CLAIMS TO VERIFY:\n${claimsBlock}\n\nSOURCES:\n${sourcesBlock}`
}

const VERIFIER_SYSTEM_PROMPT = `
You are a strict fact-checking judge. You receive numbered CLAIMS from an AI answer and numbered SOURCES (web page text).

For every claim, decide:
- "supported": a source directly states or clearly entails the claim
- "partial": a source is related and consistent, but does not fully confirm the claim
- "unsupported": no source backs the claim (or a source contradicts it)

Rules:
- Judge ONLY against the provided sources, never your own knowledge.
- For supported/partial verdicts, cite the single best source index and copy the most relevant short quote (max 240 chars) verbatim from that source.
- Opinions, hedges, and meta statements ("it depends", "here are some options") that make no factual assertion should be "supported" with confidence 0.5 and no quote.
- Respond with JSON: {"claims":[{"index":0,"verdict":"supported","confidence":0.9,"source_index":1,"quote":"..."}]}
- Include every claim index exactly once. confidence is 0..1.
`.trim()

interface RawClaimVerdict {
  index?: unknown
  verdict?: unknown
  confidence?: unknown
  source_index?: unknown
  quote?: unknown
}

function applyRawVerdicts(
  spans: ClaimSpan[],
  raw: RawClaimVerdict[],
  sources: FetchedSource[],
  anySourceFetched: boolean
): VerifiedClaim[] {
  const byIndex = new Map<number, RawClaimVerdict>()
  for (const entry of raw) {
    const index = typeof entry.index === 'number' ? entry.index : Number(entry.index)
    if (Number.isInteger(index) && index >= 0 && index < spans.length) {
      byIndex.set(index, entry)
    }
  }

  return spans.map((span, index) => {
    const entry = byIndex.get(index)
    if (!entry) {
      return unsupportedClaim(span)
    }

    let verdict = parseVerdict(entry.verdict)
    // Honesty rule: without any fetched source text, never claim full support.
    if (verdict === 'supported' && !anySourceFetched) {
      verdict = 'partial'
    }

    const sourceIndex =
      typeof entry.source_index === 'number' ? entry.source_index : Number(entry.source_index)
    const source =
      Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < sources.length
        ? sources[sourceIndex]
        : null
    const quote =
      typeof entry.quote === 'string' && entry.quote.trim()
        ? entry.quote.trim().slice(0, 240)
        : null

    return {
      ...span,
      verdict,
      confidence: clampConfidence(entry.confidence),
      sourceUrl: verdict === 'unsupported' ? null : (source?.url ?? null),
      sourceTitle: verdict === 'unsupported' ? null : (source?.title ?? null),
      sourceQuote: verdict === 'unsupported' ? null : quote,
    }
  })
}

/**
 * Verify one assistant answer: segment claims, fetch cited sources,
 * judge each claim with one LLM call, and aggregate a grounded score.
 */
export async function verifyAnswer(params: {
  content: string
  citations: Citation[]
}): Promise<VerificationResult> {
  const spans = segmentClaims(params.content)
  if (spans.length === 0) {
    return { claims: [], confidence: null, sourcesChecked: 0, sourcesFetched: 0 }
  }

  // No sources at all → every factual claim is ungrounded by definition.
  if (params.citations.length === 0) {
    const claims = spans.map(unsupportedClaim)
    return {
      claims,
      confidence: computeGroundedScore(claims),
      sourcesChecked: 0,
      sourcesFetched: 0,
    }
  }

  const sources = await fetchSourceTexts(params.citations)
  const anySourceFetched = sources.some((source) => source.fetched)

  const response = await createJsonCompletion({
    model: resolveVerifyModelId(),
    system: VERIFIER_SYSTEM_PROMPT,
    user: buildVerifierPrompt(spans, sources),
    maxTokens: 4_000,
  })

  const rawClaims = Array.isArray(response.claims)
    ? (response.claims as RawClaimVerdict[])
    : []
  const claims = applyRawVerdicts(spans, rawClaims, sources, anySourceFetched)

  return {
    claims,
    confidence: computeGroundedScore(claims),
    sourcesChecked: sources.length,
    sourcesFetched: sources.filter((source) => source.fetched).length,
  }
}
