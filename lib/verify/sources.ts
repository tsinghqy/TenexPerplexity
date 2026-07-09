import type { Citation } from '@/lib/llm/citations'

/**
 * Server-side source fetching for claim verification.
 * Node runtime only (verify route) — never imported by Edge streaming code.
 */

export interface FetchedSource {
  url: string
  title: string
  text: string
  /** False when the URL could not be fetched; text falls back to the citation snippet. */
  fetched: boolean
}

const FETCH_TIMEOUT_MS = 5_000
// Generous raw cap: modern article pages ship megabytes of script before the
// body, and scripts are stripped before the readable-text cap is applied.
const MAX_RAW_HTML_CHARS = 3_000_000
/** Cap extracted text per source to keep verifier prompts bounded. */
export const MAX_SOURCE_TEXT_CHARS = 12_000

export function resolveMaxSourcesPerVerify(): number {
  const parsed = Number.parseInt(process.env.VERIFY_MAX_SOURCES || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 8) : 4
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&rsquo;|&#8217;/gi, '\u2019')
    .replace(/&mdash;|&#8212;/gi, '\u2014')
}

function stripTagsToText(fragment: string): string {
  const withoutTags = fragment
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeBasicEntities(withoutTags)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

/** Article body heuristic: paragraph/heading tags carry the claims; nav chrome doesn't. */
const MIN_PARAGRAPH_TEXT_CHARS = 800

/**
 * HTML → text extraction. Prefers <article>/<main> and then paragraph/heading
 * content so the verifier prompt starts with the article body instead of nav,
 * cookie banners, and newsletter boilerplate. Falls back to a whole-page strip.
 */
export function extractReadableText(html: string): string {
  const withoutBlocks = html
    .slice(0, MAX_RAW_HTML_CHARS)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  const containerMatch =
    /<article[\s\S]*?<\/article>/i.exec(withoutBlocks) ||
    /<main[\s\S]*?<\/main>/i.exec(withoutBlocks)
  const scope = containerMatch ? containerMatch[0] : withoutBlocks

  const paragraphs = scope.match(/<(p|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi) || []
  const paragraphText = paragraphs
    .map((fragment) => stripTagsToText(fragment))
    .filter((text) => text.length > 0)
    .join('\n')

  const text =
    paragraphText.length >= MIN_PARAGRAPH_TEXT_CHARS
      ? paragraphText
      : stripTagsToText(withoutBlocks)

  return text.slice(0, MAX_SOURCE_TEXT_CHARS)
}

async function fetchSingleSource(citation: Citation): Promise<FetchedSource> {
  const fallback: FetchedSource = {
    url: citation.url,
    title: citation.title,
    text: citation.snippet || '',
    fetched: false,
  }

  try {
    const response = await fetch(citation.url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TenexityVerifier/1.0)',
        Accept: 'text/html,text/plain;q=0.9,*/*;q=0.5',
      },
    })

    if (!response.ok) {
      return fallback
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return fallback
    }

    const rawText = await response.text()
    const text = contentType.includes('text/plain')
      ? rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_SOURCE_TEXT_CHARS)
      : extractReadableText(rawText)

    if (!text) {
      return fallback
    }

    return { url: citation.url, title: citation.title, text, fetched: true }
  } catch {
    return fallback
  }
}

/**
 * Fetch readable text for the top citations (bounded, parallel, best-effort).
 * Failed fetches degrade to snippet/title-only entries so verification can
 * still run in "honest" partial-evidence mode.
 */
export async function fetchSourceTexts(
  citations: Citation[],
  maxSources = resolveMaxSourcesPerVerify()
): Promise<FetchedSource[]> {
  const targets = citations.slice(0, maxSources)
  if (targets.length === 0) {
    return []
  }

  return Promise.all(targets.map((citation) => fetchSingleSource(citation)))
}
